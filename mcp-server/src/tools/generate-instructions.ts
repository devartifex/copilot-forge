import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync, readFileSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";
import { detectPatterns, type CodePatterns } from "../analyzers/pattern-detector.js";
import { computeContentHash, logAuditEntry } from "../security/audit-log.js";

// ---------------------------------------------------------------------------
// Instruction generation from detected patterns
// ---------------------------------------------------------------------------

function generateProjectHeader(projectPath: string): string {
  const name = basename(projectPath);
  let description = "";

  const pkgPath = join(projectPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.description) description = pkg.description;
    } catch {
      /* skip */
    }
  }

  let header = `# ${name} — Copilot Instructions\n\n`;
  if (description) header += `> ${description}\n\n`;
  return header;
}

function generateLanguageSection(patterns: CodePatterns, projectPath: string): string {
  const deps = patterns.dependencies;
  const lines: string[] = ["## Language & Runtime\n"];

  const pkgPath = join(projectPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const isTS = "typescript" in allDeps;
      const isESM = pkg.type === "module";

      if (isTS) {
        const tsVer = allDeps["typescript"] ?? "";
        lines.push(`- **TypeScript**${tsVer ? ` (${tsVer})` : ""}`);
      } else {
        lines.push("- **JavaScript**");
      }

      if (isESM) {
        lines.push('- ESM modules (`"type": "module"` in package.json)');
      } else {
        lines.push("- CommonJS modules");
      }

      if (pkg.engines?.node) {
        lines.push(`- Node.js ${pkg.engines.node}`);
      }
    } catch {
      /* skip */
    }
  }

  // Python detection
  if (existsSync(join(projectPath, "requirements.txt")) || existsSync(join(projectPath, "pyproject.toml"))) {
    lines.push("- **Python**");
  }

  if (deps.preferredLibraries.size > 0) {
    lines.push("");
    lines.push("### Key Dependencies");
    lines.push("");
    for (const [category, lib] of deps.preferredLibraries) {
      lines.push(`- **${category}:** ${lib}`);
    }
  }

  return lines.join("\n") + "\n";
}

function generateNamingSection(patterns: CodePatterns): string {
  const n = patterns.naming;
  const lines: string[] = ["## Naming Conventions\n"];

  lines.push("| Element | Convention |");
  lines.push("|---------|-----------|");
  lines.push(`| Variables | ${n.variables} |`);
  lines.push(`| Functions | ${n.functions} |`);
  lines.push(`| Files | ${n.files} |`);
  lines.push(`| Constants | ${n.constants} |`);
  lines.push(`| Types/Interfaces | ${n.types} |`);

  lines.push("");

  if (n.variables === "camelCase") {
    lines.push("Use camelCase for all variables and local bindings:");
    lines.push("```");
    lines.push("const userName = 'alice';");
    lines.push("let requestCount = 0;");
    lines.push("```");
  } else if (n.variables === "snake_case") {
    lines.push("Use snake_case for all variables and local bindings:");
    lines.push("```");
    lines.push("const user_name = 'alice';");
    lines.push("let request_count = 0;");
    lines.push("```");
  }

  if (n.constants === "UPPER_SNAKE") {
    lines.push("");
    lines.push("Use UPPER_SNAKE_CASE for module-level constants:");
    lines.push("```");
    lines.push("const MAX_RETRIES = 3;");
    lines.push("const DEFAULT_TIMEOUT_MS = 5000;");
    lines.push("```");
  }

  if (n.files === "kebab-case") {
    lines.push("");
    lines.push("Name files using kebab-case: `user-service.ts`, `auth-middleware.ts`");
  } else if (n.files === "PascalCase") {
    lines.push("");
    lines.push("Name files using PascalCase: `UserService.ts`, `AuthMiddleware.ts`");
  } else if (n.files === "camelCase") {
    lines.push("");
    lines.push("Name files using camelCase: `userService.ts`, `authMiddleware.ts`");
  }

  return lines.join("\n") + "\n";
}

