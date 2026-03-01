import { describe, it, expect } from 'vitest';
import { validateTargetPath, sanitizeFilename } from '../../src/security/path-safety.js';

describe('validateTargetPath', () => {
  const projectRoot = process.platform === 'win32' ? 'C:\\project' : '/project';

  it('accepts valid .github/ paths', () => {
    const result = validateTargetPath(projectRoot, '.github/instructions/test.md');
    expect(result.valid).toBe(true);
  });

  it('rejects path traversal (..)', () => {
    const result = validateTargetPath(projectRoot, '.github/../../../etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('..');
  });

  it('rejects paths outside project root', () => {
    const outsidePath = process.platform === 'win32' ? 'D:\\other\\file.md' : '/other/file.md';
    const result = validateTargetPath(projectRoot, outsidePath);
    expect(result.valid).toBe(false);
  });

  it('rejects paths not under .github/', () => {
    const result = validateTargetPath(projectRoot, 'src/main.ts');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('.github/');
  });

  it('rejects null bytes', () => {
    const result = validateTargetPath(projectRoot, '.github/test\0.md');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('null bytes');
  });

  it('rejects very long paths', () => {
    const longPath = '.github/' + 'a'.repeat(600) + '.md';
    const result = validateTargetPath(projectRoot, longPath);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('maximum length');
  });
});

describe('sanitizeFilename', () => {
  it('removes path separators', () => {
    expect(sanitizeFilename('some/file\\name.md')).toBe('somefilename.md');
  });

  it('removes ..', () => {
    expect(sanitizeFilename('..test..file.md')).toBe('testfile.md');
  });

  it('throws on empty result', () => {
    expect(() => sanitizeFilename('///\\\\')).toThrow('empty after sanitization');
  });
});
