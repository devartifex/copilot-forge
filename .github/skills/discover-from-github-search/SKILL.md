---
name: discover-from-github-search
description: >
  Discovers relevant GitHub Copilot customizations (agents, skills, instructions, prompts)
  by searching GitHub repositories beyond the official awesome-copilot collection.
---

# Discover Copilot Customizations from GitHub Search

A GitHub Copilot Agent Skill that discovers relevant Copilot customizations—agents, skills,
instructions, and prompts—by searching GitHub repositories beyond the official awesome-copilot
collection.

## Process

### 1. Accept Project Context Profile

Take the project context profile as input, including:

- Programming languages
- Frameworks and libraries
- Build tools and package managers
- Domain or industry context

### 2. Search GitHub for Copilot Customization Repositories

Use `#githubRepo` and `#fetch` tools to search GitHub for repositories with relevant topics:

**Topics to search:**

- `copilot-instructions`
- `copilot-prompting`
- `copilot-agent`
- `agent-skills`
- `github-copilot`
- `copilot-skills`

**File-based searches:**

Also search for repositories containing these known Copilot customization files:

- `.instructions.md`
- `SKILL.md`
- `.agent.md`
- `.prompt.md`

**Key GitHub search queries** (via `#fetch` with GitHub API or search URLs):

```
topic:copilot-instructions language:{detected-language}
topic:copilot-agent
topic:agent-skills
"copilot-instructions.md" in:path
"SKILL.md" in:path copilot
```

**Additional searches:**

- Framework-specific copilot customizations (e.g., `react copilot instructions`,
  `terraform copilot agent`)
- Industry/domain-specific agents (e.g., healthcare, fintech, devops)

### 3. Evaluate Each Discovered Repository

For each discovered repository:

- Check star count, last update date, and description.
- Filter out low-quality results using the quality criteria below.
- Categorize by asset type: **instruction**, **skill**, **agent**, **prompt**, or **collection**.

### 4. Match Against Project Context

Cross-reference discovered assets with the project context:

- Language alignment (e.g., Python skills for Python projects)
- Framework relevance (e.g., Next.js instructions for Next.js apps)
- Use-case fit (e.g., testing agents for test-heavy workflows)

### 5. Deduplicate Against awesome-copilot

Check for overlap with the official `awesome-copilot` collection to avoid recommending
assets the user may already know about. Flag any duplicates and prefer the original source.

### 6. Present Ranked Results

Present a ranked table of recommendations:

| Source Repo | Asset Type | Name | Description | Stars | Last Updated | Relevance |
|-------------|------------|------|-------------|-------|--------------|-----------|
| `owner/repo` | instruction | Name | Short description | ⭐ 120 | 2024-10-15 | High |

### 7. Provide Installation Instructions

For each recommendation, provide:

- Direct link to the repository
- Installation or adoption instructions (e.g., how to copy an `.instructions.md` file
  into the project, or how to register a skill)
- Any prerequisites or dependencies

### 8. Await User Confirmation

**AWAIT user confirmation before downloading or applying any customizations.**

Do not modify the project until the user explicitly approves which assets to install.

## Quality Filters

All discovered repositories must pass these quality gates:

| Criterion              | Threshold                        |
|------------------------|----------------------------------|
| Minimum stars          | ≥ 5                              |
| Last updated           | Within the last 6 months         |
| Documentation          | Has a README or equivalent docs  |
| Originality            | Not a fork (prefer originals)    |

## Example Usage

Given a project context like:

```yaml
languages: [TypeScript, Python]
frameworks: [Next.js, FastAPI]
tools: [Docker, Terraform]
```

The skill would search for:

- `topic:copilot-instructions language:TypeScript`
- `topic:copilot-instructions language:Python`
- `"copilot-instructions.md" in:path nextjs OR next.js`
- `topic:copilot-agent fastapi`
- `"SKILL.md" in:path terraform`

And return a deduplicated, ranked list of relevant Copilot customizations with
installation guidance.
