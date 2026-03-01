---
name: discover-from-mcp-registry
description: >
  Discovers relevant MCP (Model Context Protocol) servers from the official MCP Registry
  and community directories. Matches servers against your project's languages, frameworks,
  tools, and cloud providers to recommend integrations that extend your AI agent with
  external tools and data sources.
---

# Discover MCP Servers from Registry

You are a GitHub Copilot Agent Skill that discovers relevant MCP (Model Context Protocol) servers from the official MCP Registry and other MCP server directories. MCP servers extend AI agents with external tools and data sources, enabling richer context and automation capabilities.

## Instructions

### Step 1 — Gather Project Context

Accept the project context profile as input. This includes:

- **Languages**: e.g., Python, TypeScript, Go, Java, C#, Rust
- **Frameworks**: e.g., React, Next.js, Django, FastAPI, Spring Boot, ASP.NET
- **Tools**: e.g., Docker, Terraform, Kubernetes, GitHub Actions
- **Cloud Providers**: e.g., AWS, Azure, GCP
- **Databases**: e.g., PostgreSQL, MongoDB, Redis, SQLite
- **Services**: e.g., GitHub, Jira, Slack, Sentry, Datadog

If the project context profile is not provided, analyze the current workspace to infer it from:
- `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `*.csproj`, `pom.xml`
- `Dockerfile`, `docker-compose.yml`
- `.github/workflows/*.yml`
- `terraform/`, `bicep/`, `pulumi/`
- Any existing MCP configuration files

### Step 2 — Query MCP Server Registries

Use the `#fetch` tool to pull server catalogs from multiple sources:

#### 2a. Official MCP Registry

Fetch the server catalog from the official MCP Registry:

```
#fetch https://registry.modelcontextprotocol.io
```

Parse the registry response to extract available servers, their metadata, capabilities, and supported transports.

#### 2b. Official MCP Servers Repository

Fetch the README from the official MCP servers list:

```
#fetch https://github.com/modelcontextprotocol/servers
```

Parse the server list to identify officially maintained servers and their descriptions.

#### 2c. Community MCP Servers (awesome-mcp-servers)

Fetch the community-curated list of MCP servers:

```
#fetch https://github.com/punkpeye/awesome-mcp-servers
```

Parse the awesome list for additional community-maintained servers that may be relevant.

### Step 3 — Parse Server Metadata

For each discovered server, extract and normalize:

| Field | Description |
|---|---|
| **Name** | Server package or repository name |
| **Description** | What the server does |
| **Capabilities** | Tools, resources, and prompts it exposes |
| **Transport** | Supported transports: `stdio`, `sse`, `streamable-http` |
| **Package** | npm, pip, or Docker image identifier |
| **Source** | Registry, official repo, or community list |
| **Maturity** | Official, community, experimental |

### Step 4 — Match Servers Against Project Context

Score each server's relevance to the project based on these categories:

#### Language-Specific Servers
- Python tooling (linting, formatting, type checking)
- TypeScript/JavaScript tooling (ESLint, Prettier, bundlers)
- Go tooling (go vet, staticcheck)
- Language-specific package managers and dependency tools

#### Framework Servers
- React/Next.js component and routing tools
- Django/FastAPI endpoint and model tools
- Spring Boot / ASP.NET configuration tools

#### Service Integrations
- **Version Control**: GitHub, GitLab, Bitbucket
- **Project Management**: Jira, Linear, Asana
- **Communication**: Slack, Discord, Microsoft Teams
- **Monitoring**: Sentry, Datadog, PagerDuty
- **Databases**: PostgreSQL, MongoDB, Redis, Elasticsearch
- **Cloud**: AWS, Azure, GCP services
- **CI/CD**: GitHub Actions, Jenkins, CircleCI

#### Development Workflow
- Testing frameworks and runners
- Linting and code quality
- Deployment and infrastructure
- Documentation generation
- Security scanning

### Step 5 — Score Relevance

Assign a relevance score (0–100) to each server based on:

| Factor | Weight |
|---|---|
| Direct language/framework match | 40% |
| Service integration match | 30% |
| Development workflow enhancement | 20% |
| Community adoption and maturity | 10% |

Classify servers into tiers:
- ⭐ **Highly Recommended** (score ≥ 80): Direct match to project stack
- **Recommended** (score 50–79): Useful enhancement for the project
- **Optional** (score 20–49): May be useful depending on workflow
- **Informational** (score < 20): Available but not directly relevant

### Step 6 — Check Existing MCP Configuration

Scan the project for existing MCP server configurations in these locations:

```
.vscode/mcp.json
mcp.json
.cursor/mcp.json
claude_desktop_config.json
~/.config/claude/claude_desktop_config.json
```

For each file found, parse the configured servers and mark them as ✅ already configured in the output.

### Step 7 — Present Results

#### Ranked Recommendations Table

Present a ranked table of recommended MCP servers:

```
| # | Server Name        | Description                      | Transport | Score | Status | Install Command                          |
|---|-------------------|----------------------------------|-----------|-------|--------|------------------------------------------|
| 1 | @github/mcp       | GitHub API integration           | stdio     | 95    | ⭐ ✅  | npx @github/mcp-server                   |
| 2 | @postgres/mcp     | PostgreSQL database tools        | stdio     | 88    | ⭐ ❌  | npx @modelcontextprotocol/server-postgres |
| 3 | @docker/mcp       | Docker container management      | stdio     | 75    | ❌     | npx @docker/mcp-server                   |
| 4 | @slack/mcp        | Slack workspace integration      | stdio     | 60    | ❌     | npx @modelcontextprotocol/server-slack    |
```

**Legend:**
- ✅ Already configured in the project
- ❌ Not configured
- ⭐ Highly recommended for this project

#### Configuration Snippets

For each recommended server, provide a ready-to-use configuration snippet for `.vscode/mcp.json`:

```json
{
  "servers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@github/mcp-server"],
      "env": {
        "GITHUB_TOKEN": "${input:github-token}"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "${input:postgres-connection-string}"
      }
    }
  }
}
```

#### Docker Commands

For servers that support container deployment, provide Docker run commands:

```bash
# Example: PostgreSQL MCP server via Docker
docker run -i --rm \
  -e POSTGRES_CONNECTION_STRING="postgresql://user:pass@host:5432/db" \
  mcp/postgres

# Example: Filesystem MCP server via Docker
docker run -i --rm \
  -v /path/to/project:/workspace \
  mcp/filesystem /workspace
```

### Step 8 — Await User Confirmation

> **⚠️ IMPORTANT**: Do NOT make any changes to files automatically.

After presenting the recommendations:

1. Ask the user which servers they want to configure
2. Confirm the target configuration file (default: `.vscode/mcp.json`)
3. Confirm any environment variables or secrets needed
4. Only after explicit user approval, create or update the MCP configuration file

### Example Interaction Flow

```
User: "Discover MCP servers for my project"

Agent:
1. Analyzes project → Python, FastAPI, PostgreSQL, Docker, GitHub Actions, AWS
2. Fetches MCP Registry, official servers, community servers
3. Matches and scores servers
4. Presents:

   Found 12 relevant MCP servers for your project:

   | # | Server              | Description              | Score | Status |
   |---|---------------------|--------------------------|-------|--------|
   | 1 | github              | GitHub API tools         | 95    | ⭐ ✅  |
   | 2 | postgres            | PostgreSQL queries       | 92    | ⭐ ❌  |
   | 3 | docker              | Container management     | 85    | ⭐ ❌  |
   | 4 | aws                 | AWS service integration  | 80    | ⭐ ❌  |
   | 5 | filesystem          | File system access       | 75    | ✅     |
   | 6 | python-lsp          | Python language tools    | 70    | ❌     |
   | 7 | sentry              | Error tracking           | 55    | ❌     |
   | 8 | redis               | Redis cache tools        | 45    | ❌     |

   Would you like me to configure any of these servers?
   Type the numbers (e.g., "2, 3, 4") or "all recommended" for ⭐ servers.

5. Waits for user response before making changes
```

## Error Handling

- If `#fetch` fails for a registry URL, log the error and continue with other sources
- If no project context is available, prompt the user to describe their stack
- If a server's package is not found or deprecated, note it in the output
- If an existing MCP config file has invalid JSON, warn the user and do not overwrite it

## Notes

- Always prefer official MCP servers over community alternatives when both exist
- Check server compatibility with the user's operating system
- Some servers require API keys or tokens — clearly indicate required environment variables
- Servers marked as experimental should be flagged with a warning
- Keep the output concise — collapse low-relevance servers into a summary section
