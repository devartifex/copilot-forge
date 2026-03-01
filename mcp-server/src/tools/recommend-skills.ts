import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getCached, setCache } from "../cache/catalog-cache.js";
import { fetchCatalog } from "./search-awesome-copilot.js";
import {
  fetchFromRegistry,
  type RegistryServer,
} from "./search-mcp-registry.js";
import { deduplicateResults } from "../security/deduplication.js";
import { getTrustBadge } from "../security/trusted-sources.js";
import type { CatalogEntry } from "../types.js";

// ---------------------------------------------------------------------------
// Lightweight project context analysis
// ---------------------------------------------------------------------------

interface ProjectContext {
  primaryLanguage: string | null;
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
}

const MANIFEST_LANGUAGE: Record<string, string> = {
  "package.json": "JavaScript",
  "requirements.txt": "Python",
  "pyproject.toml": "Python",
  "go.mod": "Go",
  "Cargo.toml": "Rust",
  "pom.xml": "Java",
  "build.gradle": "Java",
  "Gemfile": "Ruby",
  "*.csproj": "C#",
};

const contextCache = new Map<string, { ctx: ProjectContext; ts: number }>();
const CONTEXT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function analyzeProjectContext(projectPath: string): ProjectContext {
  const cached = contextCache.get(projectPath);
  if (cached && Date.now() - cached.ts < CONTEXT_TTL_MS) return cached.ctx;

  const languages = new Set<string>();
  const frameworks: string[] = [];
  const packageManagers: string[] = [];

  for (const [file, lang] of Object.entries(MANIFEST_LANGUAGE)) {
    if (file === "*.csproj") {
      // Glob-style check for .csproj in root
      try {
        const entries = readdirSync(projectPath) as string[];
        if (entries.some((e: string) => e.endsWith(".csproj"))) {
          languages.add(lang);
          packageManagers.push("nuget");
        }
      } catch {
        /* skip */
      }
      continue;
    }
    if (existsSync(join(projectPath, file))) languages.add(lang);
  }

  // Detect frameworks & package managers from package.json
  const pkgPath = join(projectPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const allDeps: Record<string, string> = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      const fwChecks: [string, string][] = [
        ["react", "React"],
        ["next", "Next.js"],
        ["@angular/core", "Angular"],
        ["vue", "Vue"],
        ["nuxt", "Nuxt"],
        ["svelte", "Svelte"],
        ["express", "Express"],
        ["@nestjs/core", "NestJS"],
        ["fastify", "Fastify"],
        ["hono", "Hono"],
        ["@remix-run/react", "Remix"],
        ["astro", "Astro"],
      ];
      for (const [dep, name] of fwChecks) {
        if (dep in allDeps) frameworks.push(name);
      }
      // TypeScript override
      if ("typescript" in allDeps) languages.add("TypeScript");
    } catch {
      /* skip */
    }
  }

  // Python frameworks
  for (const pyFile of ["requirements.txt", "pyproject.toml"]) {
    const pyPath = join(projectPath, pyFile);
    if (existsSync(pyPath)) {
      try {
        const content = readFileSync(pyPath, "utf-8").toLowerCase();
        if (content.includes("django")) frameworks.push("Django");
        if (content.includes("flask")) frameworks.push("Flask");
        if (content.includes("fastapi")) frameworks.push("FastAPI");
      } catch {
        /* skip */
      }
    }
  }

  // Package managers
  if (existsSync(join(projectPath, "package-lock.json")))
    packageManagers.push("npm");
  if (existsSync(join(projectPath, "yarn.lock")))
    packageManagers.push("yarn");
  if (existsSync(join(projectPath, "pnpm-lock.yaml")))
    packageManagers.push("pnpm");
  if (
    existsSync(join(projectPath, "requirements.txt")) ||
    existsSync(join(projectPath, "Pipfile"))
  )
    packageManagers.push("pip");
  if (existsSync(join(projectPath, "poetry.lock")))
    packageManagers.push("poetry");
  if (existsSync(join(projectPath, "Cargo.lock")))
    packageManagers.push("cargo");
  if (existsSync(join(projectPath, "go.sum")))
    packageManagers.push("go");

  const langArr = [...languages];
  const ctx: ProjectContext = {
    primaryLanguage: langArr[0] ?? null,
    languages: langArr,
    frameworks: [...new Set(frameworks)],
    packageManagers: [...new Set(packageManagers)],
  };

  contextCache.set(projectPath, { ctx, ts: Date.now() });
  return ctx;
}

