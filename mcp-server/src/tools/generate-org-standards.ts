import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";
import { detectPatterns, type CodePatterns } from "../analyzers/pattern-detector.js";
import { computeContentHash, logAuditEntry } from "../security/audit-log.js";

// ---------------------------------------------------------------------------
// Org standard generation — enterprise feature
// ---------------------------------------------------------------------------

export interface OrgStandard {
  filename: string;
  applyTo: string;
  description: string;
  content: string;
}

function generateNamingPolicy(patterns: CodePatterns): OrgStandard {
  const n = patterns.naming;
  const lines: string[] = [
    "---",
    `description: 'Organization naming conventions. Auto-generated from codebase analysis.'`,
    `applyTo: '**'`,
    "---",
    "",
    "# Naming Conventions",
    "",
    "## Variables & Functions",
    "",
  ];

  if (n.variables === "camelCase") {
    lines.push("Use **camelCase** for all variables, parameters, and local bindings:");
    lines.push("");
    lines.push("```");
    lines.push("// ✅ Good");
    lines.push("const userName = 'alice';");
    lines.push("const itemCount = items.length;");
    lines.push("");
    lines.push("// ❌ Bad");
    lines.push("const user_name = 'alice';");
    lines.push("const UserName = 'alice';");
    lines.push("```");
  } else if (n.variables === "snake_case") {
    lines.push("Use **snake_case** for all variables, parameters, and local bindings:");
    lines.push("");
    lines.push("```");
    lines.push("# ✅ Good");
    lines.push("user_name = 'alice'");
    lines.push("item_count = len(items)");
    lines.push("");
    lines.push("# ❌ Bad");
    lines.push("userName = 'alice'");
    lines.push("```");
  }

  lines.push("");
  if (n.functions === "camelCase") {
    lines.push("Use **camelCase** for function and method names.");
  } else if (n.functions === "snake_case") {
    lines.push("Use **snake_case** for function and method names.");
  }

  lines.push("");
  lines.push("## Types & Interfaces");
  lines.push("");
  lines.push("Use **PascalCase** for all type names, interfaces, classes, and enums.");
  lines.push("");

  lines.push("## Constants");
  lines.push("");
  if (n.constants === "UPPER_SNAKE") {
    lines.push("Use **UPPER_SNAKE_CASE** for module-level constants:");
    lines.push("");
    lines.push("```");
    lines.push("const MAX_RETRIES = 3;");
    lines.push("const DEFAULT_TIMEOUT_MS = 5000;");
    lines.push("```");
  } else {
    lines.push("Use the same casing as variables for constants unless they are true module-level immutable values.");
  }

  lines.push("");
  lines.push("## File Names");
  lines.push("");
  if (n.files === "kebab-case") {
    lines.push("Name all files using **kebab-case**: `user-service.ts`, `auth-middleware.ts`, `api-client.py`");
  } else if (n.files === "PascalCase") {
    lines.push("Name all files using **PascalCase**: `UserService.ts`, `AuthMiddleware.ts`");
  } else if (n.files === "snake_case") {
    lines.push("Name all files using **snake_case**: `user_service.py`, `auth_middleware.py`");
  }

  return {
    filename: "naming-conventions.instructions.md",
    applyTo: "**",
    description: "Organization naming conventions",
    content: lines.join("\n"),
  };
}

