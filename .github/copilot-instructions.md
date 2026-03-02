# Copilot Instructions — copilot-forge

## Project Overview

MCP (Model Context Protocol) server that auto-discovers GitHub Copilot agents, skills, prompts, instructions, and MCP servers. The server fetches catalogs from `github/awesome-copilot`, the MCP registry, and GitHub search, then installs assets into a project's `.github/` folder.

## Language & Runtime

- **TypeScript 5.7+**, targeting **ES2022**
- **Node.js 18+** (`"engines": { "node": ">=18.0.0" }`)
- **ESM only** — `"type": "module"` in `package.json`
- Module resolution: **NodeNext** (`tsconfig.json`)

## Import Conventions

All local imports **must** use the `.js` extension (required by NodeNext resolution):

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validateUrl } from "../security/trusted-sources.js";
import type { CatalogEntry } from "../types.js";
```

Never use extensionless imports for local files.

## MCP SDK Patterns

- Use `@modelcontextprotocol/sdk` v1.12+
- Register tools via `server.tool(name, description, zodSchema, annotations, handler)`
- Always include tool annotations with at minimum:
  - `readOnlyHint: boolean`
  - `destructiveHint: boolean`
  - `openWorldHint: boolean`
- Each tool is registered via a `registerXxxTool(server: McpServer)` function exported from its own file under `src/tools/`
- Tool handlers must return `{ content: [{ type: "text", text: string }] }`

## Validation & Schemas

- Use **zod** for all tool parameter schemas — import as `import { z } from "zod"`
- Add `.describe()` to every zod field for MCP introspection
- Define all shared interfaces in `src/types.ts`

## Security — Mandatory

Every tool that fetches or writes must use the security modules in `src/security/`:

| Module | Purpose |
|---|---|
| `trusted-sources.ts` | URL allowlist validation, SSRF prevention, trust-level badges |
| `content-validator.ts` | Size limits, suspicious pattern scanning, front-matter validation |
| `path-safety.ts` | Path traversal prevention, filename sanitization |
| `audit-log.ts` | Structured logging of all fetch/install actions with content hashes |

Rules:
- **Never** fetch from URLs not in `ALLOWED_DOMAINS`
- **Never** write files without the preview-by-default pattern (`confirm: false` → preview, `confirm: true` → write)
- Always compute and log `sha256` content hashes before writing
- Scan all fetched content for `SUSPICIOUS_PATTERNS` before presenting to user

## Error Handling

Never throw from tool handlers. Catch all errors and return MCP-formatted responses:

```typescript
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
  };
}
```

## Testing

- **Framework**: Vitest (`vitest run`, `vitest run --coverage`)
- **Structure**: `tests/unit/`, `tests/integration/`, `tests/security/`
- Mock `fetch` with `vi.stubGlobal("fetch", mockFetch)`
- Every tool in `src/tools/` must have a corresponding test file
- Every security module must have dedicated tests in `tests/security/`

## Code Style

- **ESLint** with `typescript-eslint` — run via `npm run lint`
- No comments except for genuinely non-obvious logic
- Prefix unused variables with `_` (e.g., `_unused`)
- Use `as const` for string literal types in MCP responses
- Prefer `Promise.allSettled` over `Promise.all` for parallel fetches that may fail independently

## Build & Run

```bash
npm run build    # tsc → dist/
npm run dev      # tsx src/index.ts (development)
npm run start    # node dist/index.js (production)
npm run test     # vitest run
npm run lint     # eslint src/ tests/
```

## Git Conventions

- Use **conventional commits**: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`
- Always include trailer:
  ```
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
  ```

## File Structure

```
mcp-server/
  src/
    index.ts              # Server entry point, tool registration
    types.ts              # Shared TypeScript interfaces
    tools/                # One file per MCP tool (registerXxxTool pattern)
    security/             # URL validation, content scanning, path safety, audit
    cache/                # Catalog caching logic
    resources.ts          # MCP resource registration
  tests/
    unit/                 # Unit tests for individual modules
    integration/          # End-to-end tool handler tests
    security/             # Security-specific tests
```