function generateImportSection(patterns: CodePatterns): string {
  const imp = patterns.imports;
  const lines: string[] = ["## Import Conventions\n"];

  if (imp.type === "named") {
    lines.push("Prefer named imports over default imports:");
    lines.push("```typescript");
    lines.push('import { createServer, type ServerOptions } from "./server.js";');
    lines.push("```");
  } else if (imp.type === "default") {
    lines.push("Use default imports where available:");
    lines.push("```typescript");
    lines.push('import express from "express";');
    lines.push("```");
  }

  if (imp.fileExtensions) {
    lines.push("");
    lines.push("Always include file extensions in local imports (required by NodeNext resolution):");
    lines.push("```typescript");
    lines.push('import { helper } from "./utils/helper.js";');
    lines.push('import type { Config } from "../types.js";');
    lines.push("```");
    lines.push("Never use extensionless imports for local files.");
  }

  if (imp.useBarrelExports) {
    lines.push("");
    lines.push("Use barrel exports (index files) for public module APIs.");
  }

  if (imp.pathAliases) {
    lines.push("");
    lines.push("Use path aliases (`@/` or `~/`) for deep imports instead of long relative paths.");
  }

  if (imp.sortImports) {
    lines.push("");
    lines.push("Keep imports sorted: external packages first, then local modules.");
  }

  return lines.join("\n") + "\n";
}

function generateErrorHandlingSection(patterns: CodePatterns): string {
  const err = patterns.errorHandling;
  const lines: string[] = ["## Error Handling\n"];

  if (err.pattern === "try-catch") {
    lines.push("Use try-catch blocks for error handling. Never let exceptions propagate unhandled.");
    lines.push("");
    lines.push("```typescript");
    lines.push("try {");
    lines.push("  const result = await riskyOperation();");
    lines.push("  return result;");
    lines.push("} catch (error) {");
    lines.push('  const message = error instanceof Error ? error.message : String(error);');
    lines.push("  // handle or rethrow with context");
    lines.push("}");
    lines.push("```");
  } else if (err.pattern === "result-type") {
    lines.push("Use Result/Either types for error handling instead of exceptions.");
    lines.push("Return error values rather than throwing.");
  }

  if (err.customErrorClasses) {
    lines.push("");
    lines.push("Define custom error classes for domain-specific errors:");
    lines.push("```typescript");
    lines.push("class ValidationError extends Error {");
    lines.push('  constructor(message: string) { super(message); this.name = "ValidationError"; }');
    lines.push("}");
    lines.push("```");
  }

  if (err.errorMessages === "template-literal") {
    lines.push("");
    lines.push("Use template literals for error messages:");
    lines.push("```typescript");
    lines.push("throw new Error(`Failed to process ${item.id}: ${reason}`);");
    lines.push("```");
  }

  return lines.join("\n") + "\n";
}

function generateFunctionSection(patterns: CodePatterns): string {
  const fn = patterns.functions;
  const lines: string[] = ["## Function Style\n"];

  if (fn.preferred === "arrow") {
    lines.push("Prefer arrow functions for all function expressions and module-level functions:");
    lines.push("```typescript");
    lines.push("const processItem = (item: Item): Result => {");
    lines.push("  // ...");
    lines.push("};");
    lines.push("```");
  } else if (fn.preferred === "declaration") {
    lines.push("Use function declarations for named functions:");
    lines.push("```typescript");
    lines.push("function processItem(item: Item): Result {");
    lines.push("  // ...");
    lines.push("}");
    lines.push("```");
  }

  if (fn.asyncPattern === "async-await") {
    lines.push("");
    lines.push("Always use async/await for asynchronous code. Never use raw `.then()` chains or callbacks.");
  }

  if (fn.earlyReturns) {
    lines.push("");
    lines.push("Use early returns (guard clauses) to reduce nesting:");
    lines.push("```typescript");
    lines.push("function process(input: string | undefined): string {");
    lines.push('  if (!input) return "";');
    lines.push("  if (input.length > MAX) return input.slice(0, MAX);");
    lines.push("  return transform(input);");
    lines.push("}");
    lines.push("```");
  }

  return lines.join("\n") + "\n";
}

