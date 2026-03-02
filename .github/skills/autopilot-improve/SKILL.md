---
name: autopilot-improve
description: |
  Iterative self-improvement autopilot. Runs a simple analyze→improve→validate cycle
  to enhance the project's Copilot setup. Use when asked to "autopilot", "auto-improve",
  "self-improve", or "iterate on improvements".
---

# Autopilot Improve — Iterative Self-Improvement

Run a simple 3-phase cycle that analyzes the project, improves its Copilot setup, and validates
the changes. Each iteration builds on the previous one.

```
ANALYZE → IMPROVE → VALIDATE → [repeat?]
```

## Phase 1: ANALYZE

Use the MCP tools to understand the current state:

1. Run `analyze_project` to detect languages, frameworks, and existing `.github/` customizations
2. Run `score_setup` to get the current score and identify gaps
3. Note which score categories are at 0 — these are the improvement targets

## Phase 2: IMPROVE

Based on the gaps found in Phase 1, take action in priority order:

### If copilot-instructions.md is missing or weak (score category 1):
- Run `generate_instructions` with `confirm: false` to preview
- Show the user what was detected, then write with `confirm: true`

### If org standards are missing (score categories 2-6):
- Run `apply_org_standards` with `confirm: false` to preview
- Let the user pick which standards to apply, then write with `confirm: true`

### If skills/prompts/agents are missing (score categories 7-8):
- Use `#fetch` to read the awesome-copilot catalogs directly:
  - `https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.instructions.md`
  - `https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.skills.md`
  - `https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.prompts.md`
  - `https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.agents.md`
- Read each catalog, match entries against the project's tech stack
- Present the top 3-5 most relevant uninstalled assets to the user
- For each selected asset, use `install_asset` to install it

### If MCP servers could help:
- Use `#fetch` to read `https://registry.modelcontextprotocol.io`
- Match servers against the project's dependencies and tools
- Present relevant MCP server recommendations with config snippets

## Phase 3: VALIDATE

After making changes:

1. Run `score_setup` again to see the improvement
2. If the project has a build command, verify it still works
3. If the project has tests, verify they still pass
4. Show a before/after comparison of the score
5. Git commit the changes with a conventional commit message

## Iteration

After Phase 3, ask the user if they want to continue. If yes, go back to Phase 1.

Stop when:
- The score reaches 8+ out of 10
- No more improvements were made in the last iteration
- The user says to stop
- 3 iterations completed (ask for confirmation to continue)

## Safety Rules

1. Always preview before writing — never auto-write without showing the user
2. Never overwrite existing files without asking
3. Max 5 new assets per iteration
4. Only install from verified sources (github/awesome-copilot, official repos)
5. Git commit after each successful iteration
