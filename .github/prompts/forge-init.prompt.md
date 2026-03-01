---
mode: agent
description: "One-command Copilot setup — analyze your codebase, generate instructions, score your setup, and recommend improvements"
tools: ["search/codebase", "web/fetch", "web/githubRepo", "execute/getTerminalOutput", "execute/runInTerminal", "read/terminalLastCommand", "edit/editFiles"]
---

# Forge Init — Make Copilot Understand Your Codebase in 30 Seconds

Set up a world-class Copilot configuration for this project in one shot.

## What This Does

1. **Analyze** — Deep-scan the codebase for patterns, conventions, and architecture
2. **Generate** — Create a project-specific `copilot-instructions.md` from detected patterns
3. **Score** — Evaluate the setup and identify gaps
4. **Recommend** — Suggest additional skills, agents, and MCP servers
5. **Report** — Show what changed and what the score is now

## Instructions

### Phase 1: Generate Instructions

1. Use the `generate_instructions` MCP tool with the project path and `confirm: false` to preview
2. Show the user what was detected (naming conventions, error handling, import style, etc.)
3. Ask if they want to proceed — if yes, call again with `confirm: true`

### Phase 2: Generate Org Standards

1. Use the `generate_org_standards` MCP tool with `standards: ["all"]` and `confirm: false`
2. Show the preview of org-level instruction files that would be created
3. Ask the user which standards they want — they might not want all of them
4. Install the selected ones with `confirm: true`

### Phase 3: Score

1. Use the `score_setup` MCP tool to evaluate the setup
2. Show the scorecard with the letter grade
3. Highlight any remaining gaps

### Phase 4: Discover & Recommend

1. Use the `recommend_skills` MCP tool to find relevant assets from the ecosystem
2. Show the top 5 recommendations
3. Ask if they want to install any

### Phase 5: Commit

1. Show a summary of all changes made
2. Git commit with a conventional commit message:
   ```
   feat: initialize Copilot setup with generated instructions and standards
   ```
3. Show the final score

## Safety

- Always preview before writing
- Never overwrite without asking
- Back up any existing files
- Show exactly what will change before committing