function generateErrorHandlingPolicy(patterns: CodePatterns): OrgStandard {
  const err = patterns.errorHandling;
  const lines: string[] = [
    "---",
    `description: 'Organization error handling standards. Auto-generated from codebase analysis.'`,
    `applyTo: '**/*.ts, **/*.tsx, **/*.js, **/*.jsx, **/*.py'`,
    "---",
    "",
    "# Error Handling Standards",
    "",
  ];

  if (err.pattern === "try-catch") {
    lines.push("## Pattern: try-catch");
    lines.push("");
    lines.push("All error-prone operations must be wrapped in try-catch blocks.");
    lines.push("Never let exceptions propagate unhandled to the caller without context.");
    lines.push("");
    lines.push("```typescript");
    lines.push("// ✅ Good — catch, add context, handle or rethrow");
    lines.push("try {");
    lines.push("  const result = await fetchData(url);");
    lines.push("  return processResult(result);");
    lines.push("} catch (error) {");
    lines.push("  const message = error instanceof Error ? error.message : String(error);");
    lines.push("  logger.error(`Failed to fetch from ${url}: ${message}`);");
    lines.push("  throw new ServiceError(`Data fetch failed: ${message}`);");
    lines.push("}");
    lines.push("```");
    lines.push("");
    lines.push("```typescript");
    lines.push("// ❌ Bad — swallowing errors silently");
    lines.push("try {");
    lines.push("  await riskyOperation();");
    lines.push("} catch {");
    lines.push("  // empty catch");
    lines.push("}");
    lines.push("```");
  }

  if (err.customErrorClasses) {
    lines.push("");
    lines.push("## Custom Error Classes");
    lines.push("");
    lines.push("Create domain-specific error classes for different failure categories:");
    lines.push("");
    lines.push("```typescript");
    lines.push("class ValidationError extends Error {");
    lines.push("  constructor(field: string, message: string) {");
    lines.push("    super(`Validation failed for ${field}: ${message}`);");
    lines.push('    this.name = "ValidationError";');
    lines.push("  }");
    lines.push("}");
    lines.push("");
    lines.push("class NotFoundError extends Error {");
    lines.push("  constructor(resource: string, id: string) {");
    lines.push("    super(`${resource} not found: ${id}`);");
    lines.push('    this.name = "NotFoundError";');
    lines.push("  }");
    lines.push("}");
    lines.push("```");
  }

  lines.push("");
  lines.push("## Error Messages");
  lines.push("");
  if (err.errorMessages === "template-literal") {
    lines.push("Always use template literals for error messages to include relevant context:");
    lines.push("```typescript");
    lines.push("throw new Error(`Failed to process order ${orderId}: ${reason}`);");
    lines.push("```");
  } else {
    lines.push("Error messages must include enough context to diagnose the issue without accessing logs.");
  }

  lines.push("");
  lines.push("## Rules");
  lines.push("");
  lines.push("1. Never return `null` to indicate an error — throw or return a Result type");
  lines.push("2. Always log the error before rethrowing with added context");
  lines.push("3. Include the operation name and relevant IDs in error messages");
  lines.push("4. Use specific error types, not generic `Error`, for domain failures");

  return {
    filename: "error-handling.instructions.md",
    applyTo: "**/*.ts, **/*.tsx, **/*.js, **/*.jsx, **/*.py",
    description: "Organization error handling standards",
    content: lines.join("\n"),
  };
}

