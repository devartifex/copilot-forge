import { describe, it, expect } from 'vitest';
import {
  canonicalizeName,
  extractGitHubRepo,
  deduplicateResults,
} from '../../src/security/deduplication.js';

describe('canonicalizeName', () => {
  it('strips common prefixes', () => {
    expect(canonicalizeName('awesome-python')).toBe('python');
  });

  it('strips common suffixes', () => {
    expect(canonicalizeName('docker-copilot')).toBe('docker');
  });

  it('lowercases and normalizes', () => {
    expect(canonicalizeName('My-Cool_Skill')).toBe('my cool skill');
  });

  it('strips both prefix and suffix', () => {
    expect(canonicalizeName('awesome-test-skill')).toBe('test');
  });
});

describe('extractGitHubRepo', () => {
  it('extracts org/repo from github.com URL', () => {
    expect(extractGitHubRepo('https://github.com/microsoft/vscode')).toBe('microsoft/vscode');
  });

  it('extracts org/repo from raw.githubusercontent.com URL', () => {
    expect(
      extractGitHubRepo('https://raw.githubusercontent.com/org/repo/main/file.md'),
    ).toBe('org/repo');
  });

  it('extracts org/repo from api.github.com URL', () => {
    expect(
      extractGitHubRepo('https://api.github.com/repos/microsoft/typescript/contents'),
    ).toBe('microsoft/typescript');
  });

  it('returns null for non-GitHub URLs', () => {
    expect(extractGitHubRepo('https://example.com/org/repo')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(extractGitHubRepo('not a url')).toBeNull();
  });
});

describe('deduplicateResults', () => {
  it('merges same-name results from different sources', () => {
    const results = [
      {
        name: 'awesome-docker-skill',
        type: 'skill',
        description: 'Docker skill from source A',
        source: 'sourceA',
        sourceUrl: 'https://github.com/org1/awesome-docker-skill',
        relevanceScore: 0.8,
        trustLevel: 'community',
      },
      {
        name: 'awesome-docker-copilot',
        type: 'skill',
        description: 'Docker skill from source B',
        source: 'sourceB',
        sourceUrl: 'https://github.com/org2/awesome-docker-copilot',
        relevanceScore: 0.7,
        trustLevel: 'unknown',
      },
    ];

    const deduped = deduplicateResults(results);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].alsoFoundIn).toHaveLength(1);
  });

  it('keeps unique results separate', () => {
    const results = [
      {
        name: 'python-skill',
        type: 'skill',
        description: 'Python',
        source: 'a',
        sourceUrl: 'https://github.com/org1/python-skill',
        relevanceScore: 0.9,
        trustLevel: 'verified',
      },
      {
        name: 'rust-skill',
        type: 'skill',
        description: 'Rust',
        source: 'b',
        sourceUrl: 'https://github.com/org2/rust-skill',
        relevanceScore: 0.8,
        trustLevel: 'community',
      },
    ];

    const deduped = deduplicateResults(results);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].alsoFoundIn).toHaveLength(0);
    expect(deduped[1].alsoFoundIn).toHaveLength(0);
  });

  it('picks highest trust level as primary', () => {
    const results = [
      {
        name: 'test-copilot',
        type: 'skill',
        description: 'Test from unknown',
        source: 'sourceA',
        sourceUrl: 'https://github.com/unknown-org/test-copilot',
        relevanceScore: 0.9,
        trustLevel: 'unknown',
      },
      {
        name: 'test-skill',
        type: 'skill',
        description: 'Test from verified',
        source: 'sourceB',
        sourceUrl: 'https://github.com/verified-org/test-skill',
        relevanceScore: 0.7,
        trustLevel: 'verified',
      },
    ];

    const deduped = deduplicateResults(results);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].trustLevel).toBe('verified');
    expect(deduped[0].primarySource).toBe('sourceB');
  });

  it('sorts by relevance then trust', () => {
    const results = [
      {
        name: 'low-relevance',
        type: 'skill',
        description: 'Low',
        source: 'a',
        sourceUrl: 'https://github.com/org1/low-relevance',
        relevanceScore: 0.3,
        trustLevel: 'verified',
      },
      {
        name: 'high-relevance',
        type: 'skill',
        description: 'High',
        source: 'b',
        sourceUrl: 'https://github.com/org2/high-relevance',
        relevanceScore: 0.9,
        trustLevel: 'unknown',
      },
    ];

    const deduped = deduplicateResults(results);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].name).toBe('high-relevance');
    expect(deduped[1].name).toBe('low-relevance');
  });
});
