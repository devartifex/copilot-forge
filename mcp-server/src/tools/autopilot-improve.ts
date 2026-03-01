import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { getCached, setCache } from "../cache/catalog-cache.js";
import { fetchCatalog } from "./search-awesome-copilot.js";
import { validateInstalledAsset } from "../security/post-install-validator.js";
import type { CatalogEntry } from "../types.js";

// ---------------------------------------------------------------------------
// .github/ inventory helpers
// ---------------------------------------------------------------------------

interface GithubInventory {
  agents: string[];
  skills: string[];
  prompts: string[];
  instructions: string[];
  hasCopilotInstructions: boolean;
  total: number;
}

const ASSET_DIRS = ["agents", "skills", "prompts", "instructions"] as const;

function scanGithubDir(projectPath: string): GithubInventory {
  const ghDir = join(projectPath, ".github");
  const inventory: GithubInventory = {
    agents: [],
    skills: [],
    prompts: [],
    instructions: [],
    hasCopilotInstructions: false,
    total: 0,
  };

  if (!existsSync(ghDir)) return inventory;

  inventory.hasCopilotInstructions = existsSync(
    join(ghDir, "copilot-instructions.md"),
  );
  if (inventory.hasCopilotInstructions) inventory.total++;

  for (const dir of ASSET_DIRS) {
    const dirPath = join(ghDir, dir);
    if (!existsSync(dirPath)) continue;
    try {
      const files = readdirSync(dirPath).filter(
        (f) => f.endsWith(".md") || f.endsWith(".yml") || f.endsWith(".yaml"),
      );
      inventory[dir] = files;
      inventory.total += files.length;
    } catch {
      /* skip unreadable dirs */
    }
  }

  return inventory;
}

// ---------------------------------------------------------------------------
// Tech stack detection
// ---------------------------------------------------------------------------

interface TechStack {
  languages: string[];
  frameworks: string[];
}

function detectTechStack(projectPath: string): TechStack {
  const languages = new Set<string>();
  const frameworks: string[] = [];

  const MANIFEST_LANG: [string, string][] = [
    ["package.json", "JavaScript"],
    ["requirements.txt", "Python"],
    ["pyproject.toml", "Python"],
    ["go.mod", "Go"],
    ["Cargo.toml", "Rust"],
    ["pom.xml", "Java"],
    ["build.gradle", "Java"],
  ];

  for (const [file, lang] of MANIFEST_LANG) {
    if (existsSync(join(projectPath, file))) languages.add(lang);
  }

  // .csproj check
  try {
    const entries = readdirSync(projectPath);
    if (entries.some((e) => e.endsWith(".csproj"))) languages.add("C#");
  } catch {
    /* skip */
  }

  // Detect frameworks & TypeScript from package.json
  const pkgPath = join(projectPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const allDeps: Record<string, string> = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      if ("typescript" in allDeps) languages.add("TypeScript");
      const fwChecks: [string, string][] = [
        ["react", "React"],
        ["next", "Next.js"],
        ["@angular/core", "Angular"],
        ["vue", "Vue"],
        ["express", "Express"],
        ["@nestjs/core", "NestJS"],
        ["fastify", "Fastify"],
        ["svelte", "Svelte"],
        ["django", "Django"],
        ["flask", "Flask"],
        ["fastapi", "FastAPI"],
      ];
      for (const [dep, name] of fwChecks) {
        if (dep in allDeps) frameworks.push(name);
      }
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
        if (content.includes("django") && !frameworks.includes("Django"))
          frameworks.push("Django");
        if (content.includes("flask") && !frameworks.includes("Flask"))
          frameworks.push("Flask");
        if (content.includes("fastapi") && !frameworks.includes("FastAPI"))
          frameworks.push("FastAPI");
      } catch {
        /* skip */
      }
    }
  }

  return {
    languages: [...languages],
    frameworks: [...new Set(frameworks)],
  };
}

// ---------------------------------------------------------------------------
// Matching & ranking
// ---------------------------------------------------------------------------

