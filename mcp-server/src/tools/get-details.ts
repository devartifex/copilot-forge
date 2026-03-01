import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateUrl, getTrustLevel } from "../security/trusted-sources.js";

function toRawUrl(url: string): string {
  return url
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/blob/", "/");
}

export function registerGetDetailsTool(server: McpServer): void {
  server.tool(
    "get_asset_details",
    "Get the full content and metadata of a specific Copilot asset (instruction, prompt, skill, or agent) from awesome-copilot or a GitHub URL",
    {
      url: z
        .string()
        .describe(
          "GitHub URL or raw URL to the asset file (e.g., https://github.com/github/awesome-copilot/blob/main/instructions/react.instructions.md)"
        ),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
    async (params) => {
      try {
        const validation = validateUrl(params.url);
        if (!validation.valid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `URL rejected: ${validation.reason}\nURL: ${params.url}`,
              },
            ],
          };
        }

        const rawUrl = params.url.includes("raw.githubusercontent.com")
          ? params.url
          : toRawUrl(params.url);

        const rawValidation = validateUrl(rawUrl);
        if (!rawValidation.valid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `URL rejected after conversion: ${rawValidation.reason}\nURL: ${rawUrl}`,
              },
            ],
          };
        }

        const trustInfo = getTrustLevel(params.url);

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

        return {
          content: [
            {
              type: "text" as const,
              text: `${trustInfo.badge} Trust: ${trustInfo.level} — ${trustInfo.reason}\n\n${content}`,
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
              text: `Error fetching asset: ${message}\nPlease verify the URL is correct and accessible.`,
            },
          ],
        };
      }
    }
  );
}
