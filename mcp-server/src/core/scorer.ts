import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreCategory {
  id: string;
  name: string;
  maxPoints: number;
  points: number;
  status: "✅" | "⚠️" | "❌";
  detail: string;
  fix: string;
}

export interface ScoreResult {
  totalScore: number;
  maxScore: number;
  grade: { letter: string; emoji: string; message: string };
  categories: ScoreCategory[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileSafe(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function listDir(path: string): string[] {
  try {
    if (!existsSync(path)) return [];
    return readdirSync(path);
  } catch {
    return [];
  }
}

function getAllInstructionContent(ghDir: string): string {
  let content = "";
  const mainFile = join(ghDir, "copilot-instructions.md");
  if (existsSync(mainFile)) content += readFileSafe(mainFile);

  const instrDir = join(ghDir, "instructions");
  for (const f of listDir(instrDir)) {
    content += " " + readFileSafe(join(instrDir, f));
  }

  const skillDir = join(ghDir, "skills");
  for (const s of listDir(skillDir)) {
    const skillFile = join(skillDir, s, "SKILL.md");
    if (existsSync(skillFile)) content += " " + readFileSafe(skillFile);
  }

  return content;
}

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

function scoreHasInstructions(ghDir: string): ScoreCategory {
  const file = join(ghDir, "copilot-instructions.md");
  const exists = existsSync(file);
  const content = exists ? readFileSafe(file) : "";
  const length = content.length;

  const points = !exists ? 0 : length < 200 ? 1 : 2;
  const detail = !exists
    ? "No copilot-instructions.md found"
    : length < 200
      ? `copilot-instructions.md exists but is thin (${length} chars)`
      : `copilot-instructions.md is comprehensive (${length} chars)`;
  const fix = !exists
    ? "Run `generate_instructions` to create one from your codebase patterns"
    : length < 200
      ? "Run `generate_instructions` to enrich it with detected codebase patterns"
      : "";

  return {
    id: "has-instructions",
    name: "Has copilot-instructions.md",
    maxPoints: 2,
    points,
    status: points === 2 ? "✅" : points === 1 ? "⚠️" : "❌",
    detail,
    fix,
  };
}

function scoreCodingStandards(ghDir: string): ScoreCategory {
  const instructionsContent = existsSync(join(ghDir, "copilot-instructions.md"))
    ? readFileSafe(join(ghDir, "copilot-instructions.md"))
    : "";

  const instrDir = join(ghDir, "instructions");
  let allContent = instructionsContent;
  for (const f of listDir(instrDir)) {
    allContent += readFileSafe(join(instrDir, f));
  }

  const lower = allContent.toLowerCase();
  const hasNaming = /naming|camelcase|snake_case|pascal/i.test(lower);
  const hasStyle = /style|indent|semicolon|quotes|format/i.test(lower);

  const points = hasNaming && hasStyle ? 1 : 0;
  return {
    id: "coding-standards",
    name: "Covers coding standards",
    maxPoints: 1,
    points,
    status: points > 0 ? "✅" : "❌",
    detail: points > 0
      ? "Instructions cover naming and code style"
      : "No naming or style conventions documented",
    fix: points > 0 ? "" : "Add naming conventions and code style rules to your instructions",
  };
}

function scoreErrorHandling(ghDir: string): ScoreCategory {
  const allContent = getAllInstructionContent(ghDir);
  const has = /error.?handling|try.?catch|exception|throw|error.*class/i.test(allContent);

  return {
    id: "error-handling",
    name: "Covers error handling",
    maxPoints: 1,
    points: has ? 1 : 0,
    status: has ? "✅" : "❌",
    detail: has ? "Error handling patterns documented" : "No error handling guidance",
    fix: has ? "" : "Document your error handling patterns (try-catch style, custom errors, error messages)",
  };
}

function scoreTestingPractices(ghDir: string): ScoreCategory {
  const allContent = getAllInstructionContent(ghDir);
  const has = /test|vitest|jest|mocha|pytest|spec|describe\(|it\(/i.test(allContent);

  return {
    id: "testing",
    name: "Covers testing practices",
    maxPoints: 1,
    points: has ? 1 : 0,
    status: has ? "✅" : "❌",
    detail: has ? "Testing standards documented" : "No testing guidance",
    fix: has ? "" : "Add testing framework, patterns, and coverage expectations to your instructions",
  };
}

function scoreLanguageInstructions(ghDir: string, projectPath: string): ScoreCategory {
  const instrDir = join(ghDir, "instructions");
  const files = listDir(instrDir).filter((f) => f.endsWith(".instructions.md"));

  const pkgPath = join(projectPath, "package.json");
  let hasTS = false;
  const hasPython = existsSync(join(projectPath, "requirements.txt")) || existsSync(join(projectPath, "pyproject.toml"));
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSafe(pkgPath));
      hasTS = "typescript" in { ...pkg.dependencies, ...pkg.devDependencies };
    } catch {
      /* skip */
    }
  }

  const fileContent = files.map((f) => readFileSafe(join(instrDir, f)).toLowerCase()).join(" ");
  const coversTS = hasTS && (/typescript|\.ts|\.tsx/.test(fileContent) || files.some((f) => /typescript|node|javascript/i.test(f)));
  const coversPython = hasPython && (/python|\.py/.test(fileContent) || files.some((f) => /python/i.test(f)));

  const needed = (hasTS ? 1 : 0) + (hasPython ? 1 : 0);
  const covered = (coversTS ? 1 : 0) + (coversPython ? 1 : 0);

  const points = needed === 0 ? 1 : covered >= needed ? 1 : 0;

  return {
    id: "language-instructions",
    name: "Language-specific instructions",
    maxPoints: 1,
    points,
    status: points > 0 ? "✅" : "❌",
    detail: files.length > 0
      ? `${files.length} language instruction file(s): ${files.join(", ")}`
      : "No language-specific instruction files",
    fix: points > 0 ? "" : `Add instruction files in .github/instructions/ for your stack${hasTS ? " (TypeScript)" : ""}${hasPython ? " (Python)" : ""}`,
  };
}

function scoreSecurityGovernance(ghDir: string): ScoreCategory {
  const allContent = getAllInstructionContent(ghDir);
  const has = /security|governance|safety|trust|audit|sanitiz|xss|injection|ssrf/i.test(allContent);

  return {
    id: "security",
    name: "Has security/governance rules",
    maxPoints: 1,
    points: has ? 1 : 0,
    status: has ? "✅" : "❌",
    detail: has ? "Security or governance instructions present" : "No security guidance for AI",
    fix: has ? "" : "Add security instructions — teach Copilot about input validation, auth patterns, and safe defaults",
  };
}

function scorePrompts(ghDir: string): ScoreCategory {
  const promptDir = join(ghDir, "prompts");
  const prompts = listDir(promptDir).filter((f) => f.endsWith(".prompt.md"));

  return {
    id: "prompts",
    name: "Has useful prompts",
    maxPoints: 1,
    points: prompts.length > 0 ? 1 : 0,
    status: prompts.length > 0 ? "✅" : "❌",
    detail: prompts.length > 0
      ? `${prompts.length} prompt(s): ${prompts.join(", ")}`
      : "No reusable prompts",
    fix: prompts.length > 0 ? "" : "Create .github/prompts/ with reusable workflows (e.g., code review, refactoring, feature scaffolding)",
  };
}

function scoreAgentsSkills(ghDir: string): ScoreCategory {
  const agentDir = join(ghDir, "agents");
  const skillDir = join(ghDir, "skills");
  const agents = listDir(agentDir).filter((f) => f.endsWith(".agent.md"));
  const skills = listDir(skillDir);

  const total = agents.length + skills.length;
  return {
    id: "agents-skills",
    name: "Has agents or skills",
    maxPoints: 1,
    points: total > 0 ? 1 : 0,
    status: total > 0 ? "✅" : "❌",
    detail: total > 0
      ? `${agents.length} agent(s), ${skills.length} skill(s)`
      : "No agents or skills configured",
    fix: total > 0 ? "" : "Add specialized agents or skills for your workflow (code review, deployment, documentation)",
  };
}

function scoreCommitConventions(ghDir: string): ScoreCategory {
  const allContent = getAllInstructionContent(ghDir);
  const skillDir = join(ghDir, "skills");
  const skills = listDir(skillDir);

  const hasConventional =
    /conventional.?commit|feat:|fix:|chore:|docs:/i.test(allContent) ||
    skills.some((s) => /commit/i.test(s));

  return {
    id: "commit-conventions",
    name: "Has commit conventions",
    maxPoints: 1,
    points: hasConventional ? 1 : 0,
    status: hasConventional ? "✅" : "❌",
    detail: hasConventional ? "Commit conventions documented" : "No commit message standards",
    fix: hasConventional ? "" : "Add conventional commit guidelines so Copilot generates standardized commit messages",
  };
}

// ---------------------------------------------------------------------------
// Grade calculation
// ---------------------------------------------------------------------------

export function getGrade(score: number, maxScore: number): { letter: string; emoji: string; message: string } {
  const pct = (score / maxScore) * 100;
  if (pct >= 90) return { letter: "A+", emoji: "🏆", message: "World-class Copilot setup! Your AI assistant is fully tuned to your codebase." };
  if (pct >= 80) return { letter: "A", emoji: "🌟", message: "Excellent setup. Copilot is well-configured for your project." };
  if (pct >= 70) return { letter: "B", emoji: "👍", message: "Good setup with room to improve. A few gaps could make Copilot significantly smarter." };
  if (pct >= 50) return { letter: "C", emoji: "📈", message: "Decent start. Several important areas are missing — Copilot is working with incomplete context." };
  if (pct >= 30) return { letter: "D", emoji: "⚡", message: "Minimal setup. Copilot is mostly guessing. Quick wins available!" };
  return { letter: "F", emoji: "🚀", message: "No Copilot setup detected. Huge opportunity — even basic instructions will dramatically improve output quality." };
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

export function computeScore(projectPath: string): ScoreResult {
  const ghDir = join(projectPath, ".github");

  const categories: ScoreCategory[] = [
    scoreHasInstructions(ghDir),
    scoreCodingStandards(ghDir),
    scoreErrorHandling(ghDir),
    scoreTestingPractices(ghDir),
    scoreLanguageInstructions(ghDir, projectPath),
    scoreSecurityGovernance(ghDir),
    scorePrompts(ghDir),
    scoreAgentsSkills(ghDir),
    scoreCommitConventions(ghDir),
  ];

  const totalScore = categories.reduce((sum, c) => sum + c.points, 0);
  const maxScore = categories.reduce((sum, c) => sum + c.maxPoints, 0);
  const grade = getGrade(totalScore, maxScore);

  return { totalScore, maxScore, grade, categories };
}

export function formatScoreReport(result: ScoreResult): string {
  const { totalScore, maxScore, grade, categories } = result;

  const lines: string[] = [
    `# ${grade.emoji} Copilot Setup Score: ${totalScore}/${maxScore} (${grade.letter})`,
    "",
    grade.message,
    "",
    "## Scorecard",
    "",
    "| # | Category | Score | Status | Detail |",
    "|---|----------|-------|--------|--------|",
  ];

  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    lines.push(
      `| ${i + 1} | ${c.name} | ${c.points}/${c.maxPoints} | ${c.status} | ${c.detail} |`,
    );
  }

  const gaps = categories.filter((c) => c.points < c.maxPoints && c.fix);
  if (gaps.length > 0) {
    lines.push("");
    lines.push("## 🎯 Quick Wins");
    lines.push("");

    gaps.sort((a, b) => (b.maxPoints - b.points) - (a.maxPoints - a.points));

    for (let i = 0; i < gaps.length; i++) {
      const g = gaps[i];
      const impact = g.maxPoints - g.points;
      lines.push(`${i + 1}. **${g.name}** (+${impact} pt${impact > 1 ? "s" : ""}) — ${g.fix}`);
    }
  }

  const filled = Math.round((totalScore / maxScore) * 20);
  const empty = 20 - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  lines.push("");
  lines.push(`## Progress`);
  lines.push("");
  lines.push(`\`[${bar}]\` ${totalScore}/${maxScore} (${Math.round((totalScore / maxScore) * 100)}%)`);

  if (totalScore < maxScore) {
    lines.push("");
    lines.push("---");
    lines.push("💡 **Next step:** Run `generate_instructions` to auto-generate instructions from your codebase patterns.");
  }

  return lines.join("\n");
}