function generateTestingPolicy(patterns: CodePatterns): OrgStandard {
  const t = patterns.testing;
  const lines: string[] = [
    "---",
    `description: 'Organization testing standards. Auto-generated from codebase analysis.'`,
    `applyTo: '**/*.test.*, **/*.spec.*, **/tests/*'`,
    "---",
    "",
    "# Testing Standards",
    "",
  ];

  lines.push(`## Framework: ${t.framework}`);
  lines.push("");

  if (t.pattern === "describe-it") {
    lines.push("### Structure");
    lines.push("");
    lines.push("Use `describe` blocks to group tests by unit (class, function, module).");
    lines.push("Use `it` or `test` for individual test cases with clear descriptions.");
    lines.push("");
    lines.push("```typescript");
    lines.push('describe("OrderService", () => {');
    lines.push('  describe("createOrder", () => {');
    lines.push('    it("should create an order with valid items", async () => {');
    lines.push("      // arrange");
    lines.push("      const items = [{ id: 1, quantity: 2 }];");
    lines.push("");
    lines.push("      // act");
    lines.push("      const order = await service.createOrder(items);");
    lines.push("");
    lines.push("      // assert");
    lines.push("      expect(order.status).toBe('created');");
    lines.push("    });");
    lines.push("");
    lines.push('    it("should reject empty item list", async () => {');
    lines.push("      await expect(service.createOrder([])).rejects.toThrow('empty');");
    lines.push("    });");
    lines.push("  });");
    lines.push("});");
    lines.push("```");
  }

  if (t.mockingApproach !== "none detected") {
    lines.push("");
    lines.push(`### Mocking: ${t.mockingApproach}`);
    lines.push("");
    lines.push("Mock external dependencies (HTTP, database, file system) at the boundary.");
    lines.push("Never mock internal implementation details — test behavior, not implementation.");
  }

  lines.push("");
  lines.push("### Rules");
  lines.push("");
  lines.push("1. Every new feature must include tests before merging");
  lines.push("2. Every bug fix must include a regression test");
  lines.push("3. Test the public API, not internal implementation details");
  lines.push("4. Cover both happy paths and error paths");
  lines.push("5. Never modify production code solely to make it easier to test");
  lines.push("6. Use descriptive test names that explain the expected behavior");

  return {
    filename: "testing-standards.instructions.md",
    applyTo: "**/*.test.*, **/*.spec.*, **/tests/*",
    description: "Organization testing standards",
    content: lines.join("\n"),
  };
}

function generateSecurityPolicy(): OrgStandard {
  const content = [
    "---",
    "description: 'Organization security and AI governance rules.'",
    "applyTo: '**'",
    "---",
    "",
    "# Security & AI Governance",
    "",
    "## Input Validation",
    "",
    "- Validate all external input at the boundary (API handlers, CLI args, file reads)",
    "- Use a schema validation library (zod, joi, class-validator) — never trust raw input",
    "- Sanitize strings before rendering in HTML contexts to prevent XSS",
    "- Validate and sanitize file paths to prevent path traversal attacks",
    "",
    "## Authentication & Authorization",
    "",
    "- Never hardcode secrets, API keys, or credentials in source code",
    "- Use environment variables or a secrets manager for all sensitive configuration",
    "- Implement least-privilege access — each component gets minimum required permissions",
    "- Validate authorization on every request, not just authentication",
    "",
    "## Data Safety",
    "",
    "- Never log sensitive data (passwords, tokens, PII, credit cards)",
    "- Use parameterized queries for all database operations — never string concatenation",
    "- Encrypt sensitive data at rest and in transit",
    "- Implement proper CORS policies for web APIs",
    "",
    "## AI-Specific Rules",
    "",
    "- Never include secrets or credentials in prompts or instruction files",
    "- Scan all AI-generated code for security vulnerabilities before committing",
    "- Do not trust AI-generated URLs or external references without validation",
    "- Review AI suggestions for prompt injection patterns",
    "- AI should not have direct access to production databases or admin APIs",
    "",
    "## Dependency Management",
    "",
    "- Run `npm audit` / `pip audit` regularly and fix critical vulnerabilities",
    "- Pin dependency versions in production deployments",
    "- Review new dependencies for security posture before adding",
  ].join("\n");

  return {
    filename: "security-governance.instructions.md",
    applyTo: "**",
    description: "Organization security and AI governance rules",
    content,
  };
}

