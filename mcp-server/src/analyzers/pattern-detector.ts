import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname, basename, relative } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodePatterns {
  naming: NamingConventions;
  errorHandling: ErrorHandlingStyle;
  imports: ImportStyle;
  functions: FunctionStyle;
  testing: TestingStyle;
  architecture: ArchitectureStyle;
  dependencies: DependencyInfo;
  fileOrganization: FileOrganization;
  codeStyle: CodeStyle;
}

export interface NamingConventions {
  variables: "camelCase" | "snake_case" | "PascalCase" | "mixed";
  functions: "camelCase" | "snake_case" | "PascalCase" | "mixed";
  files: "kebab-case" | "camelCase" | "PascalCase" | "snake_case" | "mixed";
  constants: "UPPER_SNAKE" | "camelCase" | "mixed";
  types: "PascalCase" | "other";
  evidence: string[];
}

export interface ErrorHandlingStyle {
  pattern: "try-catch" | "result-type" | "error-first-callback" | "mixed" | "minimal";
  customErrorClasses: boolean;
  errorMessages: "template-literal" | "concatenation" | "static" | "mixed";
  evidence: string[];
}

export interface ImportStyle {
  type: "named" | "default" | "mixed";
  useBarrelExports: boolean;
  pathAliases: boolean;
  fileExtensions: boolean;
  sortImports: boolean;
  evidence: string[];
}

export interface FunctionStyle {
  preferred: "arrow" | "declaration" | "mixed";
  asyncPattern: "async-await" | "promises" | "callbacks" | "mixed";
  earlyReturns: boolean;
  averageFunctionLength: number;
  evidence: string[];
}

export interface TestingStyle {
  framework: string;
  pattern: "describe-it" | "test-only" | "mixed" | "none";
  usesAAA: boolean;
  mockingApproach: string;
  evidence: string[];
}

export interface ArchitectureStyle {
  pattern: "feature-based" | "layer-based" | "flat" | "mixed";
  topLevelDirs: string[];
  evidence: string[];
}

export interface DependencyInfo {
  runtime: string[];
  dev: string[];
  preferredLibraries: Map<string, string>;
  evidence: string[];
}

export interface FileOrganization {
  sourceDir: string;
  testDir: string;
  testNaming: "co-located" | "separate-dir" | "mixed";
  indexFiles: boolean;
  evidence: string[];
}

export interface CodeStyle {
  semicolons: boolean;
  quotes: "single" | "double" | "mixed";
  trailingCommas: boolean;
  indentation: "tabs" | "2-spaces" | "4-spaces" | "mixed";
  maxLineLength: number;
  evidence: string[];
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "vendor", "__pycache__",
  ".next", ".nuxt", "coverage", ".vscode", ".idea", "out", "bin", "obj",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".cs", ".go", ".rs",
  ".java", ".rb", ".swift", ".kt", ".php",
]);

