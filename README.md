# 🔥 CopilotForge

> **One command to set up GitHub Copilot for any project.**

Analyzes your codebase, discovers the best Copilot assets for your stack, and installs them — instructions, skills, agents, prompts, and MCP servers.

[![GitHub Copilot](https://img.shields.io/badge/GitHub%20Copilot-Agent%20Mode-blue?logo=github)](https://docs.github.com/en/copilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## ⚡ Setup — 3 Steps

**Step 1 — Clone and build (one time)**

```bash
git clone https://github.com/g-mercuri/copilot-forge.git ~/copilot-forge
cd ~/copilot-forge/mcp-server && npm install && npm run build
```

**Step 2 — Register globally in VS Code**

`Ctrl+Shift+P` → **"MCP: Edit User Configuration"** → add:

```json
{
  "servers": {
    "copilot-forge": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/copilot-forge/mcp-server/dist/index.js"]
    }
  }
}
```

**Step 3 — Open any project and run in Copilot Chat (Agent Mode)**

```
/forge
```

That's it. CopilotForge scans your project, finds the best assets, and asks what to install.

---

## 🎯 What Happens When You Run `/forge`

```
🔬 Analyzing your project...
   TypeScript | React | Vitest | GitHub Actions | Docker

📊 Current Copilot score: 2/10 (F)

🔍 Found 8 relevant assets for your stack:

  # │ Type        │ Name                      │ Trust
  1 │ instruction │ typescript-strict          │ ✅
  2 │ instruction │ react-patterns             │ ✅
  3 │ instruction │ vitest-testing             │ ✅
  4 │ agent       │ code-reviewer              │ ✅
  5 │ skill       │ conventional-commit        │ ✅
  6 │ mcp-server  │ github-mcp-server          │ ✅
  7 │ prompt      │ create-test                │ ✅
  8 │ instruction │ docker-best-practices      │ ✅

Which ones to install? (all / numbers / none)
> 1, 2, 3, 4

✅ 4 assets installed. Score: 7/10 (B)
```

---

## 🛠️ MCP Tools

| Tool | R/W | Description |
|------|-----|-------------|
| `discover_assets` 🔍 | Read | Analyze project → match curated index → return ranked recommendations |
| `generate_instructions` 🧬 | **Write** | Deep-scan codebase → generate project-specific `copilot-instructions.md` |
| `install_asset` 📦 | **Write** | Install one or many assets with preview → confirm flow (batch support) |
| `score_setup` 📊 | Read | Score Copilot setup quality (0-10) with letter grade and gaps |
| `analyze_project` 🔬 | Read | Deep project scan (languages, frameworks, dependencies, customizations) |
| `apply_org_standards` 🏢 | **Write** | Apply org-wide standards from a `.github` repo or generate defaults |

### How Discovery Works

CopilotForge ships a **curated asset index** inside the MCP server. No runtime fetching, no Docker dependencies, no `#fetch` calls that break.

The index maps tech stacks to high-quality assets from multiple sources:
- [github/awesome-copilot](https://github.com/github/awesome-copilot)
- Community repositories
- [MCP Registry](https://registry.modelcontextprotocol.io)

All entries are pre-vetted for quality. The index is updated with releases.

### Covered Tech Stacks

TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, C#/.NET, Ruby, PHP, Swift, React, Next.js, Vue, Angular, Svelte, Django, FastAPI, Spring Boot, ASP.NET, Rails, Laravel, Docker, Kubernetes, Terraform, GitHub Actions, AWS, Azure, GCP, Vitest, Jest, pytest, and more.

---

## 🧬 Generate Instructions

The most impactful single feature. Scans your codebase and generates a `copilot-instructions.md` that teaches Copilot your project's conventions:

| Detects | Examples |
|---------|---------|
| Naming conventions | camelCase vars, kebab-case files, PascalCase types |
| Error handling | try-catch vs Result types, custom error classes |
| Import style | Named vs default, file extensions, sorted imports |
| Testing patterns | Framework, describe-it vs flat, mocking approach |
| Architecture | Layer-based vs feature-based, directory structure |
| Code style | Semicolons, quotes, indentation |

```
Generate instructions for this project
```

---

## 📊 Score Setup

Gamified evaluation of your Copilot setup — score, letter grade, and prioritized quick wins.

| Category | Points |
|----------|--------|
| copilot-instructions.md | 0-2 |
| Coding standards | 0-1 |
| Error handling | 0-1 |
| Testing practices | 0-1 |
| Language instructions | 0-1 |
| Security/governance | 0-1 |
| Prompts | 0-1 |
| Agents/skills | 0-1 |
| Commit conventions | 0-1 |

---

## 🏢 Enterprise: Org Standards

`apply_org_standards` applies org-wide Copilot standards from an org's `.github` repo. If no org source is given, generates defaults from detected codebase patterns.

---

## 🔄 Iterative Improvement

Run the `/forge` prompt repeatedly or use the `forge-improve` skill to iterate:

```
DISCOVER → INSTALL → VALIDATE → [repeat]
```

Each iteration improves the score. Stops at 8+ or when no more improvements are found.

---

## 🔒 Security

Every asset carries a trust badge:

| Badge | Level | Sources |
|-------|-------|---------|
| ✅ Verified | High | `github/awesome-copilot`, `microsoft/*` |
| ⚠️ Community | Medium | GitHub repos with reasonable activity |

Protection: URL allowlist, SSRF blocking, preview-by-default installs, content scanning, path traversal prevention, audit log at `~/.copilot-forge/audit.jsonl`.

---

## 🏗️ Architecture

```
MCP Tools (6):
  discover_assets       — Analyze + curated index match + rank
  generate_instructions — Auto-generate coding instructions
  install_asset         — Safe batch installer
  score_setup           — Setup quality scoring
  analyze_project       — Deep project scan
  apply_org_standards   — Org-wide consistency

Skills (3):
  forge-improve         — Iterative improvement loop
  agent-governance      — AI safety patterns
  conventional-commit   — Commit standards

Prompt (1):
  /forge                — One-command full setup

Agent (1):
  copilot-forge         — Setup orchestrator
```

### File Structure

```
.github/
├── agents/copilot-forge.agent.md
├── prompts/forge.prompt.md
└── skills/
    ├── forge-improve/
    ├── agent-governance/
    └── conventional-commit/

mcp-server/src/
├── data/asset-index.ts          # Curated asset catalog
├── tools/
│   ├── discover-assets.ts       # Analyze + match + rank
│   ├── generate-instructions.ts # Instruction generator
│   ├── install-asset.ts         # Safe batch installer
│   ├── score-setup.ts           # Setup scoring
│   ├── analyze-project.ts       # Project scanner
│   └── apply-org-standards.ts   # Org standards
├── security/                    # URL validation, content scanning, audit
├── core/                        # Scoring engine, git operations
└── analyzers/                   # Code pattern detection
```

---

## 🧪 Testing

```bash
cd mcp-server
npm run build    # tsc → dist/
npm run test     # vitest
npm run lint     # eslint
```

---

## 🤝 Contributing

- 🐛 **Report bugs** — Open an issue
- 💡 **Suggest features** — New asset index entries, workflow ideas
- 🔧 **Submit PRs** — Improve tools, add curated assets, fix bugs
- 📖 **Improve docs** — Clearer instructions, more examples

Please open an issue before submitting large changes.

---

## 📄 License

[MIT License](LICENSE)

---

<p align="center">
  <strong>🔥 CopilotForge</strong> — One command to set up Copilot for any project<br>
  Built with ❤️ for the GitHub Copilot community
</p>