function generateTestingSection(patterns: CodePatterns): string {
  const t = patterns.testing;
  if (t.framework === "unknown" && t.pattern === "none") return "";

  const lines: string[] = ["## Testing\n"];

  lines.push(`- **Framework:** ${t.framework}`);

  if (t.pattern === "describe-it") {
    lines.push("- Use `describe` blocks to group related tests, `it`/`test` for individual cases");
    lines.push("```typescript");
    lines.push('describe("UserService", () => {');
    lines.push('  it("should create a user with valid input", () => {');
    lines.push("    // ...");
    lines.push("  });");
    lines.push("});");
    lines.push("```");
  } else if (t.pattern === "test-only") {
    lines.push("- Use flat `test()` blocks without nesting");
  }

  if (t.mockingApproach !== "none detected") {
    lines.push(`- Mock external dependencies using ${t.mockingApproach}`);
  }

  lines.push("- Write tests for all new features and bug fixes");
  lines.push("- Cover edge cases and error paths");
  lines.push("- Never modify production code solely to make it easier to test");

  return lines.join("\n") + "\n";
}

function generateCodeStyleSection(patterns: CodePatterns): string {
  const cs = patterns.codeStyle;
  const lines: string[] = ["## Code Style\n"];

  const rules: string[] = [];
  if (cs.semicolons) rules.push("Use semicolons at the end of statements");
  else rules.push("Omit semicolons (no-semi style)");

  if (cs.quotes === "single") rules.push("Use single quotes for strings");
  else if (cs.quotes === "double") rules.push("Use double quotes for strings");

  if (cs.trailingCommas) rules.push("Use trailing commas in multi-line objects, arrays, and parameters");
  else rules.push("No trailing commas");

  if (cs.indentation === "2-spaces") rules.push("Indent with 2 spaces");
  else if (cs.indentation === "4-spaces") rules.push("Indent with 4 spaces");
  else if (cs.indentation === "tabs") rules.push("Indent with tabs");

  for (const rule of rules) {
    lines.push(`- ${rule}`);
  }

  lines.push("- Do not add comments unless logic is genuinely non-obvious");
  lines.push("- Keep functions focused and short");

  return lines.join("\n") + "\n";
}

function generateArchitectureSection(patterns: CodePatterns): string {
  const arch = patterns.architecture;
  const fo = patterns.fileOrganization;
  const lines: string[] = ["## Architecture & File Organization\n"];

  if (arch.pattern === "layer-based") {
    lines.push("This project follows a **layer-based** architecture (controllers, services, models, etc.).");
    lines.push("Keep each layer in its own directory. Dependencies flow downward: controllers → services → models.");
  } else if (arch.pattern === "feature-based") {
    lines.push("This project follows a **feature-based** architecture.");
    lines.push("Group all related files (component, service, test, types) by feature, not by file type.");
  }

  lines.push("");
  lines.push("### Directory Structure");
  lines.push("");
  lines.push(`- Source code: \`${fo.sourceDir}/\``);
  lines.push(`- Tests: \`${fo.testDir}/\``);

  if (fo.testNaming === "co-located") {
    lines.push("- Tests are co-located with source files (e.g., `user.ts` and `user.test.ts` in the same directory)");
  } else if (fo.testNaming === "separate-dir") {
    lines.push(`- Tests are in a separate \`${fo.testDir}/\` directory mirroring the source structure`);
  }

  if (fo.indexFiles) {
    lines.push("- Use `index.ts` barrel files for public module APIs");
  }

  return lines.join("\n") + "\n";
}

function generateBuildSection(projectPath: string): string {
  const lines: string[] = ["## Build & Run\n"];
  lines.push("```bash");

  const pkgPath = join(projectPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const scripts = pkg.scripts ?? {};
      if (scripts.build) lines.push(`npm run build    # ${scripts.build}`);
      if (scripts.dev) lines.push(`npm run dev      # ${scripts.dev}`);
      if (scripts.start) lines.push(`npm run start    # ${scripts.start}`);
      if (scripts.test) lines.push(`npm run test     # ${scripts.test}`);
      if (scripts.lint) lines.push(`npm run lint     # ${scripts.lint}`);
    } catch {
      /* skip */
    }
  } else if (existsSync(join(projectPath, "Makefile"))) {
    lines.push("make build");
    lines.push("make test");
  }

  lines.push("```");
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------