function collectSourceFiles(
  dir: string,
  depth: number,
  maxDepth: number,
  root: string,
): { path: string; relativePath: string }[] {
  if (depth > maxDepth) return [];
  const results: { path: string; relativePath: string }[] = [];
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return results;
  }
  for (const name of names) {
    if (name.startsWith(".") && depth > 0) continue;
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(
          ...collectSourceFiles(full, depth + 1, maxDepth, root),
        );
      } else if (stat.isFile() && SOURCE_EXTENSIONS.has(extname(full).toLowerCase())) {
        results.push({ path: full, relativePath: relative(root, full).replace(/\\/g, "/") });
      }
    } catch {
      /* skip inaccessible */
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Sampling — read a representative subset of files
// ---------------------------------------------------------------------------

const MAX_SAMPLE_FILES = 30;
const MAX_FILE_SIZE = 50_000;

interface FileSample {
  relativePath: string;
  content: string;
  extension: string;
  isTest: boolean;
}

function sampleFiles(
  files: { path: string; relativePath: string }[],
): FileSample[] {
  // Prioritize diversity: pick from different directories
  const byDir = new Map<string, { path: string; relativePath: string }[]>();
  for (const f of files) {
    const dir = f.relativePath.split("/").slice(0, -1).join("/") || ".";
    const arr = byDir.get(dir) ?? [];
    arr.push(f);
    byDir.set(dir, arr);
  }

  const selected: { path: string; relativePath: string }[] = [];
  const dirs = [...byDir.keys()].sort();

  // Round-robin across directories
  let round = 0;
  while (selected.length < MAX_SAMPLE_FILES && round < 10) {
    for (const dir of dirs) {
      const arr = byDir.get(dir)!;
      if (round < arr.length) {
        selected.push(arr[round]);
        if (selected.length >= MAX_SAMPLE_FILES) break;
      }
    }
    round++;
  }

  return selected.map((f) => {
    let content: string;
    try {
      const stat = statSync(f.path);
      if (stat.size > MAX_FILE_SIZE) {
        content = readFileSync(f.path, "utf-8").slice(0, MAX_FILE_SIZE);
      } else {
        content = readFileSync(f.path, "utf-8");
      }
    } catch {
      content = "";
    }
    const ext = extname(f.relativePath).toLowerCase();
    const isTest =
      f.relativePath.includes("test") ||
      f.relativePath.includes("spec") ||
      f.relativePath.includes("__tests__");
    return { relativePath: f.relativePath, content, extension: ext, isTest };
  });
}

// ---------------------------------------------------------------------------
// Naming convention detection
// ---------------------------------------------------------------------------

function detectNaming(
  samples: FileSample[],
  files: { path: string; relativePath: string }[],
): NamingConventions {
  const evidence: string[] = [];
  const nonTestSamples = samples.filter((s) => !s.isTest);

  // Variable naming
  const varCounts = { camel: 0, snake: 0, pascal: 0 };
  // Match: const/let/var name = ...
  const varPattern = /\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[=:]/g;
  for (const s of nonTestSamples) {
    let m: RegExpExecArray | null;
    while ((m = varPattern.exec(s.content))) {
      const name = m[1];
      if (name.length < 2 || name.startsWith("_")) continue;
      if (/^[A-Z][A-Z_0-9]+$/.test(name)) continue; // skip constants
      if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) varCounts.camel++;
      else if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes("_")) varCounts.snake++;
      else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) varCounts.pascal++;
    }
  }
  const totalVars = varCounts.camel + varCounts.snake + varCounts.pascal;
  let variables: NamingConventions["variables"] = "mixed";
  if (totalVars > 0) {
    if (varCounts.camel / totalVars > 0.7) variables = "camelCase";
    else if (varCounts.snake / totalVars > 0.7) variables = "snake_case";
    else if (varCounts.pascal / totalVars > 0.7) variables = "PascalCase";
  }
  evidence.push(`Variables: ${varCounts.camel} camelCase, ${varCounts.snake} snake_case, ${varCounts.pascal} PascalCase`);

  // Function naming
  const funcCounts = { camel: 0, snake: 0, pascal: 0 };
  const funcPattern = /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  const arrowFuncPattern = /\b(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(/g;
  for (const s of nonTestSamples) {
    for (const pat of [funcPattern, arrowFuncPattern]) {
      let m: RegExpExecArray | null;
      while ((m = pat.exec(s.content))) {
        const name = m[1];
        if (name.length < 2) continue;
        if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) funcCounts.camel++;
        else if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes("_")) funcCounts.snake++;
        else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) funcCounts.pascal++;
      }
    }
  }
  const totalFuncs = funcCounts.camel + funcCounts.snake + funcCounts.pascal;
  let functions: NamingConventions["functions"] = "mixed";
  if (totalFuncs > 0) {
    if (funcCounts.camel / totalFuncs > 0.7) functions = "camelCase";
    else if (funcCounts.snake / totalFuncs > 0.7) functions = "snake_case";
    else if (funcCounts.pascal / totalFuncs > 0.7) functions = "PascalCase";
  }
  evidence.push(`Functions: ${funcCounts.camel} camelCase, ${funcCounts.snake} snake_case`);

  // File naming
  const fileCounts = { kebab: 0, camel: 0, pascal: 0, snake: 0 };
  for (const f of files) {
    const name = basename(f.relativePath).replace(/\.[^.]+$/, "");
    if (name.length < 2) continue;
    if (/^[a-z][a-z0-9-]*$/.test(name) && name.includes("-")) fileCounts.kebab++;
    else if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) fileCounts.camel++;
    else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) fileCounts.pascal++;
    else if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes("_")) fileCounts.snake++;
  }
  const totalFiles = fileCounts.kebab + fileCounts.camel + fileCounts.pascal + fileCounts.snake;
  let fileNaming: NamingConventions["files"] = "mixed";
  if (totalFiles > 0) {
    if (fileCounts.kebab / totalFiles > 0.6) fileNaming = "kebab-case";
    else if (fileCounts.camel / totalFiles > 0.6) fileNaming = "camelCase";
    else if (fileCounts.pascal / totalFiles > 0.6) fileNaming = "PascalCase";
    else if (fileCounts.snake / totalFiles > 0.6) fileNaming = "snake_case";
  }
  evidence.push(`Files: ${fileCounts.kebab} kebab, ${fileCounts.camel} camel, ${fileCounts.pascal} Pascal, ${fileCounts.snake} snake`);

  // Constants (UPPER_SNAKE)
  const constCounts = { upper: 0, camel: 0 };
  const constPattern = /\bconst\s+([A-Z][A-Z_0-9]{2,})\s*=/g;
  for (const s of nonTestSamples) {
    while (constPattern.exec(s.content)) {
      constCounts.upper++;
    }
  }
  const constants: NamingConventions["constants"] =
    constCounts.upper > 3 ? "UPPER_SNAKE" : "camelCase";

  // Types/interfaces
  const typePattern = /\b(?:interface|type|class|enum)\s+([A-Z][a-zA-Z0-9]*)/g;
  let typeCount = 0;
  for (const s of nonTestSamples) {
    while (typePattern.exec(s.content)) {
      typeCount++;
    }
  }
  const types: NamingConventions["types"] = typeCount > 0 ? "PascalCase" : "other";

  return { variables, functions, files: fileNaming, constants, types, evidence };
}

