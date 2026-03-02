---
mode: agent
description: "Run the autopilot improvement loop — iteratively analyze, improve, and validate Copilot customizations for this project"
tools: ["search/codebase", "web/fetch", "web/githubRepo", "execute/getTerminalOutput", "execute/runInTerminal", "read/terminalLastCommand", "edit/editFiles"]
---

# Autopilot Improve

Run the `autopilot-improve` skill to start the iterative self-improvement loop.

## Context

- This project may or may not already have Copilot customizations in `.github/`
- The autopilot will analyze the project, generate/install missing assets, and validate them
- Each iteration improves the Copilot setup score
- The loop stops when the score is high or no more improvements can be made

## Instructions

1. Run `analyze_project` and `score_setup` to understand the current state
2. Based on score gaps, use `generate_instructions`, `apply_org_standards`, and discovery via `#fetch`
3. After changes, re-score and show the improvement
4. Ask if the user wants to continue with another iteration
5. Git commit after each successful iteration

## Safety

- Only install from verified sources (github/awesome-copilot, official repos)
- Never overwrite existing files
- Max 5 new assets per iteration
- If build breaks, revert immediately
- Always show what was changed before committing