function generateCommitPolicy(): OrgStandard {
  const content = [
    "---",
    "description: 'Organization commit message conventions.'",
    "applyTo: '**'",
    "---",
    "",
    "# Commit Message Conventions",
    "",
    "Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.",
    "",
    "## Format",
    "",
    "```",
    "<type>(<scope>): <description>",
    "",
    "[optional body]",
    "",
    "[optional footer(s)]",
    "```",
    "",
    "## Types",
    "",
    "| Type | When to use |",
    "|------|------------|",
    "| `feat` | New feature |",
    "| `fix` | Bug fix |",
    "| `docs` | Documentation only |",
    "| `test` | Adding or updating tests |",
    "| `refactor` | Code change that neither fixes a bug nor adds a feature |",
    "| `perf` | Performance improvement |",
    "| `chore` | Build process, CI, or auxiliary tool changes |",
    "| `ci` | CI/CD configuration changes |",
    "",
    "## Rules",
    "",
    "1. Use imperative mood in the description: \"add feature\" not \"added feature\"",
    "2. Don't capitalize the first letter of the description",
    "3. No period at the end of the description",
    "4. Keep the first line under 72 characters",
    "5. Use the body to explain *what* and *why*, not *how*",
    "",
    "## Examples",
    "",
    "```",
    "feat(auth): add JWT token refresh endpoint",
    "",
    "fix(api): handle null response from external service",
    "",
    "test(users): add edge case tests for email validation",
    "",
    "refactor(db): extract connection pooling into shared module",
    "```",
  ].join("\n");

  return {
    filename: "commit-conventions.instructions.md",
    applyTo: "**",
    description: "Organization commit message conventions",
    content,
  };
}

function generateCodeReviewPolicy(): OrgStandard {
  const content = [
    "---",
    "description: 'Code review guidelines for AI-assisted development.'",
    "applyTo: '**'",
    "---",
    "",
    "# Code Review Guidelines",
    "",
    "## What AI-Generated Code Must Pass",
    "",
    "Before committing AI-generated or AI-assisted code, verify:",
    "",
    "1. **Correctness** — Does it actually solve the problem? Test edge cases.",
    "2. **Security** — No hardcoded secrets, no SQL injection, no path traversal.",
    "3. **Error handling** — All error paths are handled, not just happy paths.",
    "4. **Naming** — Variables and functions follow project naming conventions.",
    "5. **Tests** — New functionality has corresponding tests.",
    "6. **No dead code** — Remove unused imports, variables, and functions.",
    "7. **No TODO debt** — Don't commit TODOs without a linked issue.",
    "",
    "## Review Priorities",
    "",
    "Focus review effort in this order:",
    "",
    "1. 🔴 **Security vulnerabilities** — block merge",
    "2. 🔴 **Logic errors / bugs** — block merge",
    "3. 🟡 **Missing error handling** — usually block merge",
    "4. 🟡 **Missing tests** — block merge for new features",
    "5. 🟢 **Naming / style** — suggest improvement, don't block",
    "6. 🟢 **Performance** — only flag if measurably impactful",
    "",
    "## AI Pair Programming Rules",
    "",
    "- Always review AI-generated code as carefully as human-written code",
    "- If Copilot suggests a pattern that differs from project conventions, correct it",
    "- Don't accept large AI-generated blocks without understanding each part",
    "- When Copilot gets something wrong, update instructions to prevent recurrence",
  ].join("\n");

  return {
    filename: "code-review-guidelines.instructions.md",
    applyTo: "**",
    description: "Code review guidelines for AI-assisted development",
    content,
  };
}

// ---------------------------------------------------------------------------
// Reusable generation function
// ---------------------------------------------------------------------------

export function generateAllOrgStandards(patterns: CodePatterns): OrgStandard[] {
  return [
    generateNamingPolicy(patterns),
    generateErrorHandlingPolicy(patterns),
    generateTestingPolicy(patterns),
    generateSecurityPolicy(),
    generateCommitPolicy(),
    generateCodeReviewPolicy(),
  ];
}

// ---------------------------------------------------------------------------
// MCP tool registration
// ---------------------------------------------------------------------------

