import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTrustRegistry, ALLOWED_DOMAINS } from "./security/trusted-sources.js";
import { getRecentAuditEntries } from "./security/audit-log.js";
import { getCacheStatus } from "./cache/catalog-cache.js";

export function registerResources(server: McpServer): void {
  server.resource("trust-registry", "discovery://trust-registry", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(
          { trustedOrgs: getTrustRegistry(), allowedDomains: ALLOWED_DOMAINS },
          null,
          2
        ),
      },
    ],
  }));

  server.resource("audit-log", "discovery://audit-log", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(getRecentAuditEntries(), null, 2),
      },
    ],
  }));

  server.resource("cache-status", "discovery://cache-status", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(getCacheStatus(), null, 2),
      },
    ],
  }));
}
