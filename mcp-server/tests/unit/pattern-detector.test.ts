import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectPatterns } from "../../src/analyzers/pattern-detector.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "pattern-detector-test-" + Date.now());

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

describe("pattern-detector", () => {
  describe("naming conventions", () => {
    it("detects camelCase variables", () => {
      setupProject({
        "src/service.ts": `
          const userName = "alice";
          const itemCount = 5;
          const requestBody = {};
          const responseData = [];
          const isActive = true;
        `,
        "package.json": '{"name":"test","dependencies":{}}',
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.naming.variables).toBe("camelCase");
    });

    it("detects snake_case variables", () => {
      setupProject({
        "src/service.py": [
          "const user_name = 'alice';",
          "const item_count = 5;",
          "const request_body = {};",
          "const response_data = [];",
          "const is_active = true;",
          "const auth_token = 'abc';",
          "const max_items = 100;",
          "const file_path = '/tmp';",
        ].join("\n"),
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.naming.variables).toBe("snake_case");
    });

    it("detects kebab-case file names", () => {
      setupProject({
        "src/user-service.ts": "export const a = 1;",
        "src/auth-middleware.ts": "export const b = 2;",
        "src/api-client.ts": "export const c = 3;",
        "src/data-store.ts": "export const d = 4;",
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.naming.files).toBe("kebab-case");
    });

    it("detects UPPER_SNAKE constants", () => {
      setupProject({
        "src/config.ts": `
          const MAX_RETRIES = 3;
          const DEFAULT_TIMEOUT = 5000;
          const API_BASE_URL = "https://api.example.com";
          const CACHE_TTL_MS = 60000;
        `,
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.naming.constants).toBe("UPPER_SNAKE");
    });
  });

  describe("error handling", () => {
    it("detects try-catch pattern", () => {
      setupProject({
        "src/service.ts": `
          async function fetchData() {
            try {
              const res = await fetch(url);
              return res.json();
            } catch (error) {
              throw new Error("Failed");
            }
          }
          function processItem() {
            try {
              return transform(item);
            } catch (error) {
              return null;
            }
          }
        `,
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.errorHandling.pattern).toBe("try-catch");
    });

    it("detects custom error classes", () => {
      setupProject({
        "src/errors.ts": `
          class ValidationError extends Error {
            constructor(message: string) {
              super(message);
            }
          }
          class NotFoundError extends Error {}
        `,
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.errorHandling.customErrorClasses).toBe(true);
    });
  });

  describe("import style", () => {
    it("detects named imports", () => {
      setupProject({
        "src/app.ts": `
          import { readFileSync } from "node:fs";
          import { join, resolve } from "node:path";
          import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
          import { z } from "zod";
          import { validateUrl } from "../security/trusted-sources.js";
          import { type Config } from "./types.js";
        `,
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.imports.type).toBe("named");
    });

    it("detects file extensions in imports", () => {
      setupProject({
        "src/index.ts": `
          import { helper } from "./utils/helper.js";
          import { config } from "../config.js";
          import { type Foo } from "./types.js";
        `,
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.imports.fileExtensions).toBe(true);
    });
  });

  describe("function style", () => {
    it("detects arrow function preference", () => {
      setupProject({
        "src/utils.ts": `
          const processItem = (item: Item) => {
            return transform(item);
          };
          const fetchData = async (url: string) => {
            const res = await fetch(url);
            return res.json();
          };
          const mapValues = (arr: number[]) => {
            return arr.map((x) => x * 2);
          };
          const validate = (input: string) => {
            return input.length > 0;
          };
        `,
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.functions.preferred).toBe("arrow");
    });

    it("detects async-await pattern", () => {
      setupProject({
        "src/api.ts": `
          const getData = async () => {
            const res = await fetch("/api");
            const data = await res.json();
            return data;
          };
          const postData = async (body: unknown) => {
            const res = await fetch("/api", { method: "POST", body: JSON.stringify(body) });
            return await res.json();
          };
        `,
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.functions.asyncPattern).toBe("async-await");
    });
  });

  describe("testing", () => {
    it("detects Vitest framework", () => {
      setupProject({
        "package.json": JSON.stringify({
          devDependencies: { vitest: "^4.0.0" },
        }),
        "vitest.config.ts": 'export default defineConfig({ test: {} })',
        "tests/example.test.ts": `
          import { describe, it, expect } from "vitest";
          describe("example", () => {
            it("should work", () => {
              expect(1 + 1).toBe(2);
            });
          });
        `,
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.testing.framework).toBe("Vitest");
      // Pattern detection counts describe blocks vs test files
      expect(["describe-it", "test-only"]).toContain(patterns.testing.pattern);
    });
  });

  describe("code style", () => {
    it("detects semicolons and double quotes", () => {
      setupProject({
        "src/main.ts": `
          import { foo } from "bar";
          import { baz } from "qux";
          const x = 1;
          const y = "hello";
          const z = true;
          export const result = x + 1;
        `,
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.codeStyle.semicolons).toBe(true);
      expect(patterns.codeStyle.quotes).toBe("double");
    });

    it("detects 2-space indentation", () => {
      setupProject({
        "src/main.ts": [
          "function test() {",
          "  const x = 1;",
          "  if (x) {",
          "    return true;",
          "  }",
          "  return false;",
          "}",
        ].join("\n"),
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.codeStyle.indentation).toBe("2-spaces");
    });
  });

  describe("architecture", () => {
    it("detects layer-based architecture", () => {
      setupProject({
        "src/controllers/user.ts": "export const a = 1;",
        "src/services/user.ts": "export const b = 1;",
        "src/models/user.ts": "export const c = 1;",
        "src/middleware/auth.ts": "export const d = 1;",
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.architecture.pattern).toBe("layer-based");
    });
  });

  describe("dependencies", () => {
    it("detects preferred libraries from package.json", () => {
      setupProject({
        "package.json": JSON.stringify({
          dependencies: {
            zod: "^3.0.0",
            express: "^4.0.0",
            winston: "^3.0.0",
          },
          devDependencies: {
            vitest: "^4.0.0",
            eslint: "^10.0.0",
            prettier: "^3.0.0",
            typescript: "^5.0.0",
          },
        }),
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.dependencies.preferredLibraries.get("Validation")).toBe("zod");
      expect(patterns.dependencies.preferredLibraries.get("API framework")).toBe("express");
      expect(patterns.dependencies.preferredLibraries.get("Logging")).toBe("winston");
      expect(patterns.dependencies.preferredLibraries.get("Testing")).toBe("vitest");
    });
  });

  describe("file organization", () => {
    it("detects separate test directory", () => {
      setupProject({
        "src/utils.ts": "export const a = 1;",
        "src/service.ts": "export const b = 1;",
        "tests/utils.test.ts": "test('a', () => {});",
        "tests/service.test.ts": "test('b', () => {});",
      });

      const patterns = detectPatterns(TEST_DIR);
      expect(patterns.fileOrganization.sourceDir).toBe("src");
      expect(patterns.fileOrganization.testDir).toBe("tests");
      expect(patterns.fileOrganization.testNaming).toBe("separate-dir");
    });
  });
});
