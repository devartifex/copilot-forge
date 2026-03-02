import { describe, it, expect } from 'vitest';
import type { ProjectProfile } from '../../src/types.js';

describe('types', () => {
  it('should define ProjectProfile type correctly', () => {
    const profile: ProjectProfile = {
      languages: [{ name: 'TypeScript', fileCount: 10, primary: true }],
      frameworks: ['Express'],
      packageManagers: ['npm'],
      cicd: ['github-actions'],
      cloudProviders: [],
      existingCustomizations: {
        instructions: [],
        prompts: [],
        skills: [],
        agents: [],
        mcpServers: [],
      },
    };
    expect(profile.languages[0].name).toBe('TypeScript');
  });
});
