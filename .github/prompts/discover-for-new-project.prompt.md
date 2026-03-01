---
description: "Discover and install the best Copilot agents, skills, prompts, instructions, and MCP servers for a new project"
agent: "agent"
tools: ["search/codebase", "web/fetch", "web/githubRepo", "azure-mcp/search", "execute/getTerminalOutput", "execute/runInTerminal", "read/terminalLastCommand", "read/terminalSelection", "read/problems", "edit/editFiles", "search/changes"]
---

## New Project Discovery

Analyze this project as a **new project** that needs a comprehensive Copilot customization setup from scratch.

### Steps

1. **Scan the project** — Detect languages, frameworks, build tools, test runners, CI/CD pipelines, and cloud targets.
2. **Search all sources** — Query the [awesome-copilot](https://github.com/github/awesome-copilot) list, the MCP server registry, GitHub Marketplace, and public repos for relevant Copilot assets.
3. **Recommend a full initial setup**, grouped by category:
   - **Custom instructions** (`.github/copilot-instructions.md` and language/framework-specific guidance)
   - **Prompt files** (reusable slash commands for common workflows)
   - **Skills & agents** (specialized Copilot skills or agent extensions)
   - **MCP servers** (tool servers for databases, APIs, cloud providers, etc.)
4. **Rank recommendations** by relevance to this project's stack and workflows. Include a brief rationale for each.
5. **Wait for user confirmation** before installing or creating any files.

> **Tip:** For more detailed control over discovery, filtering, and installation, use the `@copilot-discoverer` agent directly.
