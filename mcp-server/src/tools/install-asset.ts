import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mkdirSync, existsSync, writeFileSync, copyFileSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { validateUrl, getTrustLevel } from "../security/trusted-sources.js";
import { validateContent } from "../security/content-validator.js";
import { validateTargetPath, sanitizeFilename } from "../security/path-safety.js";
import { logAuditEntry, computeContentHash } from "../security/audit-log.js";

function toRawUrl(url: string): string {
  return url
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/blob/", "/");
}

function getTargetPath(
  projectRoot: string,
  assetType: string,
  url: string
): string {
  const filename = basename(url.split("?")[0]);

  switch (assetType) {
    case "instruction":
      return join(projectRoot, ".github", "instructions", filename);
    case "prompt":
      return join(projectRoot, ".github", "prompts", filename);
    case "skill": {
      const folderName = filename.replace(/\.[^.]+$/, "");
      return join(projectRoot, ".github", "skills", folderName, "SKILL.md");
    }
    case "agent":
      return join(projectRoot, ".github", "agents", filename);
    default:
      return join(projectRoot, ".github", filename);
  }
}

export function registerInstallAssetTool(server: McpServer): void {
  server.tool(
    "install_asset",
    "Download a Copilot asset from GitHub and install it into your project's .github/ folder",
    {
      url: z.string().describe("GitHub URL to the asset file"),
      target_project: z
        .string()
        .describe("Absolute path to the target project root"),
      asset_type: z
        .enum(["instruction", "prompt", "skill", "agent"])
        .describe("Type of asset to install"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to actually write files"),
      dry_run: z
        .boolean()
        .default(false)
        .describe("Show what would happen without any writes or fetches"),
      force: z
        .boolean()
        .default(false)
        .describe("Allow installing from unknown trust sources"),
    },
    {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
      idempotentHint: true,
    },
    async (params) => {
      try {
        // 1. Validate URL
        const urlCheck = validateUrl(params.url);
        if (!urlCheck.valid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `❌ Invalid URL: ${urlCheck.reason}`,
              },
            ],
          };
        }

        // 2. Check trust level
        const trust = getTrustLevel(params.url);
        if (trust.level === "unknown" && !params.force) {
          return {
            content: [
              {
                type: "text" as const,
                text: `❌ Blocked: ${trust.reason}\nSource trust level: ${trust.badge} ${trust.level}\nUse force: true to override.`,
              },
            ],
          };
        }

        // 3. Compute and validate target path
        const rawFilename = basename(params.url.split("?")[0]);
        const safeFilename = sanitizeFilename(rawFilename);
        const targetPath = getTargetPath(
          params.target_project,
          params.asset_type,
          params.url.replace(rawFilename, safeFilename)
        );

        const pathCheck = validateTargetPath(params.target_project, targetPath);
        if (!pathCheck.valid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `❌ Path rejected: ${pathCheck.error}`,
              },
            ],
          };
        }

        // 4. Dry run — return preview without fetching
        if (params.dry_run) {
          return {
            content: [
              {
                type: "text" as const,
                text: [
                  "🔍 Dry run preview:",
                  `  Source: ${params.url}`,
                  `  Target: ${pathCheck.resolvedPath}`,
                  `  Trust:  ${trust.badge} ${trust.level} — ${trust.reason}`,
                  `  Asset type: ${params.asset_type}`,
                  "",
                  "No files were fetched or written.",
                ].join("\n"),
              },
            ],
          };
        }

        // 5. Fetch content
        const rawUrl = params.url.includes("raw.githubusercontent.com")
          ? params.url
          : toRawUrl(params.url);

        const res = await fetch(rawUrl);
        if (!res.ok) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to fetch asset: HTTP ${res.status} ${res.statusText}\nURL: ${rawUrl}`,
              },
            ],
          };
        }

        const content = await res.text();

        // 6. Validate content
        const validation = validateContent(content, params.asset_type);

        // 7. Compute content hash
        const contentHash = computeContentHash(content);

        // 8. Preview mode (confirm is false)
        if (!params.confirm) {
          const preview = content.slice(0, 500);
          const lines = [
            "📋 Install preview (call again with confirm: true to install):",
            "",
            `  Trust:  ${trust.badge} ${trust.level}`,
            `  Target: ${pathCheck.resolvedPath}`,
            `  Hash:   sha256:${contentHash}`,
            `  Size:   ${content.length} bytes`,
          ];

          if (validation.errors.length > 0) {
            lines.push("", "❌ Validation errors:");
            for (const e of validation.errors) lines.push(`  • ${e}`);
          }
          if (validation.warnings.length > 0) {
            lines.push("", "⚠️ Warnings:");
            for (const w of validation.warnings) lines.push(`  • ${w}`);
          }

          lines.push("", "--- Content preview ---", preview);
          if (content.length > 500) lines.push("... (truncated)");

          logAuditEntry({
            timestamp: new Date().toISOString(),
            action: "preview",
            sourceUrl: params.url,
            targetPath: pathCheck.resolvedPath,
            trustLevel: trust.level,
            contentHash,
            contentSize: content.length,
            assetType: params.asset_type,
            success: true,
          });

          return {
            content: [
              {
                type: "text" as const,
                text: lines.join("\n"),
              },
            ],
          };
        }

        // 9. Confirmed install — write file
        mkdirSync(dirname(pathCheck.resolvedPath), { recursive: true });

        let backedUp = false;
        if (existsSync(pathCheck.resolvedPath)) {
          const backupPath = `${pathCheck.resolvedPath}.backup`;
          copyFileSync(pathCheck.resolvedPath, backupPath);
          backedUp = true;
        }

        writeFileSync(pathCheck.resolvedPath, content, "utf-8");

        logAuditEntry({
          timestamp: new Date().toISOString(),
          action: "install",
          sourceUrl: params.url,
          targetPath: pathCheck.resolvedPath,
          trustLevel: trust.level,
          contentHash,
          contentSize: content.length,
          assetType: params.asset_type,
          success: true,
        });

        const message = backedUp
          ? `✅ Asset installed successfully!\nPath: ${pathCheck.resolvedPath}\nHash: sha256:${contentHash}\nNote: Existing file was backed up to ${pathCheck.resolvedPath}.backup`
          : `✅ Asset installed successfully!\nPath: ${pathCheck.resolvedPath}\nHash: sha256:${contentHash}`;

        return {
          content: [
            {
              type: "text" as const,
              text: message,
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error installing asset: ${message}\nPlease verify the URL and target project path are correct.`,
            },
          ],
        };
      }
    }
  );
}
