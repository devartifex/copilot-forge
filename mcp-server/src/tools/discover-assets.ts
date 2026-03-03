import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import {
  matchAssets,
  filterInstalled,
  type CuratedAsset,
} from "../data/asset-index.js";
import { computeScore, formatScoreReport } from "../core/scorer.js";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "vendor",
  "__pycache__",
]);

const EXT_LANGUAGE_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".py": "Python",
  ".cs": "C#",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".rb": "Ruby",
  ".swift": "Swift",
  ".kt": "Kotlin",
  ".php": "PHP",
};

function collectFiles(dir: string, depth: number, maxDepth: number): string[] {
  if (depth > maxDepth) return [];
  let results: string[] = [];
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return results;
  }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results = results.concat(collectFiles(full, depth + 1, maxDepth));
      } else if (stat.isFile()) {
        results.push(full);
      }
    } catch {
      // skip
    }
  }
  return results;
}

function readJsonSafe(filePath: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return undefined;
  }
}

function detectLanguages(files: string[]): string[] {
  const counts = new Map<string, number>();
  for (const f of files) {
    const ext = extname(f).toLowerCase();
    const lang = EXT_LANGUAGE_MAP[ext];
    if (lang) {
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);
}

function detectFrameworks(root: string, files: string[]): string[] {
  const frameworks: string[] = [];

  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = readJsonSafe(pkgPath);
    if (pkg) {
      const allDeps = {
        ...(pkg.dependencies as Record<string, string> | undefined),
        ...(pkg.devDependencies as Record<string, string> | undefined),
      };
      const checks: [string, string][] = [
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
        ["electron", "Electron"],
        ["@remix-run/react", "Remix"],
        ["astro", "Astro"],
        ["vitest", "Vitest"],
        ["jest", "Jest"],
      ];
      for (const [dep, name] of checks) {
        if (dep in allDeps) frameworks.push(name);
      }
    }
  }

  for (const pyFile of ["requirements.txt", "pyproject.toml"]) {
    const pyPath = join(root, pyFile);
    if (existsSync(pyPath)) {
      try {
        const content = readFileSync(pyPath, "utf-8").toLowerCase();
        if (content.includes("django")) frameworks.push("Django");
        if (content.includes("flask")) frameworks.push("Flask");
        if (content.includes("fastapi")) frameworks.push("FastAPI");
        if (content.includes("pytest")) frameworks.push("pytest");
      } catch {
        // ignore
      }
    }
  }

  const csprojFiles = files.filter((f) => f.endsWith(".csproj"));
  for (const csproj of csprojFiles) {
    try {
      const content = readFileSync(csproj, "utf-8");
      if (content.includes("Microsoft.AspNetCore")) frameworks.push("ASP.NET");
      if (content.includes("Microsoft.AspNetCore.Components"))
        frameworks.push("Blazor");
    } catch {
      // ignore
    }
  }

  if (existsSync(join(root, "go.mod"))) frameworks.push("Go Modules");
  if (existsSync(join(root, "Cargo.toml"))) frameworks.push("Rust/Cargo");

  return [...new Set(frameworks)];
}

function detectCiCd(root: string): string[] {
  const ci: string[] = [];
  const wfDir = join(root, ".github", "workflows");
  if (existsSync(wfDir)) {
    try {
      const wfs = readdirSync(wfDir);
      ci.push(`GitHub Actions (${wfs.length} workflow(s))`);
    } catch {
      ci.push("GitHub Actions");
    }
  }
  if (existsSync(join(root, "azure-pipelines.yml"))) ci.push("Azure Pipelines");
  if (existsSync(join(root, "Jenkinsfile"))) ci.push("Jenkins");
  if (existsSync(join(root, ".gitlab-ci.yml"))) ci.push("GitLab CI");
  return ci;
}

function detectCloud(root: string, files: string[]): string[] {
  const cloud: string[] = [];
  const hasExt = (ext: string) => files.some((f) => f.endsWith(ext));
  if (
    hasExt(".bicep") ||
    files.some((f) => f.endsWith(".json") && f.includes("arm")) ||
    existsSync(join(root, "azure.yaml"))
  ) {
    cloud.push("Azure");
  }
  if (
    existsSync(join(root, "cdk.json")) ||
    existsSync(join(root, "template.yaml")) ||
    existsSync(join(root, "samconfig.toml"))
  ) {
    cloud.push("AWS");
  }
  if (existsSync(join(root, "app.yaml")) || existsSync(join(root, "cloudbuild.yaml"))) {
    cloud.push("GCP");
  }
  return cloud;
}

