---
name: discover-from-github-search
description: >
  Discovers relevant GitHub Copilot customizations (agents, skills, instructions, prompts)
  by searching GitHub repositories beyond the official awesome-copilot collection.
---

# Discover Copilot Customizations from GitHub Search

Discover relevant Copilot customizations by searching GitHub repositories beyond the
official awesome-copilot collection.

## Process

### 1. Understand the Project

Know the project's languages, frameworks, and tools before searching.

### 2. Search GitHub

Use `#githubRepo` or `#fetch` to search GitHub for repositories with these topics:

- `copilot-instructions`
- `copilot-agent`
- `copilot-skills`
- `github-copilot`

**Example search queries:**

```
topic:copilot-instructions language:{detected-language}
topic:copilot-agent {framework-name}
"copilot-instructions.md" in:path {language}
"SKILL.md" in:path copilot
```

### 3. Filter Results

Apply quality filters:

| Criterion | Threshold |
|-----------|-----------|
| Minimum stars | ≥ 5 |
| Last updated | Within 6 months |
| Has README | Yes |
| Not a fork | Prefer originals |

### 4. Present Ranked Results

| Source Repo | Type | Name | Description | Stars | Relevance |
|-------------|------|------|-------------|-------|-----------|
| `owner/repo` | instruction | Name | Short description | ⭐ 120 | High |

### 5. Install Selected

For each approved asset, use the `install_asset` MCP tool to install it safely.

**AWAIT user confirmation before installing anything.**

## Notes

- Deduplicate against awesome-copilot results if both skills are used together
- Prefer assets from repos with clear documentation and recent activity
- If `#fetch` or search fails, note it and continue