// ---------------------------------------------------------------------------
// Score boosting based on project context
// ---------------------------------------------------------------------------

function computeBoost(text: string, ctx: ProjectContext): number {
  const lower = text.toLowerCase();
  let boost = 0;

  if (ctx.primaryLanguage && lower.includes(ctx.primaryLanguage.toLowerCase())) {
    boost += 0.3;
  }

  for (const fw of ctx.frameworks) {
    if (lower.includes(fw.toLowerCase())) {
      boost += 0.2;
      break;
    }
  }

  for (const pm of ctx.packageManagers) {
    if (lower.includes(pm.toLowerCase())) {
      boost += 0.1;
      break;
    }
  }

  // Penalize if text mentions a different language prominently
  const otherLangs = [
    "Python",
    "JavaScript",
    "TypeScript",
    "Go",
    "Rust",
    "Java",
    "C#",
    "Ruby",
    "Swift",
    "Kotlin",
    "PHP",
  ];
  for (const lang of otherLangs) {
    if (
      ctx.primaryLanguage &&
      lang.toLowerCase() !== ctx.primaryLanguage.toLowerCase() &&
      !ctx.languages.includes(lang) &&
      lower.includes(lang.toLowerCase())
    ) {
      boost -= 0.2;
      break;
    }
  }

  return boost;
}

function whyRecommended(text: string, ctx: ProjectContext | null): string {
  if (!ctx) return "Matches query";
  const reasons: string[] = [];
  const lower = text.toLowerCase();

  if (ctx.primaryLanguage && lower.includes(ctx.primaryLanguage.toLowerCase())) {
    reasons.push(`matches project language (${ctx.primaryLanguage})`);
  }
  for (const fw of ctx.frameworks) {
    if (lower.includes(fw.toLowerCase())) {
      reasons.push(`matches framework (${fw})`);
      break;
    }
  }
  for (const pm of ctx.packageManagers) {
    if (lower.includes(pm.toLowerCase())) {
      reasons.push(`matches package manager (${pm})`);
      break;
    }
  }
  return reasons.length > 0 ? reasons.join("; ") : "Matches query";
}

// ---------------------------------------------------------------------------
// Relevance scoring
// ---------------------------------------------------------------------------

function textRelevance(query: string, name: string, description: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  const d = description.toLowerCase();

  if (n === q) return 1.0;
  if (n.includes(q)) return 0.8;
  if (d.includes(q)) return 0.5;
  // Token overlap
  const tokens = q.split(/\s+/);
  const text = `${n} ${d}`;
  const matched = tokens.filter((t) => text.includes(t)).length;
  return matched > 0 ? 0.3 * (matched / tokens.length) : 0;
}

// ---------------------------------------------------------------------------
// Cache keys
// ---------------------------------------------------------------------------

