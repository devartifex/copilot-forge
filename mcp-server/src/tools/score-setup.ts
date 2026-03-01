import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync } from "node:fs";
import { computeScore, formatScoreReport } from "../core/scorer.js";

// ---------------------------------------------------------------------------
// MCP tool registration
// ---------------------------------------------------------------------------

export function registerScoreSetupTool(server: McpServer): void {
  server.tool(
    "score_setup",
    "Evaluate your project's Copilot setup quality — returns a score, letter grade, and specific improvement suggestions",
    {
      project_path: z
        .string()
        .describe("Absolute path to the project root"),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
      idempotentHint: true,
    },
    async ({ project_path }) => {
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

        const result = computeScore(project_path);
        const report = formatScoreReport(result);

        return {
          content: [{ type: "text" as const, text: report }],
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