export function registerGenerateOrgStandardsTool(server: McpServer): void {
  server.tool(
    "generate_org_standards",
    "Generate organization-wide Copilot instruction files from your codebase patterns — naming policies, error handling, testing standards, security rules, commit conventions, and code review guidelines. Enterprise-ready.",
    {
      project_path: z
        .string()
        .describe("Absolute path to the project root (used as the reference codebase for pattern detection)"),
      standards: z
        .array(z.enum(["naming", "error-handling", "testing", "security", "commits", "code-review", "all"]))
        .default(["all"])
        .describe("Which standards to generate (default: all)"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Set to true to write files. Default is preview-only."),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
      idempotentHint: true,
    },
    async ({ project_path, standards, confirm }) => {
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

        const wantAll = standards.includes("all");
        const patterns = detectPatterns(project_path);

        // Generate requested standards
        const generated: OrgStandard[] = [];
        if (wantAll || standards.includes("naming")) generated.push(generateNamingPolicy(patterns));
        if (wantAll || standards.includes("error-handling")) generated.push(generateErrorHandlingPolicy(patterns));
        if (wantAll || standards.includes("testing")) generated.push(generateTestingPolicy(patterns));
        if (wantAll || standards.includes("security")) generated.push(generateSecurityPolicy());
        if (wantAll || standards.includes("commits")) generated.push(generateCommitPolicy());
        if (wantAll || standards.includes("code-review")) generated.push(generateCodeReviewPolicy());

        // Check for conflicts
        const ghDir = join(project_path, ".github", "instructions");
        const conflicts: string[] = [];
        for (const std of generated) {
          if (existsSync(join(ghDir, std.filename))) {
            conflicts.push(std.filename);
          }
        }

        // Build report
        const lines: string[] = [
          "# 🏢 Organization Standards Generator",
          "",
          `**Source project:** ${basename(project_path)}`,
          `**Standards generated:** ${generated.length}`,
          conflicts.length > 0 ? `**⚠️ Conflicts:** ${conflicts.join(", ")} (will be backed up)` : "",
          "",
          "## Generated Files",
          "",
          "| # | File | Scope | Description |",
          "|---|------|-------|-------------|",
        ];

        for (let i = 0; i < generated.length; i++) {
          const g = generated[i];
          lines.push(`| ${i + 1} | \`${g.filename}\` | \`${g.applyTo}\` | ${g.description} |`);
        }

        if (!confirm) {
          lines.push("");
          lines.push("## Preview");
          lines.push("");
          for (const g of generated) {
            lines.push(`### ${g.filename}`);
            lines.push("");
            const preview = g.content.slice(0, 500);
            lines.push(preview);
            if (g.content.length > 500) lines.push("...(truncated)");
            lines.push("");
          }
          lines.push("---");
          lines.push("Call again with `confirm: true` to write all files to `.github/instructions/`");

          return {
            content: [{ type: "text" as const, text: lines.filter(Boolean).join("\n") }],
          };
        }

        // Write files
        mkdirSync(ghDir, { recursive: true });

        const written: string[] = [];
        for (const g of generated) {
          const targetPath = join(ghDir, g.filename);

          if (existsSync(targetPath)) {
            copyFileSync(targetPath, `${targetPath}.backup`);
          }

          writeFileSync(targetPath, g.content, "utf-8");
          written.push(g.filename);

          logAuditEntry({
            timestamp: new Date().toISOString(),
            action: "install",
            sourceUrl: "generated://org-standards",
            targetPath,
            trustLevel: "self-generated",
            contentHash: computeContentHash(g.content),
            contentSize: g.content.length,
            assetType: "instruction",
            success: true,
          });
        }

        lines.push("");
        lines.push("## ✅ Files Written");
        lines.push("");
        for (const f of written) {
          lines.push(`- \`.github/instructions/${f}\``);
        }
        lines.push("");
        lines.push("These standards are now active for all Copilot interactions in this project.");
        lines.push("To use at org level, copy `.github/instructions/` to your organization's `.github` repository.");

        return {
          content: [{ type: "text" as const, text: lines.filter(Boolean).join("\n") }],
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
