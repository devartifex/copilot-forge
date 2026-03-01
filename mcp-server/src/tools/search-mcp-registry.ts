import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getCached, setCache } from "../cache/catalog-cache.js";
import type { CatalogEntry } from "../types.js";

export interface RegistryServer {
  name: string;
  description: string;
  packageName: string;
}

export async function fetchFromRegistry(): Promise<RegistryServer[]> {
  try {
    const res = await fetch(
      "https://registry.modelcontextprotocol.io/v0/servers"
    );
    if (!res.ok) throw new Error(`Registry returned ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>[];
    return data.map((entry) => ({
      name: String(entry.name ?? ""),
      description: String(entry.description ?? ""),
      packageName: String(entry.name ?? ""),
    }));
  } catch {
    // Fallback to awesome-mcp-servers README
    const res = await fetch(
      "https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md"
    );
    if (!res.ok) throw new Error(`Fallback fetch failed: ${res.status}`);
    const md = await res.text();
    return parseReadme(md);
  }
}

function parseReadme(md: string): RegistryServer[] {
  const results: RegistryServer[] = [];
  const linkPattern = /^[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*[-–—:]?\s*(.*)$/;

  for (const line of md.split("\n")) {
    const match = line.match(linkPattern);
    if (!match) continue;
    const [, name, url, description] = match;
    const packageName = extractPackageName(name, url);
    results.push({
      name: name.trim(),
      description: (description ?? "").trim(),
      packageName,
    });
  }
  return results;
}

function extractPackageName(name: string, url: string): string {
  const npmMatch = url.match(
    /npmjs\.com\/package\/((?:@[^/]+\/)?[^/?#]+)/
  );
  if (npmMatch) return npmMatch[1];

  const ghMatch = url.match(/github\.com\/([^/]+\/[^/?#]+)/);
  if (ghMatch) return ghMatch[1];

  return name.toLowerCase().replace(/\s+/g, "-");
}

function toConfigSnippet(packageName: string): Record<string, unknown> {
  return {
    type: "stdio",
    command: "npx",
    args: ["-y", packageName],
  };
}

function toCatalogEntries(servers: RegistryServer[]): CatalogEntry[] {
  return servers.map((s) => ({
    name: s.name,
    description: s.description,
    path: s.packageName,
    type: "mcp-server",
  }));
}

function fromCatalogEntries(entries: CatalogEntry[]): RegistryServer[] {
  return entries.map((e) => ({
    name: e.name,
    description: e.description,
    packageName: e.path,
  }));
}

const CACHE_KEY = "mcp-registry";

export function registerSearchMcpRegistryTool(server: McpServer): void {
  server.tool(
    "search_mcp_servers",
    "Search the MCP Registry for MCP servers that provide tool integrations (databases, APIs, cloud services, dev tools)",
    {
      query: z
        .string()
        .describe("Search query (e.g., 'github', 'postgres', 'slack')"),
      category: z.string().optional().describe("Filter by category"),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
    async ({ query, category }) => {
      let servers: RegistryServer[];

      const cached = getCached(CACHE_KEY);
      if (cached) {
        servers = fromCatalogEntries(cached);
      } else {
        servers = await fetchFromRegistry();
        setCache(CACHE_KEY, toCatalogEntries(servers));
      }

      const lowerQuery = query.toLowerCase();
      let filtered = servers.filter((s) => {
        const haystack = `${s.name} ${s.description}`.toLowerCase();
        return haystack.includes(lowerQuery);
      });

      if (category) {
        const lowerCat = category.toLowerCase();
        filtered = filtered.filter((s) => {
          const haystack = `${s.name} ${s.description}`.toLowerCase();
          return haystack.includes(lowerCat);
        });
      }

      const top = filtered.slice(0, 15);

      if (top.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No MCP servers found matching "${query}".`,
            },
          ],
        };
      }

      const lines = top.map((s, i) => {
        const config = JSON.stringify(toConfigSnippet(s.packageName), null, 2);
        return [
          `${i + 1}. **${s.name}**`,
          s.description ? `   ${s.description}` : "",
          `   VS Code MCP config:`,
          `   \`\`\`json`,
          `   ${config.replace(/\n/g, "\n   ")}`,
          `   \`\`\``,
        ]
          .filter(Boolean)
          .join("\n");
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${filtered.length} MCP server(s) matching "${query}"${filtered.length > 15 ? " (showing top 15)" : ""}:\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    }
  );
}