export function generateInstructionsContent(
  projectPath: string,
  patterns: CodePatterns,
): string {
  const sections = [
    generateProjectHeader(projectPath),
    generateLanguageSection(patterns, projectPath),
    generateNamingSection(patterns),
    generateImportSection(patterns),
    generateErrorHandlingSection(patterns),
    generateFunctionSection(patterns),
    generateTestingSection(patterns),
    generateCodeStyleSection(patterns),
    generateArchitectureSection(patterns),
    generateBuildSection(projectPath),
  ];

  return sections.filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// MCP tool registration
// ---------------------------------------------------------------------------

export function registerGenerateInstructionsTool(server: McpServer): void {
  server.tool(
    "generate_instructions",
    "Deep-scan your codebase and generate a project-specific copilot-instructions.md — detects naming conventions, error handling, import style, testing patterns, architecture, and more",
    {
      project_path: z
        .string()
        .describe("Absolute path to the project root"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Set to true to write the file. Default is preview-only."),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
      idempotentHint: true,
    },
    async ({ project_path, confirm }) => {
      try {
        if (!existsSync(project_path)) {
          return {
            content: [{
              type: "text" as const,
              text: `Error: project path does not exist: ${project_path}`,
            }],
            isError: true,
          };
        }

        // 1. Detect patterns
        const patterns = detectPatterns(project_path);

        // 2. Generate instructions content
        const content = generateInstructionsContent(project_path, patterns);

        // 3. Build analysis summary
        const analysis = [
          "## 🔬 Codebase Analysis",
          "",
          "| Category | Detected |",
          "|----------|----------|",
          `| Variables | ${patterns.naming.variables} |`,
          `| Functions | ${patterns.naming.functions} |`,
          `| Files | ${patterns.naming.files} |`,
          `| Constants | ${patterns.naming.constants} |`,
          `| Error handling | ${patterns.errorHandling.pattern} |`,
          `| Custom errors | ${patterns.errorHandling.customErrorClasses ? "yes" : "no"} |`,
          `| Import style | ${patterns.imports.type} |`,
          `| File extensions | ${patterns.imports.fileExtensions ? "yes" : "no"} |`,
          `| Function style | ${patterns.functions.preferred} |`,
          `| Async pattern | ${patterns.functions.asyncPattern} |`,
          `| Early returns | ${patterns.functions.earlyReturns ? "yes" : "no"} |`,
          `| Test framework | ${patterns.testing.framework} |`,
          `| Test pattern | ${patterns.testing.pattern} |`,
          `| Architecture | ${patterns.architecture.pattern} |`,
          `| Semicolons | ${patterns.codeStyle.semicolons ? "yes" : "no"} |`,
          `| Quotes | ${patterns.codeStyle.quotes} |`,
          `| Indentation | ${patterns.codeStyle.indentation} |`,
          "",
        ].join("\n");

        if (!confirm) {
          const preview = content.slice(0, 2000);
          return {
            content: [{
              type: "text" as const,
              text: [
                "# 📋 Generate Instructions — Preview",
                "",
                analysis,
                "## Generated Content Preview",
                "",
                preview,
                content.length > 2000 ? "\n... (truncated, full file is " + content.length + " chars)" : "",
                "",
                "---",
                "Call again with `confirm: true` to write to `.github/copilot-instructions.md`",
              ].join("\n"),
            }],
          };
        }

        // 4. Write the file
        const targetDir = join(project_path, ".github");
        const targetPath = join(targetDir, "copilot-instructions.md");

        mkdirSync(targetDir, { recursive: true });

        // Backup existing file
        let backedUp = false;
        if (existsSync(targetPath)) {
          copyFileSync(targetPath, `${targetPath}.backup`);
          backedUp = true;
        }

        writeFileSync(targetPath, content, "utf-8");

        const hash = computeContentHash(content);
        logAuditEntry({
          timestamp: new Date().toISOString(),
          action: "install",
          sourceUrl: "generated://pattern-detector",
          targetPath,
          trustLevel: "self-generated",
          contentHash: hash,
          contentSize: content.length,
          assetType: "instruction",
          success: true,
        });

        return {
          content: [{
            type: "text" as const,
            text: [
              "# ✅ Instructions Generated Successfully",
              "",
              analysis,
              `**Written to:** \`${targetPath}\``,
              `**Size:** ${content.length} chars`,
              `**Hash:** sha256:${hash}`,
              backedUp ? `**Backup:** Previous file saved to \`${targetPath}.backup\`` : "",
              "",
              "Your Copilot now understands your codebase conventions!",
            ].filter(Boolean).join("\n"),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
        };
      }
    },
  );
}