const AWESOME_CACHE_KEY = "awesome-copilot-catalog";
const REGISTRY_CACHE_KEY = "mcp-registry";

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerRecommendSkillsTool(server: McpServer): void {
  server.tool(
    "recommend_skills",
    "Unified recommendation tool: searches awesome-copilot catalog and MCP registry, deduplicates, and ranks results with optional project-context boosting",
    {
      query: z.string().describe("What you're looking for (e.g., 'react testing', 'database', 'security')"),
      project_path: z
        .string()
        .optional()
        .describe("Absolute path to project root for context-aware ranking"),
      types: z
        .array(
          z.enum([
            "instruction",
            "prompt",
            "skill",
            "agent",
            "mcp-server",
            "all",
          ])
        )
        .default(["all"])
        .describe("Asset types to include"),
      max_results: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(15)
        .describe("Maximum results to return"),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
    async ({ query, project_path, types, max_results }) => {
      // 1. Optional project context
      let ctx: ProjectContext | null = null;
      if (project_path && existsSync(project_path)) {
        ctx = analyzeProjectContext(project_path);
      }

      const wantAll = types.includes("all");

      // 2. Fetch awesome-copilot catalog
      let catalog: CatalogEntry[];
      const cachedCatalog = getCached(AWESOME_CACHE_KEY);
      if (cachedCatalog) {
        catalog = cachedCatalog;
      } else {
        catalog = await fetchCatalog();
        setCache(AWESOME_CACHE_KEY, catalog);
      }

      // 3. Fetch MCP registry
      let registryServers: RegistryServer[];
      const cachedRegistry = getCached(REGISTRY_CACHE_KEY);
      if (cachedRegistry) {
        registryServers = cachedRegistry.map((e) => ({
          name: e.name,
          description: e.description,
          packageName: e.path,
        }));
      } else {
        registryServers = await fetchFromRegistry();
        setCache(
          REGISTRY_CACHE_KEY,
          registryServers.map((s) => ({
            name: s.name,
            description: s.description,
            path: s.packageName,
            type: "mcp-server",
          }))
        );
      }

      // 4. Build unified search results with relevance scores
      interface ScoredResult {
        name: string;
        type: string;
        description: string;
        source: string;
        sourceUrl: string;
        relevanceScore: number;
        trustLevel: string;
      }

      const results: ScoredResult[] = [];

      // Awesome-copilot entries
      for (const entry of catalog) {
        if (!wantAll && !types.includes(entry.type as typeof types[number]))
          continue;

        const score = textRelevance(query, entry.name, entry.description);
        if (score <= 0) continue;

        results.push({
          name: entry.name,
          type: entry.type,
          description: entry.description,
          source: "awesome-copilot",
          sourceUrl: entry.path.startsWith("http")
            ? entry.path
            : `https://github.com/${entry.path}`,
          relevanceScore: score,
          trustLevel: "verified",
        });
      }

      // MCP registry entries
      if (wantAll || types.includes("mcp-server")) {
        for (const srv of registryServers) {
          const score = textRelevance(query, srv.name, srv.description);
          if (score <= 0) continue;

          const url = srv.packageName.includes("/")
            ? `https://github.com/${srv.packageName}`
            : `https://www.npmjs.com/package/${srv.packageName}`;

          results.push({
            name: srv.name,
            type: "mcp-server",
            description: srv.description,
            source: "mcp-registry",
            sourceUrl: url,
            relevanceScore: score,
            trustLevel: "community",
          });
        }
      }

      // 5. Deduplicate
      const deduped = deduplicateResults(results);

      // 6. Boost scores based on project context
      const boosted = deduped.map((r) => {
        const text = `${r.name} ${r.description}`;
        const boost = ctx ? computeBoost(text, ctx) : 0;
        return {
          ...r,
          relevanceScore: Math.max(0, Math.min(1, r.relevanceScore + boost)),
          reason: whyRecommended(text, ctx),
        };
      });

      // 7. Sort by adjusted score
      boosted.sort((a, b) => b.relevanceScore - a.relevanceScore);

      const top = boosted.slice(0, max_results);

      if (top.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No recommendations found for "${query}".`,
            },
          ],
        };
      }

      // 8. Format output
      const contextLine = ctx
        ? `📂 Project context: ${ctx.primaryLanguage ?? "unknown"} | frameworks: ${ctx.frameworks.join(", ") || "none"} | pkg: ${ctx.packageManagers.join(", ") || "none"}\n\n`
        : "";

      const lines = top.map((r, i) => {
        const badge = getTrustBadge(
          r.trustLevel as "verified" | "community" | "unknown"
        );
        const score = (r.relevanceScore * 100).toFixed(0);
        const alsoIn =
          r.alsoFoundIn.length > 0
            ? ` (also in: ${r.alsoFoundIn.map((a) => a.source).join(", ")})`
            : "";
        return [
          `${i + 1}. ${badge} **${r.name}** (${r.type}) — relevance: ${score}%${alsoIn}`,
          `   ${r.description}`,
          `   🔗 ${r.primaryUrl}`,
          `   💡 ${r.reason}`,
        ].join("\n");
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `${contextLine}Found ${boosted.length} recommendation(s) for "${query}"${boosted.length > max_results ? ` (showing top ${max_results})` : ""}:\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    }
  );
}
