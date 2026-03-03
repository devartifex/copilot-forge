---
mode: agent
description: "One-command Copilot setup — analyze, discover, score, and install the best assets for your project"
tools: ["search/codebase", "execute/getTerminalOutput", "execute/runInTerminal", "edit/editFiles"]
---

# Forge — Set Up Copilot for Your Project

One command to analyze your codebase, find the best Copilot assets, and install them.

## Flow (2 tool calls total)

### Step 1: Discover (1 tool call)

Run `discover_assets` with the project path. This returns everything in one call:
- Detected stack (languages, frameworks, CI/CD, cloud)
- Current Copilot setup score with letter grade
- Ranked asset recommendations filtered by what's already installed

Show the score and recommendations to the user as a numbered list.
Ask which assets to install: "all", specific numbers, or "none".

### Step 2: Install (1 tool call)

Use `install_asset` with the `assets` array and `confirm: true` to install all selected assets in one batch call. All URLs are fetched in parallel.

If the user wants to preview first, call with `confirm: false`, then call again with `confirm: true`.

### Optional: Generate Instructions

If the project doesn't have a `copilot-instructions.md` and the user wants one:
Run `generate_instructions` with `confirm: true`.

## Safety

- Show recommendations before installing
- Never overwrite without asking
