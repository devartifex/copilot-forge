---
name: discover-from-mcp-registry
description: >
  Discovers relevant MCP (Model Context Protocol) servers from the official MCP Registry
  and community directories. Matches servers against your project's languages, frameworks,
  tools, and cloud providers to recommend integrations that extend your AI agent with
  external tools and data sources.
---

# Discover MCP Servers from Registry

Discover relevant MCP servers that can extend your AI agent with external tools and data sources.

## Process

### 1. Understand the Project

Know the project's languages, frameworks, databases, cloud providers, and tools.
Run `analyze_project` if this context isn't already available.

### 2. Fetch Server Catalogs

Use `#fetch` to read these sources:

| Source | URL |
|--------|-----|
| Official MCP Registry | `https://registry.modelcontextprotocol.io` |
| Official MCP Servers | `https://github.com/modelcontextprotocol/servers` |
| Community List | `https://github.com/punkpeye/awesome-mcp-servers` |

### 3. Match Against Project

Read the catalogs and match servers against the project context:

- **Language/framework tools** (linting, formatting, type checking)
- **Service integrations** (GitHub, Jira, Slack, databases)
- **Cloud services** (AWS, Azure, GCP)
- **Development workflow** (testing, deployment, CI/CD)

### 4. Check Existing Configuration

Scan for existing MCP configs in:
- `.vscode/mcp.json`
- `mcp.json`

Mark already-configured servers as ✅.

### 5. Present Results

| # | Server | Description | Transport | Relevance | Status |
|---|--------|-------------|-----------|-----------|--------|
| 1 | github | GitHub API tools | stdio | ⭐⭐⭐ | ✅ Configured |
| 2 | postgres | PostgreSQL queries | stdio | ⭐⭐⭐ | ❌ Not configured |

For each recommended server, provide a ready-to-use config snippet for `.vscode/mcp.json`.

### 6. Await User Confirmation

**Do NOT modify configuration files automatically.**

Ask which servers to configure, confirm the target file, and only write after explicit approval.

## Notes

- Prefer official MCP servers over community alternatives
- Flag servers that require API keys or tokens
- If a registry URL fails, continue with other sources