function matchesStack(entry: CatalogEntry, stack: TechStack): string | null {
  const text = `${entry.name} ${entry.description}`.toLowerCase();

  for (const fw of stack.frameworks) {
    if (text.includes(fw.toLowerCase())) return `framework match (${fw})`;
  }
  for (const lang of stack.languages) {
    if (text.includes(lang.toLowerCase())) return `language match (${lang})`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const CACHE_KEY = "awesome-copilot-catalog";

export function registerAutopilotImproveTool(server: McpServer): void {
  server.tool(
    "autopilot_improve",
    "Run one iteration of the self-improvement autopilot — analyzes project, discovers assets, validates existing installs, and returns an improvement plan",
    {
      project_path: z
        .string()
        .describe("Absolute path to the project root"),
      max_recommendations: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(5)
        .describe("Maximum recommendations to return (default 5, max 10)"),
      include_validation: z
        .boolean()
        .default(true)
        .describe("Validate already-installed assets for health issues"),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
    async ({ project_path, max_recommendations, include_validation }) => {
      if (!existsSync(project_path)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: project path does not exist: ${project_path}`,
            },
          ],
          isError: true,
        };
      }

      // 1. Scan .github/ inventory
      const inventory = scanGithubDir(project_path);

      // 2. Detect tech stack
      const stack = detectTechStack(project_path);

      // 3. Fetch catalog (with cache)
      let catalog: CatalogEntry[];
      const cached = getCached(CACHE_KEY);
      if (cached) {
        catalog = cached;
      } else {
        catalog = await fetchCatalog();
        setCache(CACHE_KEY, catalog);
      }

      // 4. Build set of already-installed names for exclusion
      const installedNames = new Set<string>();
      for (const dir of ASSET_DIRS) {
        for (const file of inventory[dir]) {
          installedNames.add(
            basename(file, file.substring(file.lastIndexOf("."))).toLowerCase(),
          );
        }
      }

      // 5. Match, filter, rank
      const recommendations: {
        entry: CatalogEntry;
        reason: string;
      }[] = [];

      for (const entry of catalog) {
        const nameKey = entry.name.toLowerCase();
        if (installedNames.has(nameKey)) continue;

        const reason = matchesStack(entry, stack);
        if (reason) {
          recommendations.push({ entry, reason });
        }
      }

      // Sort: framework matches first (they're more specific), then language
      recommendations.sort((a, b) => {
        const aFw = a.reason.startsWith("framework") ? 0 : 1;
        const bFw = b.reason.startsWith("framework") ? 0 : 1;
        return aFw - bFw;
      });

      const topRecs = recommendations.slice(0, max_recommendations);

      // 6. Validate existing assets
      interface ValidationRow {
        file: string;
        severity: string;
        issue: string;
        fix: string;
      }
      const validationRows: ValidationRow[] = [];
      let healthIssueCount = 0;

      if (include_validation) {
        const ghDir = join(project_path, ".github");
        for (const dir of ASSET_DIRS) {
          for (const file of inventory[dir]) {
            const filePath = join(ghDir, dir, file);
            const result = validateInstalledAsset(filePath, project_path);
            for (const issue of result.issues) {
              healthIssueCount++;
              validationRows.push({
                file: `${dir}/${file}`,
                severity: issue.severity,
                issue: issue.message,
                fix: issue.fix ?? "—",
              });
            }
          }
        }
      }

      // 7. Format report
      const langStr = stack.languages.join(", ") || "unknown";
      const fwStr = stack.frameworks.join(", ") || "none";

      const breakdown = ASSET_DIRS.map(
        (d) => `${d}: ${inventory[d].length}`,
      ).join(", ");

      let report = `## 🔄 Autopilot Analysis — Iteration Ready\n\n`;
      report += `### Current State\n`;
      report += `- **Customizations:** ${inventory.total} (${breakdown})\n`;
      if (inventory.hasCopilotInstructions) {
        report += `- **copilot-instructions.md:** ✅ present\n`;
      }
      report += `- **Tech Stack:** ${langStr} | frameworks: ${fwStr}\n`;
      report += `- **Health Issues:** ${healthIssueCount}\n\n`;

      if (validationRows.length > 0) {
        report += `### Validation Issues (existing assets)\n`;
        report += `| File | Severity | Issue | Suggested Fix |\n`;
        report += `|------|----------|-------|---------------|\n`;
        for (const row of validationRows) {
          report += `| ${row.file} | ${row.severity} | ${row.issue} | ${row.fix} |\n`;
        }
        report += `\n`;
      }

      if (topRecs.length > 0) {
        report += `### Top Recommendations (not yet installed)\n`;
        report += `| # | Type | Name | Description | Match Reason |\n`;
        report += `|---|------|------|-------------|--------------|\n`;
        for (let i = 0; i < topRecs.length; i++) {
          const { entry, reason } = topRecs[i];
          report += `| ${i + 1} | ${entry.type} | ${entry.name} | ${entry.description} | ${reason} |\n`;
        }
        report += `\n`;
      } else {
        report += `### Top Recommendations\nNo new recommendations found for your tech stack.\n\n`;
      }

      report += `### Install Command\n`;
      report += `To install these, use the \`install_asset\` tool for each, or ask me to install them.\n`;

      return {
        content: [{ type: "text" as const, text: report }],
      };
    },
  );
}
