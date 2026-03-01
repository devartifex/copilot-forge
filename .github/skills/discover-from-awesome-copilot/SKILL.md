---
name: discover-from-awesome-copilot
description: >
  Discovers and recommends relevant GitHub Copilot assets (instructions, prompts, skills, agents, collections)
  from the github/awesome-copilot repository and related community sources. Provides a unified, context-aware,
  ranked discovery experience — replacing the separate suggest-awesome-github-copilot-* skills with a single
  comprehensive pass.
---

# Discover from Awesome Copilot

A GitHub Copilot Agent Skill that discovers relevant assets from the
[github/awesome-copilot](https://github.com/github/awesome-copilot) repository and related community sources.

This is an **improved and unified** version of the existing separate `suggest-awesome-github-copilot-*` skills
in that repo, combining them into a single comprehensive discovery skill.

## Key Improvements Over Existing Skills

| # | Improvement | Description |
|---|-------------|-------------|
| 1 | **Unified** | Discovers ALL asset types (instructions, prompts, skills, agents, collections) in one pass |
| 2 | **Context-aware** | Takes a project context profile (from `analyze-project-context` skill) and matches against it |
| 3 | **Ranked** | Scores each recommendation by relevance to the project |
| 4 | **Efficient** | Fetches catalog indexes first, then details only for matches |

## Process

### Phase 1 — Catalog Fetching

1. Fetch catalog indexes from awesome-copilot docs using the `#fetch` tool from raw GitHub URLs:
   - `README.instructions.md` — custom instruction files
   - `README.prompts.md` — reusable prompt files
   - `README.skills.md` — agent skill definitions
   - `README.agents.md` — agent configurations
2. Parse each catalog to extract asset names, descriptions, and metadata.

### Phase 2 — Local Inventory

3. Scan the local `.github/` directory for already-installed assets:
   - `.github/instructions/` — installed instruction files
   - `.github/prompts/` — installed prompt files
   - `.github/skills/` — installed skill definitions
   - `.github/agents/` — installed agent configurations
4. Compare local versions with remote catalog entries to detect outdated assets.

### Phase 3 — Context Matching & Scoring

5. Match catalog entries against the project context profile (languages, frameworks, tools, patterns).
6. Score relevance using a three-tier system:
   - **3 — Exact match**: Asset directly targets a detected language, framework, or tool (e.g., a TypeScript linting skill for a TypeScript project)
   - **2 — Related**: Asset covers a related domain or adjacent technology (e.g., a Node.js testing skill for a TypeScript project)
   - **1 — General best-practice**: Asset provides broadly applicable value regardless of stack (e.g., code review instructions, security prompts)

### Phase 4 — Presentation

7. Present a unified ranked table with the following columns:

   | Column | Description |
   |--------|-------------|
   | **Asset Type** | `instruction` · `prompt` · `skill` · `agent` · `collection` |
   | **Name** | The asset identifier / filename |
   | **Description** | Short summary of what the asset does |
   | **Relevance Score** | `3` (exact) · `2` (related) · `1` (general) |
   | **Status** | ✅ installed & up-to-date · ⚠️ installed but outdated · ❌ not installed |
   | **Rationale** | Why this asset was recommended for this project |

### Phase 5 — Installation (User-Directed)

8. **AWAIT user confirmation** before installing anything — never auto-install.
9. When directed by the user, download selected assets using the `#fetch` tool and place them in the
   appropriate `.github/` subdirectory.

## Sources

### Primary Catalog

| Catalog | URL |
|---------|-----|
| Instructions | https://github.com/github/awesome-copilot/blob/main/docs/README.instructions.md |
| Prompts | https://github.com/github/awesome-copilot/blob/main/docs/README.prompts.md |
| Skills | https://github.com/github/awesome-copilot/blob/main/docs/README.skills.md |
| Agents | https://github.com/github/awesome-copilot/blob/main/docs/README.agents.md |

### Secondary / Community Sources

| Source | URL |
|--------|-----|
| Awesome Copilot Agents | https://github.com/Code-and-Sorts/awesome-copilot-agents |
| Awesome Copilot Chat Modes | https://github.com/dfinke/awesome-copilot-chatmodes |

## Status Icons

| Icon | Meaning |
|------|---------|
| ✅ | Installed and up-to-date |
| ⚠️ | Installed but outdated (newer version available in catalog) |
| ❌ | Not installed |

## Example Output

```
Discovered 14 relevant assets for your project (TypeScript · React · Node.js):

| Asset Type  | Name                        | Description                              | Score | Status | Rationale                          |
|-------------|-----------------------------|------------------------------------------|-------|--------|------------------------------------|
| instruction | typescript-strict.md        | Enforce strict TypeScript conventions     |     3 | ❌     | Exact match: TypeScript detected   |
| skill       | react-component-generator   | Scaffold React components from specs      |     3 | ❌     | Exact match: React detected        |
| prompt      | code-review.prompt.md       | Structured code review checklist          |     1 | ✅     | General best-practice              |
| instruction | node-security.md            | Node.js security best practices           |     2 | ⚠️     | Related: Node.js runtime detected  |
| agent       | test-writer                 | Generate unit tests for changed files     |     2 | ❌     | Related: testing infrastructure    |
```

## Integration

This skill works best when paired with:

- **`analyze-project-context`** — provides the project context profile used for matching
- **`#fetch` tool** — used to retrieve catalog indexes and download selected assets

## Notes

- All recommendations are non-destructive; nothing is installed without explicit user approval.
- The skill fetches catalog indexes (lightweight markdown files) first and only retrieves full asset
  content when the user confirms installation, keeping network usage minimal.
- Outdated detection compares file content hashes; a ⚠️ status means the local copy differs from the
  latest catalog version.
