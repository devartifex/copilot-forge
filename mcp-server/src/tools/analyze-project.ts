import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

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
      // skip inaccessible entries
    }
  }
  return results;
}

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function fileExists(root: string, ...segments: string[]): boolean {
  return existsSync(join(root, ...segments));
}

function detectLanguages(files: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const f of files) {
    const ext = extname(f).toLowerCase();
    const lang = EXT_LANGUAGE_MAP[ext];
    if (lang) {
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
  }
  return counts;
}

function detectFrameworks(root: string, files: string[]): string[] {
  const frameworks: string[] = [];

  // Node / JS / TS frameworks via package.json
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
      ];
      for (const [dep, name] of checks) {
        if (dep in allDeps) frameworks.push(name);
      }
    }
  }

  // Python frameworks
  for (const pyFile of ["requirements.txt", "pyproject.toml"]) {
    const pyPath = join(root, pyFile);
    if (existsSync(pyPath)) {
      try {
        const content = readFileSync(pyPath, "utf-8").toLowerCase();
        if (content.includes("django")) frameworks.push("Django");
        if (content.includes("flask")) frameworks.push("Flask");
        if (content.includes("fastapi")) frameworks.push("FastAPI");
      } catch {
        // ignore
      }
    }
  }

  // .NET
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

  // Go
  if (fileExists(root, "go.mod")) frameworks.push("Go Modules");

  // Rust
  if (fileExists(root, "Cargo.toml")) frameworks.push("Rust/Cargo");

  return [...new Set(frameworks)];
}

function detectPackageManagers(root: string): string[] {
  const managers: string[] = [];
  if (fileExists(root, "package-lock.json")) managers.push("npm");
  if (fileExists(root, "yarn.lock")) managers.push("yarn");
  if (fileExists(root, "pnpm-lock.yaml")) managers.push("pnpm");
  if (fileExists(root, "requirements.txt") || fileExists(root, "Pipfile"))
    managers.push("pip");
  if (fileExists(root, "poetry.lock")) managers.push("poetry");
  if (fileExists(root, "*.csproj") || fileExists(root, "nuget.config"))
    managers.push("nuget");
  if (fileExists(root, "Cargo.lock")) managers.push("cargo");
  return managers;
}

function detectCiCd(root: string): string[] {
  const ci: string[] = [];
  if (fileExists(root, ".github", "workflows")) {
    try {
      const wfs = readdirSync(join(root, ".github", "workflows"));
      ci.push(`GitHub Actions (${wfs.length} workflow(s))`);
    } catch {
      ci.push("GitHub Actions");
    }
  }
  if (fileExists(root, "azure-pipelines.yml")) ci.push("Azure Pipelines");
  if (fileExists(root, "Jenkinsfile")) ci.push("Jenkins");
  if (fileExists(root, ".gitlab-ci.yml")) ci.push("GitLab CI");
  if (fileExists(root, ".circleci", "config.yml")) ci.push("CircleCI");
  return ci;
}

function detectCloud(root: string, files: string[]): string[] {
  const cloud: string[] = [];
  const hasExt = (ext: string) => files.some((f) => f.endsWith(ext));

  // Azure
  if (
    hasExt(".bicep") ||
    files.some((f) => f.endsWith(".json") && f.includes("arm")) ||
    fileExists(root, "azure.yaml")
  ) {
    cloud.push("Azure");
  }

  // AWS
  if (
    fileExists(root, "cdk.json") ||
    fileExists(root, "template.yaml") ||
    fileExists(root, "samconfig.toml")
  ) {
    cloud.push("AWS");
  }

  // GCP
  if (fileExists(root, "app.yaml") || fileExists(root, "cloudbuild.yaml")) {
    cloud.push("GCP");
  }

  return cloud;
}

function detectCopilotCustomizations(root: string): string[] {
  const found: string[] = [];
  const ghDir = join(root, ".github");

  if (!existsSync(ghDir)) return found;

  // copilot-instructions.md
  if (fileExists(ghDir, "copilot-instructions.md")) {
    found.push(".github/copilot-instructions.md");
  }

  // instructions/*.instructions.md
  const instrDir = join(ghDir, "instructions");
  if (existsSync(instrDir)) {
    try {
      for (const f of readdirSync(instrDir)) {
        if (f.endsWith(".instructions.md")) {
          found.push(`.github/instructions/${f}`);
        }
      }
    } catch {
      // ignore
    }
  }

  // prompts/*.prompt.md
  const promptsDir = join(ghDir, "prompts");
  if (existsSync(promptsDir)) {
    try {
      for (const f of readdirSync(promptsDir)) {
        if (f.endsWith(".prompt.md")) {
          found.push(`.github/prompts/${f}`);
        }
      }
    } catch {
      // ignore
    }
  }

  // skills/*/SKILL.md
  const skillsDir = join(ghDir, "skills");
  if (existsSync(skillsDir)) {
    try {
      for (const name of readdirSync(skillsDir)) {
        const skillPath = join(skillsDir, name);
        try {
          if (statSync(skillPath).isDirectory() && existsSync(join(skillPath, "SKILL.md"))) {
            found.push(`.github/skills/${name}/SKILL.md`);
          }
        } catch {
          // skip
        }
      }
    } catch {
      // ignore
    }
  }

  // agents/*.agent.md
  const agentsDir = join(ghDir, "agents");
  if (existsSync(agentsDir)) {
    try {
      for (const f of readdirSync(agentsDir)) {
        if (f.endsWith(".agent.md")) {
          found.push(`.github/agents/${f}`);
        }
      }
    } catch {
      // ignore
    }
  }

  return found;
}

function detectMcpConfigs(root: string): string[] {
  const configs: string[] = [];
  if (fileExists(root, ".vscode", "mcp.json"))
    configs.push(".vscode/mcp.json");
  if (fileExists(root, "mcp.json")) configs.push("mcp.json");
  return configs;
}

function formatSection(title: string, items: string[]): string {
  if (items.length === 0) return `## ${title}\nNone detected\n`;
  return `## ${title}\n${items.map((i) => `- ${i}`).join("\n")}\n`;
}

export function registerAnalyzeProjectTool(server: McpServer): void {
  server.tool(
    "analyze_project",
    "Analyze a project directory to detect languages, frameworks, dependencies, CI/CD, and existing Copilot customizations",
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
        statSync(projectPath).isDirectory();
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Path is not a valid directory: ${projectPath}`,
            },
          ],
        };
      }

      const files = collectFiles(projectPath, 0, 4);

      // Languages
      const langCounts = detectLanguages(files);
      const sortedLangs = [...langCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([lang, count]) => `${lang} (${count} files)`);

      // Frameworks
      const frameworks = detectFrameworks(projectPath, files);

      // Package managers
      const packageManagers = detectPackageManagers(projectPath);

      // CI/CD
      const cicd = detectCiCd(projectPath);

      // Cloud
      const cloud = detectCloud(projectPath, files);

      // Copilot customizations
      const copilot = detectCopilotCustomizations(projectPath);

      // MCP configs
      const mcp = detectMcpConfigs(projectPath);

      const summary = [
        `# Project Analysis: ${projectPath}\n`,
        formatSection("Languages", sortedLangs),
        formatSection("Frameworks", frameworks),
        formatSection("Package Managers", packageManagers),
        formatSection("CI/CD", cicd),
        formatSection("Cloud Providers", cloud),
        formatSection("Copilot Customizations", copilot),
        formatSection("MCP Configurations", mcp),
        `## Summary\nScanned ${files.length} files across the project.\n`,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: summary }],
      };
    },
  );
}
