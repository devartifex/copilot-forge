export const MAX_CONTENT_SIZE = 512_000;

export const SUSPICIOUS_PATTERNS: readonly RegExp[] = [
  /<script/i,
  /rm\s+-rf\s/,
  /curl\s.*\|\s*bash/,
  /wget\s/,
  /eval\s*\(/,
  /exec\s*\(/,
  /[A-Za-z0-9+/=]{500,}/,
  /\/etc\/passwd/,
  /C:\\\\Windows\\\\System32/i,
  /ignore previous instructions/i,
  /system prompt/i,
  /you are now/i,
];

export const VALID_EXTENSIONS: ReadonlyMap<string, string> = new Map<string, string>([
  ['instruction', '.instructions.md'],
  ['prompt', '.prompt.md'],
  ['skill', 'SKILL.md'],
  ['agent', '.agent.md'],
]);

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

function emptyResult(): ValidationResult {
  return { valid: true, warnings: [], errors: [] };
}

function mergeResults(...results: ValidationResult[]): ValidationResult {
  const merged: ValidationResult = { valid: true, warnings: [], errors: [] };
  for (const r of results) {
    merged.warnings.push(...r.warnings);
    merged.errors.push(...r.errors);
    if (!r.valid) merged.valid = false;
  }
  return merged;
}

export function validateContentSize(content: string): ValidationResult {
  const result = emptyResult();
  if (content.length > MAX_CONTENT_SIZE) {
    result.valid = false;
    result.errors.push(
      `Content size ${content.length} bytes exceeds maximum of ${MAX_CONTENT_SIZE} bytes`,
    );
  }
  return result;
}

export function scanForSuspiciousPatterns(content: string): ValidationResult {
  const result = emptyResult();
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(lines[i])) {
        result.warnings.push(`Line ${i + 1}: suspicious pattern detected (${pattern.source})`);
      }
    }
  }

  return result;
}

export function validateFileFormat(content: string, assetType: string): ValidationResult {
  const result = emptyResult();

  const extension = VALID_EXTENSIONS.get(assetType);
  if (!extension) {
    result.valid = false;
    result.errors.push(`Unknown asset type: ${assetType}`);
    return result;
  }

  if (!content.startsWith('---')) {
    result.valid = false;
    result.errors.push('Missing YAML front matter: file must start with ---');
    return result;
  }

  const closingIndex = content.indexOf('---', 3);
  if (closingIndex === -1) {
    result.valid = false;
    result.errors.push('Malformed YAML front matter: missing closing ---');
    return result;
  }

  return result;
}

export function validateContent(content: string, assetType: string): ValidationResult {
  return mergeResults(
    validateContentSize(content),
    scanForSuspiciousPatterns(content),
    validateFileFormat(content, assetType),
  );
}
