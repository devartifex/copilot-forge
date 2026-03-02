---
name: discover-from-awesome-copilot
description: >
  Discovers and recommends relevant GitHub Copilot assets (instructions, prompts, skills, agents, collections)
  from the github/awesome-copilot repository and related community sources. Provides a unified, context-aware,
  ranked discovery experience — replacing the separate suggest-awesome-github-copilot-* skills with a single
  comprehensive pass.
---

# Discover from Awesome Copilot

Discover relevant Copilot assets from the [github/awesome-copilot](https://github.com/github/awesome-copilot)
repository by reading the catalogs directly and matching against the current project.

## Process

### 1. Understand the Project

If you haven't already, run the `analyze_project` MCP tool or scan `.github/` to understand:
- Languages and frameworks in use
- Existing customizations already installed

### 2. Fetch Catalogs

Use `#fetch` to read these catalog pages directly from GitHub:

| Catalog | URL |
|---------|-----|
| Instructions | `https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.instructions.md` |
| Prompts | `https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.prompts.md` |
| Skills | `https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.skills.md` |
| Agents | `https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.agents.md` |

### 3. Match Against Project

Read each catalog and identify assets that are relevant to this project's tech stack.
Use your understanding of the project context to determine relevance — don't rely on simple
keyword matching. Consider:

- **Exact match**: Asset directly targets a detected language/framework
- **Related**: Asset covers an adjacent technology or general best practice
- **Already installed**: Skip assets that match files already in `.github/`

### 4. Present Recommendations

Show a ranked table:

| Type | Name | Description | Relevance | Status |
|------|------|-------------|-----------|--------|
| instruction | typescript-strict.md | Enforce strict TS conventions | ⭐⭐⭐ Exact | ❌ Not installed |
| skill | code-review | Structured review checklist | ⭐⭐ Related | ✅ Installed |

### 5. Install Selected Assets

When the user selects assets to install, use the `install_asset` MCP tool for each one.
Always preview first (`confirm: false`), then write (`confirm: true`) after user approval.

## Secondary Sources

| Source | URL |
|--------|-----|
| Awesome Copilot Agents | `https://github.com/Code-and-Sorts/awesome-copilot-agents` |
| Awesome Copilot Chat Modes | `https://github.com/dfinke/awesome-copilot-chatmodes` |

## Notes

- Never auto-install — always wait for user confirmation
- Prefer the `install_asset` MCP tool for installation (it handles safety checks, path validation, and audit logging)
- If `#fetch` fails for a URL, skip it and note the gap
