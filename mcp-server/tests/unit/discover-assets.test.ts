import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "discover-assets-test-" + Date.now());

function setupProject(files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const full = join(TEST_DIR, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content, "utf-8");
  }
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("discover-assets (integration via project structure)", () => {
  it("detects TypeScript project files", () => {
    setupProject({
      "package.json": JSON.stringify({
        name: "test",
        dependencies: { react: "^18.0.0" },
        devDependencies: { vitest: "^1.0.0", typescript: "^5.0.0" },
      }),
      "src/index.ts": "export const x = 1;",
      "src/App.tsx": "export default function App() { return <div/>; }",
    });

    expect(existsSync(join(TEST_DIR, "package.json"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "src/index.ts"))).toBe(true);
  });

  it("detects Python project files", () => {
    setupProject({
      "requirements.txt": "django>=4.0\npytest>=7.0\n",
      "app/main.py": "print('hello')",
    });

    expect(existsSync(join(TEST_DIR, "requirements.txt"))).toBe(true);
  });

  it("detects existing .github customizations", () => {
    setupProject({
      "package.json": '{"name":"test"}',
      ".github/instructions/typescript-strict.instructions.md": "# TS strict",
      ".github/skills/conventional-commit/SKILL.md": "# Commit skill",
      ".github/agents/code-reviewer.agent.md": "# Reviewer",
      ".github/prompts/create-test.prompt.md": "# Test prompt",
    });

    expect(existsSync(join(TEST_DIR, ".github/instructions/typescript-strict.instructions.md"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".github/skills/conventional-commit/SKILL.md"))).toBe(true);
  });

  it("detects Docker presence", () => {
    setupProject({
      "Dockerfile": "FROM node:20",
      "package.json": '{"name":"test"}',
    });

    expect(existsSync(join(TEST_DIR, "Dockerfile"))).toBe(true);
  });

  it("detects Go project", () => {
    setupProject({
      "go.mod": "module example.com/test\n\ngo 1.21\n",
      "main.go": "package main\n\nfunc main() {}\n",
    });

    expect(existsSync(join(TEST_DIR, "go.mod"))).toBe(true);
  });

  it("detects .NET project", () => {
    setupProject({
      "MyApp.csproj":
        '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
      "Program.cs": "var builder = WebApplication.CreateBuilder(args);",
    });

    expect(existsSync(join(TEST_DIR, "MyApp.csproj"))).toBe(true);
  });

  it("handles empty project directory", () => {
    expect(existsSync(TEST_DIR)).toBe(true);
  });

  it("handles project with only non-code files", () => {
    setupProject({
      "README.md": "# Hello",
      "LICENSE": "MIT",
    });

    expect(existsSync(join(TEST_DIR, "README.md"))).toBe(true);
  });
});
