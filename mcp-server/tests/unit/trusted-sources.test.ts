import { describe, it, expect } from 'vitest';
import {
  validateUrl,
  getTrustLevel,
  isVerifiedSource,
  getTrustBadge,
  addTrustedOrg,
} from '../../src/security/trusted-sources.js';

describe('validateUrl', () => {
  it('accepts raw.githubusercontent.com URLs', () => {
    const result = validateUrl('https://raw.githubusercontent.com/org/repo/main/file.md');
    expect(result.valid).toBe(true);
  });

  it('accepts github.com URLs', () => {
    const result = validateUrl('https://github.com/org/repo');
    expect(result.valid).toBe(true);
  });

  it('rejects random domains', () => {
    const result = validateUrl('https://evil.com/payload');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not in allowlist');
  });

  it('rejects localhost', () => {
    const result = validateUrl('http://localhost:8080/secret');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Internal');
  });

  it('rejects 127.0.0.1', () => {
    const result = validateUrl('http://127.0.0.1/secret');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Internal');
  });

  it('rejects 192.168.x.x', () => {
    const result = validateUrl('http://192.168.1.1/admin');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Internal');
  });

  it('rejects 10.x addresses', () => {
    const result = validateUrl('http://10.0.0.1/internal');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Internal');
  });

  it('rejects ::1', () => {
    const result = validateUrl('http://[::1]/secret');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Internal');
  });

  it('rejects invalid URLs', () => {
    const result = validateUrl('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid URL');
  });
});

describe('getTrustLevel', () => {
  it('returns verified for github/awesome-copilot', () => {
    const info = getTrustLevel('https://github.com/github/awesome-copilot');
    expect(info.level).toBe('verified');
  });

  it('returns verified for microsoft/* wildcard', () => {
    const info = getTrustLevel('https://github.com/microsoft/some-repo');
    expect(info.level).toBe('verified');
  });

  it('returns unknown for random-user/random-repo', () => {
    const info = getTrustLevel('https://github.com/random-user/random-repo');
    expect(info.level).toBe('unknown');
  });

  it('returns unknown for non-GitHub URL', () => {
    const info = getTrustLevel('https://example.com/something');
    expect(info.level).toBe('unknown');
    expect(info.reason).toContain('Not a recognized');
  });
});

describe('isVerifiedSource', () => {
  it('returns true for verified sources', () => {
    expect(isVerifiedSource('https://github.com/microsoft/copilot-skills')).toBe(true);
  });

  it('returns false for unknown sources', () => {
    expect(isVerifiedSource('https://github.com/random/repo')).toBe(false);
  });
});

describe('getTrustBadge', () => {
  it('returns ✅ for verified', () => {
    expect(getTrustBadge('verified')).toBe('✅');
  });

  it('returns ⚠️ for community', () => {
    expect(getTrustBadge('community')).toBe('⚠️');
  });

  it('returns ❌ for unknown', () => {
    expect(getTrustBadge('unknown')).toBe('❌');
  });
});

describe('addTrustedOrg', () => {
  it('adds a new org and getTrustLevel reflects it', () => {
    addTrustedOrg('my-custom-org/*', 'verified');
    const info = getTrustLevel('https://github.com/my-custom-org/any-repo');
    expect(info.level).toBe('verified');
  });
});
