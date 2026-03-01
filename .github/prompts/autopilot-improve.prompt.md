---
mode: agent
description: "Run the autopilot improvement loop — iteratively discover, install, validate and patch Copilot customizations for this project"
tools: ["search/codebase", "web/fetch", "web/githubRepo", "execute/getTerminalOutput", "execute/runInTerminal", "read/terminalLastCommand", "edit/editFiles"]
---

# Autopilot Improve

Run the `autopilot-improve` skill to start the iterative self-improvement loop.

## Context

- This project already has Copilot customizations in `.github/`
- The autopilot will discover new assets, install the best ones, validate them, and patch any issues
- Each iteration adds up to 5 new assets and validates the project still builds and tests pass
- The loop stops when there are no more high-value assets to install, or after 5 iterations

## Instructions

1. First, take inventory of what's already installed in `.github/` (agents, skills, prompts, instructions)
2. Analyze the project's tech stack (languages, frameworks, tools)
3. Search awesome-copilot for the latest assets matching this stack
4. Filter out already-installed assets
5. Select the top 3-5 highest-value uninstalled assets
6. Install them into the correct `.github/` subdirectories
7. Validate each installed asset:
   - Check YAML frontmatter is valid
   - Check `applyTo` patterns match actual project files (e.g., don't install JS-only instructions for a TS project)
   - Verify build still passes (`npx tsc --noEmit` if TypeScript)
   - Verify tests still pass (`npm test` if configured)
8. Patch any issues found (fix applyTo, add missing frontmatter)
9. Generate an iteration report showing what changed
10. Ask if the user wants to continue with another iteration
11. Git commit after each successful iteration

## Safety

- Only install from verified sources (github/awesome-copilot, anthropics/skills)
- Never overwrite existing files
- Max 5 new assets per iteration
- If build breaks, revert the changes immediately
- Always show what was installed before committing
