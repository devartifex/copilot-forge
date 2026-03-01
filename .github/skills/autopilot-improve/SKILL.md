---
name: autopilot-improve
description: |
  Iterative self-improvement autopilot. Runs a discover→install→validate→patch cycle
  to continuously improve the project's Copilot setup. Each iteration makes the agent
  more capable for the next. Use when asked to "autopilot", "auto-improve", "self-improve",
  or "iterate on improvements".
---

# Autopilot Improve — Iterative Self-Improvement Loop

Run an automated cycle that discovers, installs, validates, and patches Copilot customizations
for the current project. Each iteration builds on the previous one.

## The Loop

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌──────────┐   ┌───────────┐   ┌─────────┐   ┌────────┐ │
│  │ ANALYZE  │──▶│ DISCOVER  │──▶│ INSTALL │──▶│VALIDATE│ │
│  └──────────┘   └───────────┘   └─────────┘   └────────┘ │
│       ▲                                            │       │
│       │         ┌─────────┐   ┌────────┐          │       │
│       └─────────│ REPORT  │◀──│ PATCH  │◀─────────┘       │
│                 └─────────┘   └────────┘                   │
│                      │                                     │
│                      ▼                                     │
│              [Continue? Y/N]──────▶ Loop again             │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: ANALYZE

Scan the project to build the current state snapshot:

1. **Inventory existing customizations** — list all files in `.github/` (agents, skills, prompts, instructions, workflows)
2. **Detect tech stack** — languages, frameworks, package managers, CI/CD, cloud providers
3. **Check project health** — missing files (LICENSE, CONTRIBUTING.md, SECURITY.md, CHANGELOG.md, copilot-instructions.md, dependabot.yml)
4. **Count metrics** — source files, test files, test-to-source ratio, TODO/FIXME count
5. **Record baseline** — store the inventory count and health score for comparison

## Phase 2: DISCOVER

Search all available sources for assets relevant to this project:

1. **Search awesome-copilot** — fetch latest catalog from `github/awesome-copilot` (instructions, skills, agents, prompts)
2. **Search MCP Registry** — query `registry.modelcontextprotocol.io` for relevant MCP servers
3. **Search GitHub** — find community repos with `copilot-agent`, `copilot-skill`, `mcp-server` topics
4. **Filter out already-installed** — compare against the Phase 1 inventory
5. **Rank by relevance** — score by tech stack match, gap-filling value, trust level, popularity
6. **Select top candidates** — pick the top 3-5 highest-value items per iteration (don't install too many at once)

### Selection Criteria (per iteration)
- Max **5 new assets** per iteration (to keep changes reviewable)
- Prefer **instructions** and **skills** over agents (more targeted, less risk)
- Prefer **verified sources** (✅) over community (⚠️) — never install unknown (❌) in autopilot
- Prefer assets that **fill gaps** over ones that overlap with existing

## Phase 3: INSTALL

For each selected asset:

1. **Download** from the source URL
2. **Place** in the correct `.github/` subdirectory:
   - Instructions → `.github/instructions/`
   - Skills → `.github/skills/{name}/SKILL.md`
   - Agents → `.github/agents/`
   - Prompts → `.github/prompts/`
3. **Never overwrite** existing files — skip if a file with the same name exists
4. **Log the action** — record what was installed, from where, and when

## Phase 4: VALIDATE

After installing, verify everything still works:

### 4a. Structural Validation
For each installed file:
- [ ] Has valid YAML frontmatter (starts with `---`)
- [ ] `name` or `description` field present in frontmatter
- [ ] File is non-empty and under 500KB
- [ ] No suspicious patterns (script tags, shell commands, prompt injection)

### 4b. Relevance Validation
- [ ] **applyTo patterns** (if present) match files that actually exist in the project
  - Example: `applyTo: '**/*.js'` is useless in a TypeScript-only project
  - Flag mismatches for patching
- [ ] **Skill descriptions** reference technologies used by this project
- [ ] **Agent tools** reference MCP servers that are configured (or don't require MCP)

### 4c. Build Validation
- [ ] TypeScript still compiles: `npx tsc --noEmit` (if applicable)
- [ ] Tests still pass: `npm test` (if applicable)
- [ ] Lint still passes: `npm run lint` (if applicable)

### 4d. Conflict Detection
- [ ] No two instructions have conflicting rules
- [ ] No two skills overlap in purpose
- [ ] No new skill supersedes an existing one without flagging it

## Phase 5: PATCH

Fix issues found during validation:

1. **applyTo mismatch** — If an instruction has `applyTo: '**/*.js'` but project is TypeScript,
   create a patched copy with corrected `applyTo` (e.g., add `**/*.ts, **/*.mts`)
2. **Missing frontmatter** — Add minimal frontmatter if missing
3. **Trim oversized files** — If a file is unreasonably large, warn and skip
4. **Remove broken installs** — If validation failed critically, delete the file and log why

## Phase 6: REPORT

Generate an iteration report:

```
## 🔄 Autopilot Iteration #{n} Report

### Changes Made
| Action | Asset | Source | Status |
|--------|-------|--------|--------|
| ✅ Installed | {name} | awesome-copilot | Valid |
| ✅ Installed | {name} | awesome-copilot | Patched (applyTo fixed) |
| ❌ Skipped | {name} | github-search | Failed validation |

### Project Health
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Customizations | 14 | 17 | +3 |
| Instructions | 3 | 5 | +2 |
| Skills | 7 | 8 | +1 |
| Build | ✅ | ✅ | — |
| Tests | 103 pass | 103 pass | — |

### Remaining Opportunities
- {count} more assets could be installed in the next iteration
- Top candidate for next iteration: {name}

### Decision
- **Continue?** {Yes — there are valuable assets remaining / No — diminishing returns}
```

## Stopping Criteria

Stop the autopilot loop when ANY of these are true:
- All ⭐⭐⭐ assets for this tech stack are already installed
- The last iteration installed 0 new assets (everything was already present or filtered out)
- Build or tests broke and couldn't be auto-fixed
- User explicitly stops the loop
- 5 iterations completed (safety limit — require user confirmation to continue)

## Safety Rules

1. **Never install from unknown/untrusted sources** in autopilot mode
2. **Never overwrite existing files** — only add new ones
3. **Always validate after installing** — if build breaks, revert
4. **Max 5 assets per iteration** — keep changes small and reviewable
5. **Max 5 iterations** without user confirmation
6. **Git commit after each successful iteration** — so changes can be reverted individually
7. **Show the report** after each iteration — transparency is mandatory
