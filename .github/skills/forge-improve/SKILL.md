---
name: forge-improve
description: |
  Iterative improvement loop. Runs analyze → improve → validate to enhance
  the project's Copilot setup. Use when asked to "improve", "iterate",
  or "self-improve".
---

# Forge Improve — Iterative Setup Enhancement

Run a 3-phase cycle that discovers gaps, installs improvements, and validates.

```
DISCOVER → INSTALL → VALIDATE → [repeat?]
```

## Phase 1: DISCOVER

1. Run `discover_assets` to get recommendations for the project
2. Run `score_setup` to get the current score and identify gaps
3. Note which score categories are at 0 — these are the improvement targets

## Phase 2: INSTALL

Based on the gaps found:

### If copilot-instructions.md is missing or weak:
- Run `generate_instructions` with `confirm: false` to preview
- Show the user what was detected, then write with `confirm: true`

### If org standards are missing:
- Run `apply_org_standards` with `confirm: false` to preview
- Let the user pick which standards to apply, then write with `confirm: true`

### If skills/prompts/agents are missing:
- Use the recommendations from `discover_assets`
- Present the top 3-5 most relevant uninstalled assets
- For each selected asset, use `install_asset` (batch mode) to install

## Phase 3: VALIDATE

1. Run `score_setup` again to see the improvement
2. If the project has a build command, verify it still works
3. Show a before/after comparison of the score
4. Git commit the changes with a conventional commit message

## Iteration

After Phase 3, ask the user if they want to continue. If yes, go back to Phase 1.

Stop when:
- The score reaches 8+ out of 10
- No more improvements were made in the last iteration
- The user says to stop
- 3 iterations completed (ask for confirmation to continue)

## Safety Rules

1. Always preview before writing
2. Never overwrite existing files without asking
3. Max 5 new assets per iteration
4. Git commit after each successful iteration
