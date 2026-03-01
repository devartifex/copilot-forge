import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const execFile = promisify(execFileCb);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecResult {
  stdout: string;
  stderr: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function run(cmd: string, args: string[], cwd?: string): Promise<ExecResult> {
  const { stdout, stderr } = await execFile(cmd, args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

// ---------------------------------------------------------------------------
// Auth check
// ---------------------------------------------------------------------------

export async function checkGhAuth(): Promise<boolean> {
  try {
    await run("gh", ["auth", "status"]);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Clone
// ---------------------------------------------------------------------------

export async function cloneRepo(slug: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "copilot-forge-"));
  await run("gh", ["repo", "clone", slug, dir, "--", "--depth", "1"]);
  return dir;
}

// ---------------------------------------------------------------------------
// Branch
// ---------------------------------------------------------------------------

export async function createBranch(repoDir: string, branchName: string): Promise<void> {
  await run("git", ["checkout", "-b", branchName], repoDir);
}

// ---------------------------------------------------------------------------
// Commit & Push
// ---------------------------------------------------------------------------

export async function commitAndPush(
  repoDir: string,
  message: string,
  branchName: string,
): Promise<void> {
  await run("git", ["add", ".github/"], repoDir);
  await run("git", [
    "commit",
    "-m", message,
    "--trailer", "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>",
  ], repoDir);
  await run("git", ["push", "origin", branchName], repoDir);
}

// ---------------------------------------------------------------------------
// PR
// ---------------------------------------------------------------------------

export interface PRResult {
  url: string;
}

export async function createPR(
  repoDir: string,
  title: string,
  body: string,
): Promise<PRResult> {
  const { stdout } = await run("gh", [
    "pr", "create",
    "--title", title,
    "--body", body,
    "--repo", await getRepoSlug(repoDir),
  ], repoDir);

  const url = stdout.split("\n").pop() ?? stdout;
  return { url };
}

export async function checkExistingPR(
  slug: string,
  branchName: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await run("gh", [
      "pr", "list",
      "--repo", slug,
      "--head", branchName,
      "--json", "url",
      "--limit", "1",
    ]);
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed[0].url as string;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Repo info
// ---------------------------------------------------------------------------

async function getRepoSlug(repoDir: string): Promise<string> {
  const { stdout } = await run("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], repoDir);
  return stdout;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export async function cleanupDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}
