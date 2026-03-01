---
description: "Find missing or outdated Copilot customizations and suggest improvements for an existing project"
agent: "agent"
tools: ["search/codebase", "web/fetch", "web/githubRepo", "azure-mcp/search", "execute/getTerminalOutput", "execute/runInTerminal", "read/terminalLastCommand", "read/terminalSelection", "read/problems", "edit/editFiles", "search/changes"]
---

## Refactoring Discovery

Analyze this project in **refactoring mode** — it already has Copilot customizations but may have gaps, outdated assets, or opportunities to adopt newer tools.

### Steps

1. **Audit existing customizations** — Inventory current instructions, prompts, skills, agents, and MCP server configs in this repo.
2. **Check for issues:**
   - **Outdated assets** — Instructions or configs referencing deprecated APIs, old framework versions, or sunset tools.
   - **Coverage gaps** — Languages, frameworks, or workflows in the project that lack corresponding Copilot customizations.
   - **New opportunities** — Recently released MCP servers, skills, or prompt patterns that weren't available when the project was set up.
   - **Complementary tools** — Skills or MCP servers that would pair well with what's already installed.
3. **Present findings** with clear action labels:
   - 🔄 **Update** — Outdated asset that needs refreshing
   - ➕ **Add** — Missing customization that would improve the workflow
   - 🗑️ **Remove** — Redundant or deprecated asset
4. **Wait for user confirmation** before making any changes.

> **Tip:** For granular control over discovery and installation, use the `@copilot-discoverer` agent directly.
