import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { registerSearchAwesomeCopilotTool } from '../../src/tools/search-awesome-copilot.js';

// Mock the cache module so each test starts fresh
vi.mock('../../src/cache/catalog-cache.js', () => ({
  getCached: vi.fn(() => null),
  setCache: vi.fn(),
}));

function makeMdTable(rows: { name: string; url: string; desc: string }[]): string {
  const header = '| Name | Description |\n| --- | --- |\n';
  return header + rows.map(r => `| [${r.name}](${r.url}) | ${r.desc} |`).join('\n');
}

function makeMdList(items: { name: string; url: string; desc: string }[]): string {
  return items.map(i => `- [${i.name}](${i.url}) - ${i.desc}`).join('\n');
}

async function createTestClient(): Promise<{ client: Client; cleanup: () => Promise<void> }> {
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  registerSearchAwesomeCopilotTool(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.1' });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    cleanup: async () => {
      await client.close();
      await server.close();
    },
  };
}

function mockFetchResponses(responses: Record<string, string>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      for (const [pattern, body] of Object.entries(responses)) {
        if (url.includes(pattern)) {
          return { ok: true, text: async () => body };
        }
      }
      return { ok: true, text: async () => '' };
    }),
  );
}

describe('search_copilot_assets', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    // Reset cache mock to return null (no cache)
    const cacheMod = vi.mocked(await import('../../src/cache/catalog-cache.js'));
    cacheMod.getCached.mockReturnValue(null);
    cacheMod.setCache.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and parses awesome-copilot catalog from table rows', async () => {
    const instructionsMd = makeMdTable([
      { name: 'React Best Practices', url: 'https://github.com/test/react.instructions.md', desc: 'React coding guidelines' },
      { name: 'Python Style', url: 'https://github.com/test/python.instructions.md', desc: 'Python style guide' },
    ]);

    mockFetchResponses({
      'README.instructions.md': instructionsMd,
    });

    const { client, cleanup } = await createTestClient();
    try {
      const result = await client.callTool({ name: 'search_copilot_assets', arguments: { query: 'react' } });
      const text = (result.content as { type: string; text: string }[])[0].text;
      expect(text).toContain('React Best Practices');
      expect(text).toContain('instruction');
      expect(text).not.toContain('Python Style');
    } finally {
      await cleanup();
    }
  });

  it('parses list-format entries', async () => {
    const skillsMd = makeMdList([
      { name: 'Docker Helper', url: 'https://github.com/test/docker', desc: 'Docker management skill' },
    ]);

    mockFetchResponses({
      'README.skills.md': skillsMd,
    });

    const { client, cleanup } = await createTestClient();
    try {
      const result = await client.callTool({ name: 'search_copilot_assets', arguments: { query: 'docker' } });
      const text = (result.content as { type: string; text: string }[])[0].text;
      expect(text).toContain('Docker Helper');
      expect(text).toContain('skill');
    } finally {
      await cleanup();
    }
  });

  it('filters by asset type', async () => {
    const instructionsMd = makeMdTable([
      { name: 'React Guide', url: 'https://github.com/test/react.instructions.md', desc: 'React instruction' },
    ]);
    const promptsMd = makeMdTable([
      { name: 'React Prompt', url: 'https://github.com/test/react.prompt.md', desc: 'React prompt helper' },
    ]);

    mockFetchResponses({
      'README.instructions.md': instructionsMd,
      'README.prompts.md': promptsMd,
    });

    const { client, cleanup } = await createTestClient();
    try {
      const result = await client.callTool({
        name: 'search_copilot_assets',
        arguments: { query: 'react', type: 'prompt' },
      });
      const text = (result.content as { type: string; text: string }[])[0].text;
      expect(text).toContain('React Prompt');
      expect(text).not.toContain('React Guide');
    } finally {
      await cleanup();
    }
  });

  it('returns "no results" message for no matches', async () => {
    mockFetchResponses({});

    const { client, cleanup } = await createTestClient();
    try {
      const result = await client.callTool({
        name: 'search_copilot_assets',
        arguments: { query: 'zzz-nonexistent-zzz' },
      });
      const text = (result.content as { type: string; text: string }[])[0].text;
      expect(text).toContain('No Copilot assets found');
    } finally {
      await cleanup();
    }
  });

  it('handles fetch failures gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    );

    const { client, cleanup } = await createTestClient();
    try {
      const result = await client.callTool({
        name: 'search_copilot_assets',
        arguments: { query: 'anything' },
      });
      const text = (result.content as { type: string; text: string }[])[0].text;
      // Should not crash, returns no results
      expect(text).toContain('No Copilot assets found');
    } finally {
      await cleanup();
    }
  });

  it('filters by language parameter', async () => {
    const instructionsMd = makeMdTable([
      { name: 'React TS Guide', url: 'https://github.com/test/react-ts', desc: 'React TypeScript patterns' },
      { name: 'React JS Guide', url: 'https://github.com/test/react-js', desc: 'React JavaScript basics' },
    ]);

    mockFetchResponses({
      'README.instructions.md': instructionsMd,
    });

    const { client, cleanup } = await createTestClient();
    try {
      const result = await client.callTool({
        name: 'search_copilot_assets',
        arguments: { query: 'react', language: 'typescript' },
      });
      const text = (result.content as { type: string; text: string }[])[0].text;
      expect(text).toContain('React TS Guide');
      expect(text).not.toContain('React JS Guide');
    } finally {
      await cleanup();
    }
  });

  it('sorts results with name matches first', async () => {
    const instructionsMd = makeMdTable([
      { name: 'General Guide', url: 'https://github.com/test/general', desc: 'Has python tips inside' },
      { name: 'Python Mastery', url: 'https://github.com/test/python', desc: 'Advanced python' },
    ]);

    mockFetchResponses({
      'README.instructions.md': instructionsMd,
    });

    const { client, cleanup } = await createTestClient();
    try {
      const result = await client.callTool({
        name: 'search_copilot_assets',
        arguments: { query: 'python' },
      });
      const text = (result.content as { type: string; text: string }[])[0].text;
      const pythonIdx = text.indexOf('Python Mastery');
      const generalIdx = text.indexOf('General Guide');
      expect(pythonIdx).toBeLessThan(generalIdx);
    } finally {
      await cleanup();
    }
  });
});
