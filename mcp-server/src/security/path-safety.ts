import path from "node:path";
import fs from "node:fs";

export interface PathValidation {
  valid: boolean;
  resolvedPath: string;
  error?: string;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;
const MAX_PATH_LENGTH = 500;

export function validateTargetPath(
  projectRoot: string,
  targetPath: string,
): PathValidation {
  const resolvedRoot = path.resolve(projectRoot);
  const resolvedTarget = path.resolve(resolvedRoot, targetPath);

  if (resolvedTarget.length > MAX_PATH_LENGTH) {
    return { valid: false, resolvedPath: resolvedTarget, error: "Path exceeds maximum length of 500 characters" };
  }

  if (targetPath.includes("\0") || CONTROL_CHAR_RE.test(targetPath)) {
    return { valid: false, resolvedPath: resolvedTarget, error: "Path contains null bytes or control characters" };
  }

  if (targetPath.includes("..")) {
    return { valid: false, resolvedPath: resolvedTarget, error: "Path contains disallowed '..' segment" };
  }

  const normalizedRoot = resolvedRoot + path.sep;
  if (!resolvedTarget.startsWith(normalizedRoot)) {
    return { valid: false, resolvedPath: resolvedTarget, error: "Path is outside the project root" };
  }

  const relative = path.relative(resolvedRoot, resolvedTarget);
  const topDir = relative.split(path.sep)[0];
  if (topDir !== ".github") {
    return { valid: false, resolvedPath: resolvedTarget, error: "Path must be within the .github/ subdirectory" };
  }

  return { valid: true, resolvedPath: resolvedTarget };
}

export function sanitizeFilename(filename: string): string {
  let sanitized = filename;

  sanitized = sanitized.replace(/\0/g, "");
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x01-\x1f\x7f]/g, "");
  sanitized = sanitized.replace(/[/\\]/g, "");
  sanitized = sanitized.replace(/\.\./g, "");
  sanitized = sanitized.trim();

  if (sanitized.length === 0) {
    throw new Error("Filename is empty after sanitization");
  }

  return sanitized;
}

export function ensureGithubDir(projectRoot: string): string {
  const githubDir = path.resolve(projectRoot, ".github");
  fs.mkdirSync(githubDir, { recursive: true });
  return githubDir;
}
