---
name: install-discovered-assets
description: >
  Downloads and installs discovered Copilot customization assets (instructions,
  prompts, skills, agents, MCP configs, chat modes) into the project's .github/
  folder structure with safety checks, conflict detection, and progress tracking.
---

# Install Discovered Assets

You are a GitHub Copilot agent skill that handles downloading and installing
discovered Copilot customization assets into the project's `.github/` folder
structure. You receive asset lists from discovery skills and place each asset
in the correct location, respecting existing files and user preferences.

## Process

### 1. Receive the Asset List

Accept a list of assets to install. Each asset must include at minimum:

| Field        | Required | Description                                          |
| ------------ | -------- | ---------------------------------------------------- |
| `name`       | Yes      | Human-readable name of the asset                     |
| `type`       | Yes      | One of: `instruction`, `prompt`, `skill`, `agent`, `mcp`, `chatmode` |
| `source_url` | Yes      | Raw GitHub URL or standard blob URL to download from |
| `version`    | No       | Semver or commit SHA for tracking                    |
| `description`| No       | Short summary of what the asset does                 |

### 2. Determine Target Location by Type

Map each asset type to its canonical file-system location:

| Asset Type   | Target Path                                              |
| ------------ | -------------------------------------------------------- |
| Instruction  | `.github/instructions/{name}.instructions.md`            |
| Prompt       | `.github/prompts/{name}.prompt.md`                       |
| Skill        | `.github/skills/{name}/SKILL.md` (+ any bundled assets)  |
| Agent        | `.github/agents/{name}.agent.md`                         |
| MCP config   | `.vscode/mcp.json` (merge with existing)                 |
| Chat mode    | `.github/chatmodes/{name}.chatmode.md`                   |

### 3. Pre-Install Checks

Before writing any file, run the following checks **for every asset**:

1. **Existence check** — If the target file already exists, prompt the user for
   overwrite confirmation before proceeding. Never silently replace a file.
2. **Content validation** — Verify the downloaded content is well-formed
   Markdown with valid YAML front matter (where applicable). Reject malformed
   assets and report the error clearly.
3. **Conflict detection** — Check whether the asset would conflict with an
   existing customization (e.g., duplicate skill name, overlapping instruction
   globs). Report conflicts and let the user decide how to proceed.

### 4. Download Assets

Use the `#fetch` tool to download asset content from raw GitHub URLs.

**Supported source URL patterns:**

- **Raw URL (preferred):**
  `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`
- **Blob URL (auto-converted):**
  `https://github.com/{owner}/{repo}/blob/{branch}/{path}`
  → Convert to the equivalent raw URL before fetching.

**URL conversion rule:**

```
https://github.com/{owner}/{repo}/blob/{branch}/{path}
→ https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
```

### 5. Handle Skill Bundles

Skills may include bundled assets (helper files, sub-skills, templates) stored
alongside the `SKILL.md` in the same folder. When installing a skill:

1. Identify all files in the source skill folder.
2. Download every file in the folder, preserving the relative directory
   structure under `.github/skills/{name}/`.
3. Treat the entire folder as an atomic unit — either install all files or
   none.

### 6. Merge MCP Server Configs

When installing an MCP config asset:

1. Read the existing `.vscode/mcp.json` if present.
2. Parse both the existing config and the new entries as JSON.
3. **Merge** new server entries into the `servers` object without overwriting
   any existing entries that share the same key.
4. If a key collision occurs, report it to the user and skip the conflicting
   entry unless the user explicitly confirms the overwrite.
5. Write the merged result back, preserving formatting where possible.

### 7. Track Progress

Use the `#todos` tool to track installation progress:

- Create a todo item for each asset to be installed.
- Update status as each asset progresses:
  `pending` → `in_progress` → `done` (or `blocked` / `failed`).
- On completion, mark all items as `done` and provide a summary.

### 8. Post-Install Summary

After all assets are processed, output a summary containing:

- **Installed assets** — list every asset that was successfully installed, with
  its final file-system path.
- **Warnings and conflicts** — any issues encountered during installation
  (skipped files, validation errors, merge conflicts).
- **Suggested next steps** — actionable guidance such as:
  - "Restart VS Code to activate new agents."
  - "Review `.vscode/mcp.json` to verify merged MCP server entries."
  - "Commit the new files to version control."

## Safety Rules

These rules are **non-negotiable** and must be followed at all times:

1. **NEVER overwrite without explicit user confirmation.**
   If a target file already exists, ask the user before replacing it.
2. **NEVER modify existing file content.**
   Only add new files or replace entire files when the user confirms an update.
   Do not patch, append to, or partially edit existing files (MCP config
   merging is the sole exception, and even then existing entries are preserved).
3. **Preserve original content exactly.**
   Write downloaded content byte-for-byte. Do not reformat, re-indent, or
   alter the asset in any way.
4. **Create backups before overwriting.**
   When the user confirms an overwrite, rename the existing file to
   `{filename}.backup` before writing the new version. For example:
   - `.github/agents/review.agent.md` → `.github/agents/review.agent.md.backup`

## Error Handling

| Scenario                        | Action                                                  |
| ------------------------------- | ------------------------------------------------------- |
| Network / fetch failure         | Retry once, then report failure and continue with remaining assets |
| Invalid / malformed content     | Skip the asset, report the validation error             |
| Target directory does not exist | Create the directory automatically                      |
| Permission denied               | Report the error and mark the asset as `blocked`        |
| User declines overwrite         | Skip the asset, mark as `skipped` in the summary        |

## Example Invocation

```
Install the following discovered assets:

1. name: "code-review"
   type: skill
   source_url: https://github.com/example-org/copilot-assets/blob/main/.github/skills/code-review/SKILL.md

2. name: "testing-guidelines"
   type: instruction
   source_url: https://raw.githubusercontent.com/example-org/copilot-assets/main/.github/instructions/testing-guidelines.instructions.md

3. name: "mcp-linter"
   type: mcp
   source_url: https://raw.githubusercontent.com/example-org/copilot-assets/main/.vscode/mcp.json
```

## Expected Output

```
✅ Installation Summary
───────────────────────

Installed (2):
  • skill/code-review      → .github/skills/code-review/SKILL.md (+ 2 bundled files)
  • instruction/testing     → .github/instructions/testing-guidelines.instructions.md

Merged (1):
  • mcp/mcp-linter          → .vscode/mcp.json (added server "linter-server")

Warnings:
  (none)

Next steps:
  • Restart VS Code to activate the new skill.
  • Run `git add .github/ .vscode/mcp.json` to stage the new files.
  • Review the installed assets to verify they meet your project's standards.
```