// ---------------------------------------------------------------------------
// Error handling detection
// ---------------------------------------------------------------------------

function detectErrorHandling(samples: FileSample[]): ErrorHandlingStyle {
  const evidence: string[] = [];
  const nonTest = samples.filter((s) => !s.isTest);

  let tryCatch = 0;
  let resultType = 0;
  let errorFirstCb = 0;
  let customErrors = false;
  let templateLit = 0;
  let concat = 0;
  let staticMsg = 0;

  for (const s of nonTest) {
    // Count try-catch blocks
    const tryCatchMatches = s.content.match(/\btry\s*\{/g);
    if (tryCatchMatches) tryCatch += tryCatchMatches.length;

    // Result type patterns
    if (/\bResult</.test(s.content) || /\bEither</.test(s.content) || /\bOption</.test(s.content)) {
      resultType++;
    }

    // Error-first callbacks
    if (/\(err(?:or)?\s*,/.test(s.content)) errorFirstCb++;

    // Custom error classes
    if (/class\s+\w+Error\s+extends\s+Error/.test(s.content)) customErrors = true;

    // Error message style
    const throwPattern = /throw\s+new\s+\w*Error\s*\((.*?)\)/g;
    let m: RegExpExecArray | null;
    while ((m = throwPattern.exec(s.content))) {
      const arg = m[1];
      if (arg.includes("`")) templateLit++;
      else if (arg.includes("+")) concat++;
      else staticMsg++;
    }

    // catch block with return pattern (error as value)
    const catchReturn = s.content.match(/\bcatch\s*\([^)]*\)\s*\{[^}]*return\s/g);
    if (catchReturn) resultType += catchReturn.length;
  }

  let pattern: ErrorHandlingStyle["pattern"] = "minimal";
  const total = tryCatch + resultType + errorFirstCb;
  if (total > 0) {
    if (tryCatch > resultType && tryCatch > errorFirstCb) pattern = "try-catch";
    else if (resultType > tryCatch) pattern = "result-type";
    else if (errorFirstCb > tryCatch) pattern = "error-first-callback";
    else pattern = "mixed";
  }

  let errorMessages: ErrorHandlingStyle["errorMessages"] = "mixed";
  const msgTotal = templateLit + concat + staticMsg;
  if (msgTotal > 0) {
    if (templateLit / msgTotal > 0.6) errorMessages = "template-literal";
    else if (concat / msgTotal > 0.6) errorMessages = "concatenation";
    else if (staticMsg / msgTotal > 0.6) errorMessages = "static";
  }

  evidence.push(`try-catch: ${tryCatch}, result-type: ${resultType}, error-first: ${errorFirstCb}`);
  evidence.push(`Custom error classes: ${customErrors}`);
  evidence.push(`Error messages: ${templateLit} template, ${concat} concat, ${staticMsg} static`);

  return { pattern, customErrorClasses: customErrors, errorMessages, evidence };
}

// ---------------------------------------------------------------------------
// Import style detection
// ---------------------------------------------------------------------------

function detectImports(samples: FileSample[]): ImportStyle {
  const evidence: string[] = [];
  const nonTest = samples.filter((s) => !s.isTest);

  let namedImports = 0;
  let defaultImports = 0;
  let barrelExports = 0;
  let pathAliases = false;
  let fileExtensions = 0;
  let noFileExtensions = 0;

  for (const s of nonTest) {
    // Named imports: import { x } from ...
    const named = s.content.match(/import\s*\{[^}]+\}\s*from/g);
    if (named) namedImports += named.length;

    // Default imports: import x from ...
    const defaults = s.content.match(/import\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s+from/g);
    if (defaults) defaultImports += defaults.length;

    // Barrel exports: export * from or export { ... } from
    if (/export\s*\*\s*from/.test(s.content) || /export\s*\{[^}]+\}\s*from/.test(s.content)) {
      barrelExports++;
    }

    // Path aliases: import from @/ or ~/
    if (/@\/|~\//.test(s.content)) pathAliases = true;

    // File extensions in imports
    const fromPaths = s.content.match(/from\s+["']([^"']+)["']/g) ?? [];
    for (const fp of fromPaths) {
      const path = fp.replace(/from\s+["']/, "").replace(/["']$/, "");
      if (path.startsWith(".")) {
        if (/\.\w+$/.test(path)) fileExtensions++;
        else noFileExtensions++;
      }
    }
  }

  const totalImports = namedImports + defaultImports;
  let type: ImportStyle["type"] = "mixed";
  if (totalImports > 0) {
    if (namedImports / totalImports > 0.7) type = "named";
    else if (defaultImports / totalImports > 0.7) type = "default";
  }

  // Sort detection: check if imports are alphabetically ordered
  let sortedCount = 0;
  let unsortedCount = 0;
  for (const s of nonTest) {
    const importLines = s.content.match(/^import\s.+from\s+["'][^"']+["'];?$/gm) ?? [];
    if (importLines.length > 2) {
      const fromPaths = importLines.map((l) => {
        const match = l.match(/from\s+["']([^"']+)["']/);
        return match ? match[1] : "";
      });
      const sorted = [...fromPaths].sort();
      if (JSON.stringify(fromPaths) === JSON.stringify(sorted)) sortedCount++;
      else unsortedCount++;
    }
  }

  evidence.push(`Named: ${namedImports}, Default: ${defaultImports}`);
  evidence.push(`Barrel exports: ${barrelExports}, Path aliases: ${pathAliases}`);
  evidence.push(`File extensions in imports: ${fileExtensions} yes, ${noFileExtensions} no`);

  return {
    type,
    useBarrelExports: barrelExports > 2,
    pathAliases,
    fileExtensions: fileExtensions > noFileExtensions,
    sortImports: sortedCount > unsortedCount,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Function style detection
// ---------------------------------------------------------------------------

function detectFunctions(samples: FileSample[]): FunctionStyle {
  const evidence: string[] = [];
  const nonTest = samples.filter((s) => !s.isTest);

  let arrows = 0;
  let declarations = 0;
  let asyncAwait = 0;
  let thenChain = 0;
  let callbacks = 0;
  let earlyReturnFiles = 0;
  let totalLines = 0;
  let funcCount = 0;

  for (const s of nonTest) {
    // Arrow functions
    const arrowMatches = s.content.match(/=>\s*[{\n(]/g);
    if (arrowMatches) arrows += arrowMatches.length;

    // Function declarations
    const declMatches = s.content.match(/\bfunction\s+[a-zA-Z_$]/g);
    if (declMatches) declarations += declMatches.length;

    // Async/await
    const awaitMatches = s.content.match(/\bawait\s/g);
    if (awaitMatches) asyncAwait += awaitMatches.length;

    // .then() chains
    const thenMatches = s.content.match(/\.then\s*\(/g);
    if (thenMatches) thenChain += thenMatches.length;

    // Callback patterns
    const cbMatches = s.content.match(/\((?:err|error|null)\s*,/g);
    if (cbMatches) callbacks += cbMatches.length;

    // Early returns: if (...) return
    if (/if\s*\([^)]+\)\s*return\b/.test(s.content)) earlyReturnFiles++;

    // Function length estimation
    const funcBodies = s.content.match(/(?:function\s+\w+|=>\s*)\{/g);
    if (funcBodies) {
      funcCount += funcBodies.length;
      totalLines += s.content.split("\n").length;
    }
  }

  const total = arrows + declarations;
  let preferred: FunctionStyle["preferred"] = "mixed";
  if (total > 0) {
    if (arrows / total > 0.7) preferred = "arrow";
    else if (declarations / total > 0.7) preferred = "declaration";
  }

  const asyncTotal = asyncAwait + thenChain + callbacks;
  let asyncPattern: FunctionStyle["asyncPattern"] = "mixed";
  if (asyncTotal > 0) {
    if (asyncAwait / asyncTotal > 0.7) asyncPattern = "async-await";
    else if (thenChain / asyncTotal > 0.7) asyncPattern = "promises";
    else if (callbacks / asyncTotal > 0.7) asyncPattern = "callbacks";
  }

  const avgLen = funcCount > 0 ? Math.round(totalLines / funcCount) : 0;

  evidence.push(`Arrows: ${arrows}, Declarations: ${declarations}`);
  evidence.push(`async/await: ${asyncAwait}, .then(): ${thenChain}, callbacks: ${callbacks}`);
  evidence.push(`Early return files: ${earlyReturnFiles}/${nonTest.length}`);

  return {
    preferred,
    asyncPattern,
    earlyReturns: earlyReturnFiles > nonTest.length * 0.3,
    averageFunctionLength: avgLen,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Testing style detection
// ---------------------------------------------------------------------------

function detectTesting(samples: FileSample[], root: string): TestingStyle {
  const evidence: string[] = [];
  const testSamples = samples.filter((s) => s.isTest);

  // Framework detection from config files
  let framework = "unknown";
  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if ("vitest" in allDeps) framework = "Vitest";
      else if ("jest" in allDeps) framework = "Jest";
      else if ("mocha" in allDeps) framework = "Mocha";
      else if ("ava" in allDeps) framework = "Ava";
      else if ("pytest" in allDeps) framework = "pytest";
    } catch {
      /* skip */
    }
  }
  if (framework === "unknown") {
    if (existsSync(join(root, "vitest.config.ts")) || existsSync(join(root, "vitest.config.js"))) {
      framework = "Vitest";
    } else if (existsSync(join(root, "jest.config.ts")) || existsSync(join(root, "jest.config.js"))) {
      framework = "Jest";
    } else if (existsSync(join(root, "pytest.ini")) || existsSync(join(root, "conftest.py"))) {
      framework = "pytest";
    }
  }

  // Pattern detection
  let describeIt = 0;
  let testOnly = 0;
  let aaaPattern = 0;
  let mockCalls = 0;
  let mockStyle = "unknown";

  for (const s of testSamples) {
    if (/\bdescribe\s*\(/.test(s.content)) describeIt++;
    const testMatches = s.content.match(/\b(?:test|it)\s*\(/g);
    if (testMatches) testOnly += testMatches.length;

    // AAA pattern: look for comments or clear setup/act/assert sections
    if (/\/\/\s*(?:arrange|act|assert|given|when|then)/i.test(s.content)) aaaPattern++;
    // Or: expect after a blank line (loose AAA detection)
    if (/\n\s*\n\s*expect\(/.test(s.content)) aaaPattern++;

    // Mocking
    if (/\bvi\.(?:fn|mock|spyOn|stubGlobal)\b/.test(s.content)) {
      mockCalls++;
      mockStyle = "vi (Vitest)";
    } else if (/\bjest\.(?:fn|mock|spyOn)\b/.test(s.content)) {
      mockCalls++;
      mockStyle = "jest";
    } else if (/\bsinon\./.test(s.content)) {
      mockCalls++;
      mockStyle = "sinon";
    }
  }

  let pattern: TestingStyle["pattern"] = "none";
  if (testSamples.length > 0) {
    pattern = describeIt > testSamples.length * 0.5 ? "describe-it" : "test-only";
  }

  evidence.push(`Framework: ${framework}, Test files sampled: ${testSamples.length}`);
  evidence.push(`describe blocks: ${describeIt}, test/it blocks: ${testOnly}`);
  evidence.push(`Mocking: ${mockStyle} (${mockCalls} usages)`);

  return {
    framework,
    pattern,
    usesAAA: aaaPattern > 1,
    mockingApproach: mockCalls > 0 ? mockStyle : "none detected",
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Architecture detection
// ---------------------------------------------------------------------------

function detectArchitecture(
  files: { path: string; relativePath: string }[],
  root: string,
): ArchitectureStyle {
  const evidence: string[] = [];

  // Top-level directories
  const topDirs: string[] = [];
  try {
    for (const entry of readdirSync(root)) {
      if (entry.startsWith(".")) continue;
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(root, entry);
      try {
        if (statSync(full).isDirectory()) topDirs.push(entry);
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }

  // Detect pattern
  const layerDirs = new Set(["controllers", "services", "models", "routes", "middleware", "repositories", "handlers", "views", "utils", "helpers"]);
  const featureDirs = new Set(["features", "modules", "domains", "pages", "components"]);

  let layerScore = 0;
  let featureScore = 0;

  for (const dir of topDirs) {
    if (layerDirs.has(dir.toLowerCase())) layerScore++;
    if (featureDirs.has(dir.toLowerCase())) featureScore++;
  }

  // Also check src/ subdirectories
  const srcDir = join(root, "src");
  if (existsSync(srcDir)) {
    try {
      for (const entry of readdirSync(srcDir)) {
        if (layerDirs.has(entry.toLowerCase())) layerScore++;
        if (featureDirs.has(entry.toLowerCase())) featureScore++;
      }
    } catch {
      /* skip */
    }
  }

  let pattern: ArchitectureStyle["pattern"] = "flat";
  if (featureScore > layerScore && featureScore > 0) pattern = "feature-based";
  else if (layerScore > featureScore && layerScore > 0) pattern = "layer-based";
  else if (layerScore > 0 && featureScore > 0) pattern = "mixed";

  evidence.push(`Top dirs: ${topDirs.join(", ")}`);
  evidence.push(`Layer indicators: ${layerScore}, Feature indicators: ${featureScore}`);

  return { pattern, topLevelDirs: topDirs, evidence };
}

// ---------------------------------------------------------------------------
// Dependency analysis
// ---------------------------------------------------------------------------

function detectDependencies(root: string): DependencyInfo {
  const evidence: string[] = [];
  const runtime: string[] = [];
  const dev: string[] = [];
  const preferredLibraries = new Map<string, string>();

  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.dependencies) {
        runtime.push(...Object.keys(pkg.dependencies));
      }
      if (pkg.devDependencies) {
        dev.push(...Object.keys(pkg.devDependencies));
      }

      // Detect preferred libraries by category
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const categories: [string, string[]][] = [
        ["HTTP client", ["axios", "got", "node-fetch", "undici", "ky"]],
        ["Validation", ["zod", "joi", "yup", "class-validator", "superstruct", "valibot"]],
        ["ORM", ["prisma", "typeorm", "sequelize", "drizzle-orm", "knex", "mongoose"]],
        ["Testing", ["vitest", "jest", "mocha", "ava", "tap"]],
        ["Linting", ["eslint", "biome", "oxlint"]],
        ["Formatting", ["prettier", "biome"]],
        ["Logging", ["winston", "pino", "bunyan", "log4js", "consola"]],
        ["State management", ["zustand", "redux", "@reduxjs/toolkit", "jotai", "recoil", "mobx"]],
        ["CSS", ["tailwindcss", "styled-components", "@emotion/react", "sass", "less"]],
        ["Auth", ["passport", "next-auth", "@auth/core", "jsonwebtoken"]],
        ["API framework", ["express", "fastify", "hono", "@nestjs/core", "koa"]],
      ];

      for (const [category, libs] of categories) {
        for (const lib of libs) {
          if (lib in allDeps) {
            preferredLibraries.set(category, lib);
            break;
          }
        }
      }
    } catch {
      /* skip */
    }
  }

  evidence.push(`Runtime deps: ${runtime.length}, Dev deps: ${dev.length}`);
  evidence.push(`Preferred: ${[...preferredLibraries.entries()].map(([k, v]) => `${k}=${v}`).join(", ")}`);

  return { runtime, dev, preferredLibraries, evidence };
}

// ---------------------------------------------------------------------------
// File organization detection
// ---------------------------------------------------------------------------

function detectFileOrganization(
  files: { path: string; relativePath: string }[],
  root: string,
): FileOrganization {
  const evidence: string[] = [];

  // Source directory
  let sourceDir = ".";
  if (existsSync(join(root, "src"))) sourceDir = "src";
  else if (existsSync(join(root, "lib"))) sourceDir = "lib";
  else if (existsSync(join(root, "app"))) sourceDir = "app";

  // Test directory
  let testDir = "";
  if (existsSync(join(root, "tests"))) testDir = "tests";
  else if (existsSync(join(root, "test"))) testDir = "test";
  else if (existsSync(join(root, "__tests__"))) testDir = "__tests__";
  else if (existsSync(join(root, "spec"))) testDir = "spec";

  // Test naming pattern
  const testFiles = files.filter(
    (f) =>
      f.relativePath.includes(".test.") ||
      f.relativePath.includes(".spec.") ||
      f.relativePath.includes("__tests__"),
  );
  const coLocated = testFiles.filter(
    (f) => f.relativePath.startsWith(sourceDir + "/"),
  ).length;
  const separated = testFiles.filter(
    (f) => testDir && f.relativePath.startsWith(testDir + "/"),
  ).length;

  let testNaming: FileOrganization["testNaming"] = "mixed";
  if (coLocated > separated && coLocated > 0) testNaming = "co-located";
  else if (separated > coLocated && separated > 0) testNaming = "separate-dir";

  // Index files (barrel exports)
  const indexFiles = files.filter((f) => basename(f.relativePath).startsWith("index.")).length;

  evidence.push(`Source: ${sourceDir}, Tests: ${testDir || "none"}`);
  evidence.push(`Test files: ${testFiles.length} (${coLocated} co-located, ${separated} separate)`);
  evidence.push(`Index/barrel files: ${indexFiles}`);

  return {
    sourceDir,
    testDir: testDir || "tests",
    testNaming,
    indexFiles: indexFiles > 2,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Code style detection
// ---------------------------------------------------------------------------

function detectCodeStyle(samples: FileSample[]): CodeStyle {
  const evidence: string[] = [];
  const nonTest = samples.filter((s) => !s.isTest);

  let semicolonLines = 0;
  let noSemicolonLines = 0;
  let singleQuotes = 0;
  let doubleQuotes = 0;
  let trailingCommas = 0;
  let noTrailingCommas = 0;
  let twoSpaces = 0;
  let fourSpaces = 0;
  let tabs = 0;
  let maxLine = 0;

  for (const s of nonTest) {
    const lines = s.content.split("\n");
    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (trimmed.length > maxLine) maxLine = trimmed.length;

      // Semicolons (only on code lines, not comments)
      if (trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("*")) {
        if (trimmed.endsWith(";")) semicolonLines++;
        else if (
          trimmed.endsWith("}") ||
          trimmed.endsWith(")") ||
          trimmed.endsWith(",")
        ) {
          /* structure lines, skip */
        } else if (/^(?:import|export|const|let|var|return|throw)\b/.test(trimmed)) {
          noSemicolonLines++;
        }
      }

      // Indentation
      if (/^ {2}[^ ]/.test(line)) twoSpaces++;
      else if (/^ {4}[^ ]/.test(line)) fourSpaces++;
      else if (/^\t/.test(line)) tabs++;
    }

    // Quotes in imports/strings
    const singleQ = s.content.match(/from\s+'|import\s+'/g);
    const doubleQ = s.content.match(/from\s+"|import\s+"/g);
    if (singleQ) singleQuotes += singleQ.length;
    if (doubleQ) doubleQuotes += doubleQ.length;

    // Trailing commas (in objects/arrays/params)
    const trailingCommaMatches = s.content.match(/,\s*[\n\r]\s*[}\])]/g);
    if (trailingCommaMatches) trailingCommas += trailingCommaMatches.length;
    const noTrailingMatches = s.content.match(/[^,\s]\s*[\n\r]\s*[}\])]/g);
    if (noTrailingMatches) noTrailingCommas += noTrailingMatches.length;
  }

  const semicolons = semicolonLines > noSemicolonLines;
  let quotes: CodeStyle["quotes"] = "mixed";
  if (singleQuotes > doubleQuotes * 2) quotes = "single";
  else if (doubleQuotes > singleQuotes * 2) quotes = "double";

  let indentation: CodeStyle["indentation"] = "mixed";
  if (twoSpaces > fourSpaces && twoSpaces > tabs) indentation = "2-spaces";
  else if (fourSpaces > twoSpaces && fourSpaces > tabs) indentation = "4-spaces";
  else if (tabs > twoSpaces && tabs > fourSpaces) indentation = "tabs";

  evidence.push(`Semicolons: ${semicolonLines} yes, ${noSemicolonLines} no`);
  evidence.push(`Quotes: ${singleQuotes} single, ${doubleQuotes} double`);
  evidence.push(`Indent: ${twoSpaces} 2-space, ${fourSpaces} 4-space, ${tabs} tabs`);
  evidence.push(`Max line: ${maxLine}`);

  return {
    semicolons,
    quotes,
    trailingCommas: trailingCommas > noTrailingCommas,
    indentation,
    maxLineLength: maxLine,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function detectPatterns(projectPath: string): CodePatterns {
  const allFiles = collectSourceFiles(projectPath, 0, 5, projectPath);
  const samples = sampleFiles(allFiles);

  return {
    naming: detectNaming(samples, allFiles),
    errorHandling: detectErrorHandling(samples),
    imports: detectImports(samples),
    functions: detectFunctions(samples),
    testing: detectTesting(samples, projectPath),
    architecture: detectArchitecture(allFiles, projectPath),
    dependencies: detectDependencies(projectPath),
    fileOrganization: detectFileOrganization(allFiles, projectPath),
    codeStyle: detectCodeStyle(samples),
  };
}

export { collectSourceFiles, sampleFiles };
