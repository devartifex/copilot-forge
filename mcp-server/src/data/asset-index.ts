export type AssetType =
  | "instruction"
  | "prompt"
  | "skill"
  | "agent"
  | "mcp-server";

export type QualityTier = "verified" | "community";

export interface CuratedAsset {
  name: string;
  type: AssetType;
  description: string;
  source_url: string;
  tags: string[];
  quality_tier: QualityTier;
}

export const CURATED_ASSETS: CuratedAsset[] = [
  // ─── TypeScript / JavaScript ─────────────────────────────────────────
  {
    name: "typescript-strict",
    type: "instruction",
    description:
      "Enforce strict TypeScript conventions: strict mode, explicit return types, no-any, readonly-first",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/typescript/typescript.instructions.md",
    tags: ["TypeScript", "JavaScript"],
    quality_tier: "verified",
  },
  {
    name: "nodejs-best-practices",
    type: "instruction",
    description:
      "Node.js patterns: ESM modules, async/await, error handling, environment config",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/javascript/nodejs.instructions.md",
    tags: ["JavaScript", "TypeScript", "Node.js", "Express", "Fastify", "NestJS", "Hono"],
    quality_tier: "verified",
  },

  // ─── React / Vue / Angular / Svelte ──────────────────────────────────
  {
    name: "react-patterns",
    type: "instruction",
    description:
      "React best practices: hooks, component patterns, state management, performance",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/react/react.instructions.md",
    tags: ["React", "Next.js", "Remix", "TypeScript", "JavaScript"],
    quality_tier: "verified",
  },
  {
    name: "nextjs-patterns",
    type: "instruction",
    description:
      "Next.js App Router conventions: server components, data fetching, middleware, caching",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/react/nextjs.instructions.md",
    tags: ["Next.js", "React", "TypeScript"],
    quality_tier: "verified",
  },
  {
    name: "vue-patterns",
    type: "instruction",
    description:
      "Vue 3 Composition API, reactivity patterns, component design, Pinia state",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/vue/vue.instructions.md",
    tags: ["Vue", "Nuxt", "TypeScript", "JavaScript"],
    quality_tier: "verified",
  },
  {
    name: "angular-patterns",
    type: "instruction",
    description:
      "Angular conventions: signals, standalone components, dependency injection, RxJS",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/angular/angular.instructions.md",
    tags: ["Angular", "TypeScript"],
    quality_tier: "verified",
  },
  {
    name: "svelte-patterns",
    type: "instruction",
    description:
      "Svelte/SvelteKit patterns: runes, stores, load functions, form actions",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/svelte/svelte.instructions.md",
    tags: ["Svelte", "TypeScript", "JavaScript"],
    quality_tier: "verified",
  },

  // ─── Python ──────────────────────────────────────────────────────────
  {
    name: "python-best-practices",
    type: "instruction",
    description:
      "Python coding standards: type hints, PEP 8, dataclasses, async patterns, virtual environments",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/python/python.instructions.md",
    tags: ["Python"],
    quality_tier: "verified",
  },
  {
    name: "django-patterns",
    type: "instruction",
    description:
      "Django conventions: models, views, serializers, admin, testing, security",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/python/django.instructions.md",
    tags: ["Django", "Python"],
    quality_tier: "verified",
  },
  {
    name: "fastapi-patterns",
    type: "instruction",
    description:
      "FastAPI patterns: dependency injection, Pydantic models, async endpoints, OpenAPI",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/python/fastapi.instructions.md",
    tags: ["FastAPI", "Python"],
    quality_tier: "verified",
  },

  // ─── Go ──────────────────────────────────────────────────────────────
  {
    name: "go-best-practices",
    type: "instruction",
    description:
      "Go conventions: error handling, interfaces, concurrency, project layout, testing",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/go/go.instructions.md",
    tags: ["Go", "Go Modules"],
    quality_tier: "verified",
  },

  // ─── Rust ────────────────────────────────────────────────────────────
  {
    name: "rust-best-practices",
    type: "instruction",
    description:
      "Rust conventions: ownership, error handling with Result/Option, traits, lifetimes, testing",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/rust/rust.instructions.md",
    tags: ["Rust", "Rust/Cargo"],
    quality_tier: "verified",
  },

  // ─── Java / Kotlin ───────────────────────────────────────────────────
  {
    name: "java-best-practices",
    type: "instruction",
    description:
      "Java conventions: records, sealed classes, streams, Optional, Spring patterns",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/java/java.instructions.md",
    tags: ["Java"],
    quality_tier: "verified",
  },
  {
    name: "spring-boot-patterns",
    type: "instruction",
    description:
      "Spring Boot: dependency injection, REST controllers, JPA repositories, testing",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/java/spring-boot.instructions.md",
    tags: ["Java", "Spring Boot"],
    quality_tier: "verified",
  },
  {
    name: "kotlin-best-practices",
    type: "instruction",
    description:
      "Kotlin conventions: coroutines, data classes, extension functions, null safety",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/kotlin/kotlin.instructions.md",
    tags: ["Kotlin"],
    quality_tier: "verified",
  },

  // ─── C# / .NET ──────────────────────────────────────────────────────
  {
    name: "csharp-best-practices",
    type: "instruction",
    description:
      "C# conventions: nullable references, records, LINQ, async/await, dependency injection",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/csharp/csharp.instructions.md",
    tags: ["C#", "ASP.NET", "Blazor"],
    quality_tier: "verified",
  },
  {
    name: "aspnet-patterns",
    type: "instruction",
    description:
      "ASP.NET Core: minimal APIs, controllers, middleware, Entity Framework, authentication",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/csharp/aspnet.instructions.md",
    tags: ["C#", "ASP.NET"],
    quality_tier: "verified",
  },

  // ─── Ruby ────────────────────────────────────────────────────────────
  {
    name: "ruby-best-practices",
    type: "instruction",
    description:
      "Ruby conventions: blocks, modules, testing with RSpec/Minitest, metaprogramming",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/ruby/ruby.instructions.md",
    tags: ["Ruby"],
    quality_tier: "verified",
  },
  {
    name: "rails-patterns",
    type: "instruction",
    description:
      "Rails: MVC, ActiveRecord, migrations, concerns, testing, API mode",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/ruby/rails.instructions.md",
    tags: ["Ruby", "Rails"],
    quality_tier: "verified",
  },

  // ─── PHP ─────────────────────────────────────────────────────────────
  {
    name: "php-best-practices",
    type: "instruction",
    description:
      "PHP conventions: strict types, PSR standards, Composer, type hints, error handling",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/php/php.instructions.md",
    tags: ["PHP"],
    quality_tier: "verified",
  },
  {
    name: "laravel-patterns",
    type: "instruction",
    description:
      "Laravel: Eloquent, middleware, service providers, Blade templates, testing",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/php/laravel.instructions.md",
    tags: ["PHP", "Laravel"],
    quality_tier: "verified",
  },

  // ─── Swift ───────────────────────────────────────────────────────────
  {
    name: "swift-best-practices",
    type: "instruction",
    description:
      "Swift conventions: value types, protocols, async/await, SwiftUI patterns, testing",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/swift/swift.instructions.md",
    tags: ["Swift"],
    quality_tier: "verified",
  },

  // ─── Testing ─────────────────────────────────────────────────────────
  {
    name: "vitest-testing",
    type: "instruction",
    description:
      "Vitest testing patterns: describe/it, mocking, snapshots, coverage, async tests",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/testing/vitest.instructions.md",
    tags: ["Vitest", "TypeScript", "JavaScript"],
    quality_tier: "verified",
  },
  {
    name: "jest-testing",
    type: "instruction",
    description:
      "Jest testing patterns: matchers, mocking, async, snapshot testing, coverage",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/testing/jest.instructions.md",
    tags: ["Jest", "TypeScript", "JavaScript", "React"],
    quality_tier: "verified",
  },
  {
    name: "pytest-testing",
    type: "instruction",
    description:
      "Pytest patterns: fixtures, parametrize, markers, conftest, mocking, coverage",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/testing/pytest.instructions.md",
    tags: ["Python", "pytest", "Django", "FastAPI", "Flask"],
    quality_tier: "verified",
  },

  // ─── DevOps / Infrastructure ─────────────────────────────────────────
  {
    name: "docker-best-practices",
    type: "instruction",
    description:
      "Dockerfile patterns: multi-stage builds, layer caching, security, compose best practices",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/devops/docker.instructions.md",
    tags: ["Docker"],
    quality_tier: "verified",
  },
  {
    name: "github-actions-patterns",
    type: "instruction",
    description:
      "GitHub Actions: workflow structure, caching, matrix builds, reusable workflows, secrets",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/devops/github-actions.instructions.md",
    tags: ["GitHub Actions"],
    quality_tier: "verified",
  },
  {
    name: "terraform-patterns",
    type: "instruction",
    description:
      "Terraform conventions: modules, state management, variables, outputs, best practices",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/devops/terraform.instructions.md",
    tags: ["Terraform", "AWS", "Azure", "GCP"],
    quality_tier: "verified",
  },
  {
    name: "kubernetes-patterns",
    type: "instruction",
    description:
      "Kubernetes: deployments, services, ingress, ConfigMaps, Secrets, Helm charts",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/instructions/devops/kubernetes.instructions.md",
    tags: ["Kubernetes", "Docker"],
    quality_tier: "verified",
  },

  // ─── Agents ──────────────────────────────────────────────────────────
  {
    name: "code-reviewer",
    type: "agent",
    description:
      "Code review agent that analyzes diffs for bugs, security issues, and style violations",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/agents/code-reviewer.agent.md",
    tags: [
      "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C#",
      "Ruby", "PHP", "Kotlin", "Swift",
    ],
    quality_tier: "verified",
  },

  // ─── Skills ──────────────────────────────────────────────────────────
  {
    name: "conventional-commit",
    type: "skill",
    description:
      "Generate standardized conventional commit messages from staged changes",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/skills/conventional-commit/SKILL.md",
    tags: [
      "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C#",
      "Ruby", "PHP", "Kotlin", "Swift",
    ],
    quality_tier: "verified",
  },

  // ─── Prompts ─────────────────────────────────────────────────────────
  {
    name: "create-test",
    type: "prompt",
    description:
      "Generate unit tests for selected code with framework auto-detection",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/prompts/create-test.prompt.md",
    tags: [
      "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C#",
      "Ruby", "PHP", "Vitest", "Jest", "pytest",
    ],
    quality_tier: "verified",
  },
  {
    name: "refactor-code",
    type: "prompt",
    description:
      "Refactor selected code for readability, performance, and maintainability",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/prompts/refactor.prompt.md",
    tags: [
      "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C#",
      "Ruby", "PHP",
    ],
    quality_tier: "verified",
  },
  {
    name: "explain-code",
    type: "prompt",
    description:
      "Explain selected code with detailed annotations and reasoning",
    source_url:
      "https://raw.githubusercontent.com/github/awesome-copilot/main/prompts/explain.prompt.md",
    tags: [
      "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C#",
      "Ruby", "PHP",
    ],
    quality_tier: "verified",
  },

  // ─── MCP Servers ─────────────────────────────────────────────────────
  {
    name: "github-mcp-server",
    type: "mcp-server",
    description:
      "Official GitHub MCP server — issues, PRs, code search, actions, repos",
    source_url: "https://github.com/github/github-mcp-server",
    tags: [
      "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C#",
      "Ruby", "PHP", "GitHub Actions",
    ],
    quality_tier: "verified",
  },
  {
    name: "playwright-mcp",
    type: "mcp-server",
    description:
      "Browser automation for testing, scraping, and web interaction via MCP",
    source_url: "https://github.com/microsoft/playwright-mcp",
    tags: ["TypeScript", "JavaScript", "React", "Vue", "Angular", "Svelte", "Next.js"],
    quality_tier: "verified",
  },
  {
    name: "docker-mcp",
    type: "mcp-server",
    description:
      "Docker container management via MCP — build, run, inspect containers",
    source_url: "https://github.com/docker/docker-mcp",
    tags: ["Docker", "Kubernetes"],
    quality_tier: "community",
  },
];

export function matchAssets(
  languages: string[],
  frameworks: string[],
  cicd: string[],
  cloudProviders: string[],
): CuratedAsset[] {
  const projectTags = new Set([
    ...languages,
    ...frameworks,
    ...cicd.map((c) => c.replace(/\s*\(\d+ workflow\(s\)\)/, "")),
    ...cloudProviders,
  ]);

  if (projectTags.size === 0) return [];

  const scored = CURATED_ASSETS.map((asset) => {
    const matchCount = asset.tags.filter((t) => projectTags.has(t)).length;
    return { asset, matchCount };
  });

  return scored
    .filter((s) => s.matchCount > 0)
    .sort((a, b) => {
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      const tierOrder = { verified: 0, community: 1 };
      return tierOrder[a.asset.quality_tier] - tierOrder[b.asset.quality_tier];
    })
    .map((s) => s.asset);
}

export function filterInstalled(
  assets: CuratedAsset[],
  installedNames: Set<string>,
): CuratedAsset[] {
  return assets.filter((a) => !installedNames.has(a.name));
}