function detectDocker(root: string): boolean {
  return (
    existsSync(join(root, "Dockerfile")) ||
    existsSync(join(root, "docker-compose.yml")) ||
    existsSync(join(root, "docker-compose.yaml"))
  );
}

function getInstalledAssetNames(root: string): Set<string> {
  const names = new Set<string>();
  const ghDir = join(root, ".github");

  if (!existsSync(ghDir)) return names;

  const instrDir = join(ghDir, "instructions");
  if (existsSync(instrDir)) {
    try {
      for (const f of readdirSync(instrDir)) {
        if (f.endsWith(".instructions.md")) {
          names.add(f.replace(".instructions.md", ""));
        }
      }
    } catch {
      // ignore
    }
  }

  const promptsDir = join(ghDir, "prompts");
  if (existsSync(promptsDir)) {
    try {
      for (const f of readdirSync(promptsDir)) {
        if (f.endsWith(".prompt.md")) {
          names.add(f.replace(".prompt.md", ""));
        }
      }
    } catch {
      // ignore
    }
  }

  const skillsDir = join(ghDir, "skills");
  if (existsSync(skillsDir)) {
    try {
      for (const name of readdirSync(skillsDir)) {
        try {
          if (
            statSync(join(skillsDir, name)).isDirectory() &&
            existsSync(join(skillsDir, name, "SKILL.md"))
          ) {
            names.add(name);
          }
        } catch {
          // skip
        }
      }
    } catch {
      // ignore
    }
  }

  const agentsDir = join(ghDir, "agents");
  if (existsSync(agentsDir)) {
    try {
      for (const f of readdirSync(agentsDir)) {
        if (f.endsWith(".agent.md")) {
          names.add(f.replace(".agent.md", ""));
        }
      }
    } catch {
      // ignore
    }
  }

  return names;
}

function formatRecommendations(assets: CuratedAsset[]): string {
  if (assets.length === 0) {
    return "No matching assets found for this project's tech stack.";
  }

  const tierBadge = (tier: string) =>
    tier === "verified" ? "✅" : "⚠️";

  const lines = [
    `Found ${assets.length} recommended asset(s):`,
    "",
    "| # | Type | Name | Description | Trust |",
    "|---|------|------|-------------|-------|",
  ];

  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    lines.push(
      `| ${i + 1} | ${a.type} | ${a.name} | ${a.description} | ${tierBadge(a.quality_tier)} |`,
    );
  }

  lines.push(
    "",
    "To install, use `install_asset` with the source URL and asset type.",
    "Use `confirm: false` to preview first, then `confirm: true` to write.",
  );

  return lines.join("\n");
}

export function registerDiscoverAssetsTool(server: McpServer): void {
  server.tool(
    "discover_assets",
    "Analyze a project, score its Copilot setup, and recommend relevant assets from the curated index. Returns stack detection, current score, and ranked recommendations — all in one call.",
    {
      path: z.string().describe("Absolute path to the project root directory"),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
      idempotentHint: true,
    },
    async ({ path: projectPath }) => {
      if (!existsSync(projectPath)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Path does not exist: ${projectPath}`,
            },
          ],
        };
      }

      try {
        const files = collectFiles(projectPath, 0, 4);

        const languages = detectLanguages(files);
        const frameworks = detectFrameworks(projectPath, files);
        const cicd = detectCiCd(projectPath);
        const cloud = detectCloud(projectPath, files);
        const hasDocker = detectDocker(projectPath);

        const extraTags: string[] = [];
        if (hasDocker) extraTags.push("Docker");

        const allFrameworks = [...frameworks, ...extraTags];

        const matched = matchAssets(languages, allFrameworks, cicd, cloud);

        const installed = getInstalledAssetNames(projectPath);
        const recommendations = filterInstalled(matched, installed);

        const scoreResult = computeScore(projectPath);
        const scoreReport = formatScoreReport(scoreResult);

        const stackSummary = [
          languages.length > 0 ? `Languages: ${languages.join(", ")}` : "",
          allFrameworks.length > 0 ? `Frameworks: ${allFrameworks.join(", ")}` : "",
          cicd.length > 0 ? `CI/CD: ${cicd.join(", ")}` : "",
          cloud.length > 0 ? `Cloud: ${cloud.join(", ")}` : "",
          installed.size > 0 ? `Already installed: ${[...installed].join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        const output = [
          `# Discovery Results for ${projectPath}`,
          "",
          "## Detected Stack",
          stackSummary,
          "",
          scoreReport,
          "",
          "## Recommendations",
          formatRecommendations(recommendations),
        ].join("\n");

        return {
          content: [{ type: "text" as const, text: output }],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error discovering assets: ${message}`,
            },
          ],
        };
      }
    },
  );
}
