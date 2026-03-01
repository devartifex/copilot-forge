import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getCached, setCache } from "../cache/catalog-cache.js";
import type { CatalogEntry } from "../types.js";
import { getTrustBadge } from "../security/trusted-sources.js";

const README_URLS: Record<string, string> = {
  instruction:
    "https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.instructions.md",
  prompt:
    "https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.prompts.md",
  skill:
    "https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.skills.md",
  agent:
    "https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.agents.md",
};

const CACHE_KEY = "awesome-copilot-catalog";

// Matches table rows: | [name](link) | description |
const TABLE_ROW_RE =
  /\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]+)\|/;

// Matches list items: - [name](link) - description
const LIST_ITEM_RE =
  /^[-*]\s*\[([^\]]+)\]\(([^)]+)\)\s*[-–—:]\s*(.+)$/;

export function parseEntries(markdown: string, type: string): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  const seen = new Set<string>();

  for (const line of markdown.split("\n")) {
    const tableMatch = line.match(TABLE_ROW_RE);
    if (tableMatch) {
      const key = `${tableMatch[1]}|${tableMatch[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({
          name: tableMatch[1].trim(),
          description: tableMatch[3].trim(),
          path: tableMatch[2].trim(),
          type,
        });
      }
      continue;
    }

    const listMatch = line.match(LIST_ITEM_RE);
    if (listMatch) {
      const key = `${listMatch[1]}|${listMatch[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({
          name: listMatch[1].trim(),
          description: listMatch[3].trim(),
          path: listMatch[2].trim(),
          type,
        });
      }
    }
  }

  return entries;
}

export async function fetchCatalog(): Promise<CatalogEntry[]> {
  const results = await Promise.allSettled(
    Object.entries(README_URLS).map(async ([type, url]) => {
      const res = await fetch(url);
      if (!res.ok) return [];
      const md = await res.text();
      return parseEntries(md, type);
    })
  );

  return results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );
}

export function registerSearchAwesomeCopilotTool(server: McpServer): void {
  server.tool(
    "search_copilot_assets",
    "Search the awesome-copilot repository and GitHub for Copilot instructions, prompts, skills, and agents matching your query",
    {
      query: z
        .string()
        .describe(
          "Search query (e.g., 'react testing', 'python', 'security')"
        ),
      type: z
        .enum(["instruction", "prompt", "skill", "agent", "all"])
        .default("all")
        .describe("Filter by asset type"),
      language: z
        .string()
        .optional()
        .describe("Filter by programming language"),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
    async (params) => {
      let catalog = getCached(CACHE_KEY);
      if (!catalog) {
        catalog = await fetchCatalog();
        setCache(CACHE_KEY, catalog);
      }

      const queryLower = params.query.toLowerCase();
      const langLower = params.language?.toLowerCase();

      const filtered = catalog.filter((entry) => {
        if (params.type !== "all" && entry.type !== params.type) return false;

        const text = `${entry.name} ${entry.description}`.toLowerCase();
        if (!text.includes(queryLower)) return false;

        if (langLower && !text.includes(langLower)) return false;

        return true;
      });

      // Sort: exact name match first, then description match
      filtered.sort((a, b) => {
        const aNameMatch = a.name.toLowerCase().includes(queryLower) ? 0 : 1;
        const bNameMatch = b.name.toLowerCase().includes(queryLower) ? 0 : 1;
        return aNameMatch - bNameMatch;
      });

      const top = filtered.slice(0, 20);

      if (top.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No Copilot assets found matching "${params.query}".`,
            },
          ],
        };
      }

      const verifiedBadge = getTrustBadge('verified');
      const lines = top.map(
        (e, i) =>
          `${i + 1}. ${verifiedBadge} **${e.name}** (${e.type})\n   ${e.description}\n   ${e.path}`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${filtered.length} result(s) for "${params.query}":\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    }
  );
}
