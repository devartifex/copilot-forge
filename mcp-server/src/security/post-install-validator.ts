import fs from 'node:fs';
import path from 'node:path';

export interface PostInstallIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  fix?: string;
}

export interface PostInstallValidation {
  file: string;
  valid: boolean;
  issues: PostInstallIssue[];
}

const SIZE_WARN = 500 * 1024;
const SIZE_ERROR = 1024 * 1024;

function listFilesRecursively(dir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...listFilesRecursively(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function globToRegex(pattern: string): RegExp {
  let re = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      // ** matches across path segments
      re += '.*';
      i += 2;
      // skip trailing separator after **
      if (pattern[i] === '/' || pattern[i] === '\\') i++;
    } else if (ch === '*') {
      // * matches within a single path segment
      re += '[^/\\\\]*';
      i++;
    } else if (ch === '?') {
      re += '[^/\\\\]';
      i++;
    } else if (ch === '.') {
      re += '\\.';
      i++;
    } else {
      re += ch;
      i++;
    }
  }
  return new RegExp(`^${re}$`, 'i');
}

export function validateApplyToPattern(pattern: string, projectFiles: string[]): boolean {
  const regex = globToRegex(pattern.trim());
  return projectFiles.some((f) => regex.test(f));
}

export function suggestApplyToFix(
  currentPattern: string,
  projectFiles: string[],
): string | null {
  const trimmed = currentPattern.trim();

  // JS pattern but project has TS files
  if (/\*\.js$/i.test(trimmed) || /\*\.mjs$/i.test(trimmed)) {
    const hasTs = projectFiles.some(
      (f) => f.endsWith('.ts') || f.endsWith('.mts') || f.endsWith('.tsx'),
    );
    if (hasTs) {
      return '**/*.ts, **/*.mts, **/*.js, **/*.mjs';
    }
  }

  // Python pattern but no Python files
  if (/\*\.py$/i.test(trimmed)) {
    const hasPy = projectFiles.some((f) => f.endsWith('.py'));
    if (!hasPy) {
      return null;
    }
  }

  return null;
}

export function patchApplyTo(filePath: string, newPattern: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const fmStart = lines.findIndex((l) => l.trim() === '---');
  if (fmStart === -1) return;
  const fmEnd = lines.findIndex((l, idx) => idx > fmStart && l.trim() === '---');
  if (fmEnd === -1) return;

  for (let i = fmStart + 1; i < fmEnd; i++) {
    if (/^\s*applyTo\s*:/.test(lines[i])) {
      lines[i] = `applyTo: "${newPattern}"`;
      break;
    }
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

function parseFrontmatter(content: string): {
  attrs: Record<string, string>;
  bodyStart: number;
} | null {
  if (!content.startsWith('---')) return null;
  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) return null;

  const fmBlock = content.slice(3, endIdx).trim();
  const attrs: Record<string, string> = {};
  for (const line of fmBlock.split('\n')) {
    const colon = line.indexOf(':');
    if (colon !== -1) {
      const key = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
      attrs[key] = value;
    }
  }

  // bodyStart is after the closing ---
  const closingNewline = content.indexOf('\n', endIdx + 1);
  const bodyStart = closingNewline === -1 ? content.length : closingNewline + 1;
  return { attrs, bodyStart };
}

export function validateInstalledAsset(
  filePath: string,
  projectRoot: string,
): PostInstallValidation {
  const issues: PostInstallIssue[] = [];
  const result: PostInstallValidation = { file: filePath, valid: true, issues };

  // Read the file
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    issues.push({
      severity: 'error',
      code: 'FILE_READ_ERROR',
      message: `Cannot read file: ${filePath}`,
    });
    result.valid = false;
    return result;
  }

  // Check file size
  const stat = fs.statSync(filePath);
  if (stat.size > SIZE_ERROR) {
    issues.push({
      severity: 'error',
      code: 'FILE_TOO_LARGE',
      message: `File size ${stat.size} bytes exceeds 1MB limit`,
    });
    result.valid = false;
  } else if (stat.size > SIZE_WARN) {
    issues.push({
      severity: 'warning',
      code: 'FILE_LARGE',
      message: `File size ${stat.size} bytes exceeds 500KB; consider trimming`,
    });
  }

  // Parse frontmatter
  const fm = parseFrontmatter(content);
  if (!fm) {
    issues.push({
      severity: 'error',
      code: 'INVALID_FRONTMATTER',
      message: 'File does not contain valid YAML frontmatter (between --- markers)',
    });
    result.valid = false;
    return result;
  }

  // Check required fields
  if (!fm.attrs['name']) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_NAME',
      message: 'Frontmatter is missing a "name" field',
    });
  }
  if (!fm.attrs['description']) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_DESCRIPTION',
      message: 'Frontmatter is missing a "description" field',
    });
  }

  // Check applyTo patterns
  const applyTo = fm.attrs['applyTo'];
  if (applyTo) {
    const absoluteFiles = listFilesRecursively(projectRoot);
    const projectFiles = absoluteFiles.map((f) =>
      path.relative(projectRoot, f).replace(/\\/g, '/'),
    );

    const patterns = applyTo.split(',').map((p) => p.trim());
    for (const pattern of patterns) {
      if (!pattern) continue;
      const matches = validateApplyToPattern(pattern, projectFiles);
      if (!matches) {
        const fix = suggestApplyToFix(pattern, projectFiles);
        issues.push({
          severity: 'warning',
          code: 'APPLY_TO_NO_MATCH',
          message: `applyTo pattern '${pattern}' matches no files in this project`,
          ...(fix ? { fix: `Consider using: ${fix}` } : {}),
        });
      }
    }
  }

  // Check for empty content after frontmatter
  const body = content.slice(fm.bodyStart).trim();
  if (body.length === 0) {
    issues.push({
      severity: 'error',
      code: 'EMPTY_CONTENT',
      message: 'File has no content after frontmatter',
    });
    result.valid = false;
  }

  // Mark invalid if any error-severity issue exists
  if (issues.some((i) => i.severity === 'error')) {
    result.valid = false;
  }

  return result;
}
