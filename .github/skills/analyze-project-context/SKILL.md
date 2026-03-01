---
name: analyze-project-context
description: Deeply analyze the current repository to build a structured project context profile covering languages, frameworks, CI/CD, cloud providers, architecture patterns, and improvement opportunities
---

# Analyze Project Context

Perform a comprehensive analysis of the current repository to produce a structured **Project Context Profile**. This profile is consumed by other discovery skills (e.g., `discover-from-awesome-copilot`, `discover-from-github-search`, `discover-from-mcp-registry`) to match the project against relevant tools, skills, agents, and best practices.

> [!IMPORTANT]
> Always run this skill **before** any discovery skill so they have an up-to-date profile to work with.

---

## Analysis Process

Execute each phase below in order. Use `#codebase` for file-tree exploration and content inspection, and `#search` for pattern matching across the repository.

### Phase 1 — Languages & Runtimes

Scan the repository to identify all programming languages and their relative prevalence.

1. Use `#codebase` to list all file extensions and count occurrences.
2. Map extensions to languages (e.g., `.ts` → TypeScript, `.py` → Python, `.cs` → C#, `.go` → Go, `.rs` → Rust, `.java` → Java, `.rb` → Ruby, `.swift` → Swift, `.kt` → Kotlin).
3. Identify the **primary language** (highest file count) and all **secondary languages**.
4. Check for runtime version files: `.nvmrc`, `.node-version`, `.python-version`, `.ruby-version`, `.tool-versions`, `global.json`, `rust-toolchain.toml`.
5. Record any language-specific configuration: `tsconfig.json`, `pyproject.toml`, `.eslintrc.*`, `.prettierrc`, `rustfmt.toml`, `.editorconfig`.

### Phase 2 — Frameworks & Libraries

Detect frameworks and major libraries by inspecting manifest and lock files.

| Ecosystem | Manifest Files | Lock Files |
|-----------|---------------|------------|
| Node.js / JavaScript | `package.json` | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb` |
| Python | `requirements.txt`, `pyproject.toml`, `setup.py`, `setup.cfg`, `Pipfile` | `Pipfile.lock`, `poetry.lock`, `uv.lock` |
| .NET / C# | `*.csproj`, `*.fsproj`, `*.sln`, `Directory.Build.props`, `global.json` | `packages.lock.json` |
| Go | `go.mod` | `go.sum` |
| Rust | `Cargo.toml` | `Cargo.lock` |
| Java / Kotlin | `pom.xml`, `build.gradle`, `build.gradle.kts` | `gradle.lockfile` |
| Ruby | `Gemfile` | `Gemfile.lock` |
| PHP | `composer.json` | `composer.lock` |
| Swift | `Package.swift` | `Package.resolved` |

For each detected manifest:

1. Parse dependencies to identify **web frameworks** (Express, Next.js, Django, Flask, FastAPI, ASP.NET, Spring Boot, Rails, Laravel, Gin, Actix, etc.).
2. Identify **UI frameworks** (React, Vue, Angular, Svelte, Blazor, SwiftUI, etc.).
3. Identify **testing frameworks** (Jest, Mocha, pytest, unittest, xUnit, NUnit, JUnit, RSpec, Go testing, etc.).
4. Identify **ORM / database libraries** (Prisma, TypeORM, SQLAlchemy, Entity Framework, GORM, Diesel, ActiveRecord, etc.).
5. Identify **API styles** (REST, GraphQL, gRPC, tRPC, OpenAPI/Swagger specs).

### Phase 3 — Package Managers & Build Tools

1. Detect package managers: npm, yarn, pnpm, bun, pip, poetry, uv, conda, dotnet, nuget, cargo, go modules, maven, gradle, bundler, composer.
2. Detect build tools: webpack, vite, esbuild, turbopack, rollup, parcel, MSBuild, make, cmake, bazel, nx, turborepo, lerna.
3. Detect monorepo tooling: workspace configuration in `package.json`, `pnpm-workspace.yaml`, `nx.json`, `turbo.json`, `lerna.json`, Cargo workspaces, Go workspaces.
4. Note any task runners: npm scripts, Makefile targets, `justfile`, `Taskfile.yml`.

### Phase 4 — CI/CD & DevOps Configuration

Search for CI/CD configuration files and analyze their pipelines.

| CI/CD System | Config Paths |
|-------------|-------------|
| GitHub Actions | `.github/workflows/*.yml`, `.github/workflows/*.yaml` |
| Azure Pipelines | `azure-pipelines.yml`, `.azure-pipelines/` |
| Jenkins | `Jenkinsfile`, `jenkins/` |
| GitLab CI | `.gitlab-ci.yml` |
| CircleCI | `.circleci/config.yml` |
| Travis CI | `.travis.yml` |
| Bitbucket Pipelines | `bitbucket-pipelines.yml` |

For each detected CI/CD config:

1. List pipeline triggers (push, PR, schedule, manual).
2. Identify pipeline stages (build, test, lint, deploy, security scan).
3. Note deployment targets (Azure, AWS, GCP, Vercel, Netlify, Heroku, Kubernetes, Docker registries).
4. Check for security scanning steps (CodeQL, Dependabot, Snyk, Trivy, SAST/DAST).
5. Check for code quality gates (SonarQube, Codacy, Codecov, Coveralls).

### Phase 5 — Cloud Provider & Infrastructure

Detect cloud provider usage and infrastructure-as-code patterns.

**Azure indicators:**
- `azure-pipelines.yml`, `azure.yaml` (azd), `*.bicep`, `azuredeploy.json` (ARM templates)
- References to `azure`, `az cli`, `Azure SDK` in code or config
- `AZURE_*` environment variables, Azure service connection references

**AWS indicators:**
- `serverless.yml`, `template.yaml` (SAM), `cdk.json`, `*.tf` with AWS providers
- `aws-exports.js`, `.aws/`, `amplify/`
- References to `aws-sdk`, `boto3`, AWS service names

**GCP indicators:**
- `app.yaml` (App Engine), `cloudbuild.yaml`, `*.tf` with Google providers
- `firebase.json`, `.firebaserc`
- References to `@google-cloud/*`, Google service names

**Infrastructure-as-Code:**
- Terraform: `*.tf`, `*.tfvars`, `.terraform.lock.hcl`
- Pulumi: `Pulumi.yaml`, `Pulumi.*.yaml`
- Bicep: `*.bicep`, `bicepconfig.json`
- CloudFormation / SAM: `template.yaml`, `template.json`
- CDK: `cdk.json`, `cdk.out/`
- Helm: `Chart.yaml`, `values.yaml`, `templates/`

**Containerization:**
- `Dockerfile`, `docker-compose.yml`, `docker-compose.yaml`, `.dockerignore`
- `containerapp.yaml`, Kubernetes manifests (`k8s/`, `kustomization.yaml`)

### Phase 6 — Architecture Patterns

Assess the project's architectural style by examining directory structure and configuration.

1. **Monolith** — Single deployable unit; look for a single entry point, one `Dockerfile`, flat source structure.
2. **Microservices** — Multiple services; look for `services/`, `apps/`, multiple `Dockerfile`s, docker-compose with multiple services, Kubernetes deployments.
3. **Serverless** — Function-based; look for `serverless.yml`, AWS SAM `template.yaml`, Azure Functions (`host.json`, `function.json`), `firebase.json` with functions.
4. **Monorepo** — Multiple packages/apps in one repo; look for workspace configs, `packages/`, `apps/`, `libs/` directories.
5. **Jamstack / Static** — Static site generators; look for `gatsby-config.*`, `next.config.*` with static export, `nuxt.config.*`, `astro.config.*`, `hugo.toml`, `_config.yml` (Jekyll).
6. **Event-driven** — Message/event patterns; look for queue/topic configurations, event handler patterns, pub/sub references.

### Phase 7 — Existing GitHub Customizations

Scan the `.github/` directory for existing Copilot and repository customizations.

1. **Copilot Instructions**: `.github/copilot-instructions.md` — existing global instructions.
2. **Copilot Skills**: `.github/skills/*/SKILL.md` — list all installed skills by name and description.
3. **Copilot Agents**: `.github/agents/*/AGENT.md` — list all installed agents by name and description.
4. **Copilot Prompts**: `.github/prompts/*.prompt.md` — list all reusable prompts.
5. **Issue Templates**: `.github/ISSUE_TEMPLATE/` — existing issue templates.
6. **PR Templates**: `.github/PULL_REQUEST_TEMPLATE.md` or `.github/PULL_REQUEST_TEMPLATE/`.
7. **Code Owners**: `.github/CODEOWNERS` or `CODEOWNERS`.
8. **Funding**: `.github/FUNDING.yml`.
9. **Dependabot**: `.github/dependabot.yml`.
10. **Branch Protection / Rulesets**: Note if referenced in CI/CD configs.

### Phase 8 — Pain Points & Improvement Signals

Use `#search` to detect signals of technical debt and areas needing attention.

**Code quality markers:**
1. Count occurrences of `TODO`, `FIXME`, `HACK`, `XXX`, `WORKAROUND`, `TEMP`, `DEPRECATED` comments across the codebase.
2. Group counts by directory/module to identify hotspots.

**Test coverage indicators:**
1. Look for test directories: `test/`, `tests/`, `__tests__/`, `spec/`, `*_test.go`, `*_test.rs`, `*.test.*`, `*.spec.*`.
2. Check for coverage configuration: `.nycrc`, `jest.config.*` with coverage settings, `.coveragerc`, `pytest.ini` / `pyproject.toml` coverage sections, `coverlet` references in `.csproj`.
3. Estimate test-to-source file ratio per language.
4. Look for coverage reports or badges in `README.md`.

**Documentation gaps:**
1. Check for `README.md` at root and in key subdirectories.
2. Look for `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`.
3. Look for API documentation: OpenAPI/Swagger specs, generated docs, doc comments coverage.
4. Check for architecture decision records (`docs/adr/`, `docs/decisions/`).

**Dependency health:**
1. Check for Dependabot or Renovate configuration.
2. Look for lock file age (last modified date if available).
3. Note any pinned major versions that appear significantly outdated.

**Security posture:**
1. Check for `.env.example` (good) vs `.env` committed (bad — flag as critical).
2. Look for secret scanning configuration, `SECURITY.md`, security policy.
3. Check for SAST/DAST tools in CI/CD pipeline.
4. Look for `npm audit`, `pip audit`, `cargo audit`, or equivalent in scripts/CI.

---

## Output Format

Produce the Project Context Profile as a structured markdown summary with the following sections. Use concise bullet points and tables. Omit any section that has no findings.

```markdown
# Project Context Profile

## Summary
<!-- One-paragraph overview: what this project is, primary language, key framework, deployment target -->

## Languages & Runtimes
| Language | File Count | Primary | Runtime Version |
|----------|-----------|---------|-----------------|

## Frameworks & Libraries
| Category | Name | Version | Notes |
|----------|------|---------|-------|

## Package Managers & Build Tools
- **Package Manager**: ...
- **Build Tool**: ...
- **Monorepo**: yes/no (tool: ...)
- **Task Runner**: ...

## CI/CD Configuration
| System | Config Path | Stages | Deploy Target |
|--------|------------|--------|---------------|

## Cloud & Infrastructure
- **Cloud Provider(s)**: ...
- **IaC Tool**: ...
- **Containerized**: yes/no
- **Orchestration**: ...

## Architecture
- **Pattern**: Monolith / Microservices / Serverless / Monorepo / Jamstack
- **API Style**: REST / GraphQL / gRPC / ...
- **Key Directories**: ...

## Existing GitHub Customizations
| Type | Name | Path |
|------|------|------|

## Pain Points & Technical Debt
### Code Quality Markers
| Marker | Count | Top Hotspots |
|--------|-------|-------------|

### Test Coverage
- **Test-to-Source Ratio**: ...
- **Coverage Tool**: ...
- **Estimated Coverage**: ...

### Documentation Gaps
- [ ] README.md
- [ ] CONTRIBUTING.md
- [ ] CHANGELOG.md
- [ ] API Documentation
- [ ] Architecture Decision Records

### Dependency Health
- **Auto-update Tool**: Dependabot / Renovate / None
- **Outdated Dependencies**: ...

### Security Posture
- **Secret Scanning**: ...
- **SAST/DAST in CI**: ...
- **Security Policy**: ...

## Recommended Focus Areas
<!-- Prioritized list of improvements based on detected gaps -->
1. ...
2. ...
3. ...
```

---

## Recommended Focus Areas Logic

After completing the analysis, generate a prioritized list of recommended focus areas using these rules:

| Priority | Condition | Recommendation |
|----------|-----------|----------------|
| 🔴 Critical | `.env` file committed to repo | Remove `.env` from tracking, add to `.gitignore`, rotate any exposed secrets |
| 🔴 Critical | No CI/CD pipeline detected | Set up GitHub Actions for build, test, and lint |
| 🟠 High | No tests detected | Add a testing framework and starter tests for critical paths |
| 🟠 High | No Dependabot/Renovate config | Enable automated dependency updates |
| 🟠 High | No security scanning in CI | Add CodeQL or equivalent SAST scanning |
| 🟡 Medium | TODO/FIXME count > 20 | Triage and address accumulated technical debt |
| 🟡 Medium | No `CONTRIBUTING.md` | Add contribution guidelines to reduce onboarding friction |
| 🟡 Medium | No Copilot instructions file | Create `.github/copilot-instructions.md` with project-specific context |
| 🟢 Low | No `CHANGELOG.md` | Consider adopting conventional commits and auto-generated changelogs |
| 🟢 Low | No architecture decision records | Start an ADR practice for significant technical decisions |
| 🟢 Low | Missing `SECURITY.md` | Add a security policy with vulnerability reporting instructions |

Include only recommendations that apply to the analyzed project. For each recommendation, briefly explain **why** it matters and suggest a concrete next step.
