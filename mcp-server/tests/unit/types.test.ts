import { describe, it, expect } from 'vitest';
import type { DiscoveryResult } from '../../src/types.js';

describe('types', () => {
  it('should define DiscoveryResult type correctly', () => {
    const result: DiscoveryResult = {
      name: 'test',
      type: 'skill',
      description: 'test desc',
      source: 'awesome-copilot',
      sourceUrl: 'https://github.com/test',
      relevanceScore: 0.8,
      status: 'not-installed',
    };
    expect(result.name).toBe('test');
  });
});
