import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateInstructionsContent } from "../../src/tools/generate-instructions.js";
import { detectPatterns } from "../../src/analyzers/pattern-detector.js";

const TEST_DIR = join(tmpdir(), "gen-instructions-test-" + Date.now());

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

describe("generate-instructions", () => {
  it("generates instructions containing detected naming conventions", () => {
    setupProject({
      "package.json": JSON.stringify({
        name: "my-app",
        description: "A cool project",
        type: "module",
        dependencies: { zod: "^3.0.0" },
        devDependencies: { typescript: "^5.0.0", vitest: "^4.0.0" },
        engines: { node: ">=18" },
      }),
      "src/user-service.ts": `
        const userName = "alice";
        const itemCount = 5;
        const MAX_RETRIES = 3;
        interface UserProfile { name: string; }
      `,
    });

    const patterns = detectPatterns(TEST_DIR);
    const content = generateInstructionsContent(TEST_DIR, patterns);

    expect(content).toContain("Naming Conventions");
    expect(content).toContain("camelCase");
    expect(content).toContain("TypeScript");
  });

  it("generates instructions with error handling section", () => {
    setupProject({
      "package.json": '{"name":"test"}',
      "src/service.ts": `
        async function doWork() {
          try {
            const result = await fetch("http://example.com");
            return result;
          } catch (error) {
            throw new Error(\`Failed: \${error}\`);
          }
        }
      `,
    });

    const patterns = detectPatterns(TEST_DIR);
    const content = generateInstructionsContent(TEST_DIR, patterns);

    expect(content).toContain("Error Handling");
    expect(content).toContain("try-catch");
  });

  it("generates instructions with import section for file extensions", () => {
    setupProject({
      "package.json": '{"name":"test","type":"module"}',
      "src/index.ts": `
        import { helper } from "./utils/helper.js";
        import { config } from "../config.js";
        import { type Foo } from "./types.js";
      `,
    });

    const patterns = detectPatterns(TEST_DIR);
    const content = generateInstructionsContent(TEST_DIR, patterns);

    expect(content).toContain("Import Conventions");
    expect(content).toContain("file extensions");
  });

  it("generates instructions with testing section", () => {
    setupProject({
      "package.json": JSON.stringify({
        devDependencies: { vitest: "^4.0.0" },
      }),
      "vitest.config.ts": "export default {}",
      "tests/a.test.ts": `
        import { describe, it, expect } from "vitest";
        describe("a", () => { it("works", () => { expect(1).toBe(1); }); });
      `,
    });

    const patterns = detectPatterns(TEST_DIR);
    const content = generateInstructionsContent(TEST_DIR, patterns);

    expect(content).toContain("Testing");
    expect(content).toContain("Vitest");
  });

  it("generates instructions with build commands", () => {
    setupProject({
      "package.json": JSON.stringify({
        name: "test-project",
        scripts: {
          build: "tsc",
          test: "vitest run",
          lint: "eslint src/",
        },
      }),
    });

    const patterns = detectPatterns(TEST_DIR);
    const content = generateInstructionsContent(TEST_DIR, patterns);

    expect(content).toContain("Build & Run");
    expect(content).toContain("npm run build");
    expect(content).toContain("npm run test");
  });

  it("includes architecture section", () => {
    setupProject({
      "src/controllers/user.ts": "export const a = 1;",
      "src/services/user.ts": "export const b = 1;",
      "src/models/user.ts": "export const c = 1;",
    });

    const patterns = detectPatterns(TEST_DIR);
    const content = generateInstructionsContent(TEST_DIR, patterns);

    expect(content).toContain("Architecture");
    expect(content).toContain("layer-based");
  });
});
