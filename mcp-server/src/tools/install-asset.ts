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
    "Download Copilot asset(s) from GitHub and install into the project's .github/ folder. Supports single or batch install.",
    {
      url: z.string().optional().describe("GitHub URL to a single asset file (use this OR assets, not both)"),
      assets: z
        .array(
          z.object({
            url: z.string().describe("GitHub URL to the asset file"),
            asset_type: z
              .enum(["instruction", "prompt", "skill", "agent"])
              .describe("Type of asset"),
          }),
        )
        .optional()
        .describe("Array of assets for batch install (use this OR url, not both)"),
      target_project: z
        .string()
        .describe("Absolute path to the target project root"),
      asset_type: z
        .enum(["instruction", "prompt", "skill", "agent"])
        .optional()
        .describe("Type of asset (required when using single url)"),
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
        // Normalize to array of items
        const items: Array<{ url: string; asset_type: string }> = [];

        if (params.assets && params.assets.length > 0) {
          items.push(...params.assets);
        } else if (params.url && params.asset_type) {
          items.push({ url: params.url, asset_type: params.asset_type });
        } else {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Provide either 'url' + 'asset_type' for single install, or 'assets' array for batch install.",
              },
            ],
          };
        }

        // Phase 1: Pre-validate all items synchronously
        type ValidatedItem = {
          item: { url: string; asset_type: string };
          trust: ReturnType<typeof getTrustLevel>;
          resolvedPath: string;
          rawUrl: string;
        };

        const validated: ValidatedItem[] = [];
        const results: string[] = [];

        for (const item of items) {
          const urlCheck = validateUrl(item.url);
          if (!urlCheck.valid) {
            results.push(`❌ ${item.url}: Invalid URL — ${urlCheck.reason}`);
            continue;
          }

          const trust = getTrustLevel(item.url);
          if (trust.level === "unknown" && !params.force) {
            results.push(`❌ ${item.url}: Blocked — ${trust.reason} (use force: true to override)`);
            continue;
          }

          const rawFilename = basename(item.url.split("?")[0]);
          const safeFilename = sanitizeFilename(rawFilename);
          const targetPath = getTargetPath(
            params.target_project,
            item.asset_type,
            item.url.replace(rawFilename, safeFilename)
          );

          const pathCheck = validateTargetPath(params.target_project, targetPath);
          if (!pathCheck.valid) {
            results.push(`❌ ${item.url}: Path rejected — ${pathCheck.error}`);
            continue;
          }

          if (params.dry_run) {
            results.push(
              [
                `🔍 ${item.asset_type}/${basename(item.url)}:`,
                `  Source: ${item.url}`,
                `  Target: ${pathCheck.resolvedPath}`,
                `  Trust:  ${trust.badge} ${trust.level}`,
              ].join("\n"),
            );
            continue;
          }

          const rawUrl = item.url.includes("raw.githubusercontent.com")
            ? item.url
            : toRawUrl(item.url);

          validated.push({ item, trust, resolvedPath: pathCheck.resolvedPath, rawUrl });
        }

        if (params.dry_run || validated.length === 0) {
          return {
            content: [{ type: "text" as const, text: results.join("\n\n") || "No assets to process." }],
          };
        }

        // Phase 2: Fetch all content in parallel
        const fetchResults = await Promise.allSettled(
          validated.map(async (v) => {
            const res = await fetch(v.rawUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return { ...v, content: await res.text() };
          }),
        );

        // Phase 3: Process results (validate, preview/write)
        for (let i = 0; i < fetchResults.length; i++) {
          const result = fetchResults[i];
          const v = validated[i];
          const name = `${v.item.asset_type}/${basename(v.item.url)}`;

          if (result.status === "rejected") {
            results.push(`❌ ${name}: Fetch failed — ${result.reason}`);
            continue;
          }

          const { content } = result.value;
          const validation = validateContent(content, v.item.asset_type);
          const contentHash = computeContentHash(content);

          if (!params.confirm) {
            const lines = [
              `📋 ${name}:`,
              `  Trust:  ${v.trust.badge} ${v.trust.level}`,
              `  Target: ${v.resolvedPath}`,
              `  Hash:   sha256:${contentHash}`,
              `  Size:   ${content.length} bytes`,
            ];
            if (validation.errors.length > 0) {
              lines.push("  ❌ Errors: " + validation.errors.join(", "));
            }
            if (validation.warnings.length > 0) {
              lines.push("  ⚠️ Warnings: " + validation.warnings.join(", "));
            }
            lines.push("  Preview: " + content.split("\n")[0] + "...");

            logAuditEntry({
              timestamp: new Date().toISOString(),
              action: "preview",
              sourceUrl: v.item.url,
              targetPath: v.resolvedPath,
              trustLevel: v.trust.level,
              contentHash,
              contentSize: content.length,
              assetType: v.item.asset_type,
              success: true,
            });

            results.push(lines.join("\n"));
            continue;
          }

          // Write file
          mkdirSync(dirname(v.resolvedPath), { recursive: true });

          let backedUp = false;
          if (existsSync(v.resolvedPath)) {
            copyFileSync(v.resolvedPath, `${v.resolvedPath}.backup`);
            backedUp = true;
          }

          writeFileSync(v.resolvedPath, content, "utf-8");

          logAuditEntry({
            timestamp: new Date().toISOString(),
            action: "install",
            sourceUrl: v.item.url,
            targetPath: v.resolvedPath,
            trustLevel: v.trust.level,
            contentHash,
            contentSize: content.length,
            assetType: v.item.asset_type,
            success: true,
          });

          results.push(
            backedUp
              ? `✅ ${name} → ${v.resolvedPath} (backup created)`
              : `✅ ${name} → ${v.resolvedPath}`,
          );
        }

        const summary =
          items.length > 1
            ? `# Batch Install Results (${items.length} assets)\n\n${results.join("\n\n")}`
            : results[0];

        return {
          content: [{ type: "text" as const, text: summary }],
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
