import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { registerSearchAwesomeCopilotTool } from '../../src/tools/search-awesome-copilot.js';
import { registerSearchMcpRegistryTool } from '../../src/tools/search-mcp-registry.js';
import { registerAnalyzeProjectTool } from '../../src/tools/analyze-project.js';
import { registerGetDetailsTool } from '../../src/tools/get-details.js';
import { registerInstallAssetTool } from '../../src/tools/install-asset.js';
import { registerGenerateInstructionsTool } from '../../src/tools/generate-instructions.js';
import { registerScoreSetupTool } from '../../src/tools/score-setup.js';
import { registerGenerateOrgStandardsTool } from '../../src/tools/generate-org-standards.js';
import { registerResources } from '../../src/resources.js';

// Mock cache so tests are isolated
vi.mock('../../src/cache/catalog-cache.js', () => ({
  getCached: vi.fn(() => null),
  setCache: vi.fn(),
  getCacheStatus: vi.fn(() => []),
}));

// Mock audit log to avoid filesystem side effects
vi.mock('../../src/security/audit-log.js', () => ({
  logAuditEntry: vi.fn(),
  computeContentHash: vi.fn(() => 'abc123'),
  getRecentAuditEntries: vi.fn(() => []),
}));

let server: McpServer;
let client: Client;

async function setupServer(): Promise<void> {
  server = new McpServer({ name: 'copilot-skills-discovery', version: '1.0.0' });

  registerSearchAwesomeCopilotTool(server);
  registerSearchMcpRegistryTool(server);
  registerAnalyzeProjectTool(server);
  registerGetDetailsTool(server);
  registerInstallAssetTool(server);
  registerGenerateInstructionsTool(server);
  registerScoreSetupTool(server);
  registerGenerateOrgStandardsTool(server);
  registerResources(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'integration-test', version: '0.0.1' });

  await server.connect(serverTransport);
  await client.connect(clientTransport);
}

async function teardownServer(): Promise<void> {
  await client.close();
  await server.close();
}

describe('MCP Server Integration', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    const cacheMod = vi.mocked(await import('../../src/cache/catalog-cache.js'));
    cacheMod.getCached.mockReturnValue(null);
    cacheMod.setCache.mockImplementation(() => {});
    cacheMod.getCacheStatus.mockReturnValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('tool listing', () => {
    it('lists all registered tools', async () => {
      await setupServer();
      try {
        const { tools } = await client.listTools();
        const toolNames = tools.map((t) => t.name);

        expect(toolNames).toContain('search_copilot_assets');
        expect(toolNames).toContain('search_mcp_servers');
        expect(toolNames).toContain('analyze_project');
        expect(toolNames).toContain('get_asset_details');
        expect(toolNames).toContain('install_asset');
        expect(toolNames).toContain('generate_instructions');
        expect(toolNames).toContain('score_setup');
        expect(toolNames).toContain('generate_org_standards');
        expect(toolNames.length).toBe(8);
      } finally {
        await teardownServer();
      }
    });
  });

  describe('resource listing', () => {
    it('lists registered resources', async () => {
      await setupServer();
      try {
        const { resources } = await client.listResources();
        const resourceUris = resources.map((r) => r.uri);

        expect(resourceUris).toContain('discovery://trust-registry');
        expect(resourceUris).toContain('discovery://audit-log');
        expect(resourceUris).toContain('discovery://cache-status');
      } finally {
        await teardownServer();
      }
    });
  });

  describe('search_copilot_assets', () => {
    it('responds correctly with mocked fetch', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url.includes('README.instructions.md')) {
            return {
              ok: true,
              text: async () =>
                '| [Security Hardening](https://github.com/test/security) | Best security practices |',
            };
          }
          return { ok: true, text: async () => '' };
        }),
      );

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'search_copilot_assets',
          arguments: { query: 'security' },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Security Hardening');
        expect(text).toContain('security');
      } finally {
        await teardownServer();
      }
    });
  });

  describe('search_mcp_servers', () => {
    it('responds correctly with mocked registry', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => [
            { name: 'postgres-mcp', description: 'PostgreSQL integration' },
            { name: 'redis-mcp', description: 'Redis cache server' },
          ],
        })),
      );

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'search_mcp_servers',
          arguments: { query: 'postgres' },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('postgres-mcp');
        expect(text).not.toContain('redis-mcp');
      } finally {
        await teardownServer();
      }
    });

    it('returns no results message for unmatched query', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => [{ name: 'github-mcp', description: 'GitHub tools' }],
        })),
      );

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'search_mcp_servers',
          arguments: { query: 'nonexistent-xyz' },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('No MCP servers found');
      } finally {
        await teardownServer();
      }
    });
  });

  describe('analyze_project', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `mcp-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('detects languages and frameworks in a temp directory', async () => {
      // Create a Node.js project structure
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ dependencies: { react: '^18.0.0' } }),
      );
      writeFileSync(join(tempDir, 'index.ts'), 'console.log("hello");');
      writeFileSync(join(tempDir, 'app.tsx'), 'export default function App() {}');

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'analyze_project',
          arguments: { path: tempDir },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('TypeScript');
        expect(text).toContain('React');
      } finally {
        await teardownServer();
      }
    });

    it('reports error for nonexistent path', async () => {
      await setupServer();
      try {
        const result = await client.callTool({
          name: 'analyze_project',
          arguments: { path: join(tempDir, 'does-not-exist') },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Error');
      } finally {
        await teardownServer();
      }
    });

    it('detects copilot customizations', async () => {
      const ghDir = join(tempDir, '.github');
      mkdirSync(ghDir, { recursive: true });
      writeFileSync(join(ghDir, 'copilot-instructions.md'), '# Instructions');

      const instrDir = join(ghDir, 'instructions');
      mkdirSync(instrDir, { recursive: true });
      writeFileSync(join(instrDir, 'react.instructions.md'), '# React');

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'analyze_project',
          arguments: { path: tempDir },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('copilot-instructions.md');
        expect(text).toContain('react.instructions.md');
      } finally {
        await teardownServer();
      }
    });
  });

  describe('install_asset', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `mcp-install-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('requires confirmation (preview by default)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          text: async () => '---\ntitle: test\n---\n# Content',
        })),
      );

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'install_asset',
          arguments: {
            url: 'https://github.com/github/awesome-copilot/blob/main/instructions/react.instructions.md',
            target_project: tempDir,
            asset_type: 'instruction',
            confirm: false,
          },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('preview');
        expect(text).toContain('confirm: true');
      } finally {
        await teardownServer();
      }
    });

    it('rejects invalid URLs', async () => {
      await setupServer();
      try {
        const result = await client.callTool({
          name: 'install_asset',
          arguments: {
            url: 'not-a-url',
            target_project: tempDir,
            asset_type: 'instruction',
            confirm: false,
          },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Invalid URL');
      } finally {
        await teardownServer();
      }
    });

    it('blocks unknown sources without force', async () => {
      await setupServer();
      try {
        const result = await client.callTool({
          name: 'install_asset',
          arguments: {
            url: 'https://github.com/random-user/random-repo/blob/main/test.instructions.md',
            target_project: tempDir,
            asset_type: 'instruction',
            confirm: false,
          },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Blocked');
        expect(text).toContain('force: true');
      } finally {
        await teardownServer();
      }
    });

    it('shows dry run preview without fetching', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'install_asset',
          arguments: {
            url: 'https://github.com/github/awesome-copilot/blob/main/instructions/react.instructions.md',
            target_project: tempDir,
            asset_type: 'instruction',
            dry_run: true,
          },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Dry run');
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        await teardownServer();
      }
    });
  });

  describe('get_asset_details', () => {
    it('fetches and returns asset content with trust info', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          text: async () => '# React Best Practices\n\nUse functional components.',
        })),
      );

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'get_asset_details',
          arguments: {
            url: 'https://github.com/github/awesome-copilot/blob/main/instructions/react.instructions.md',
          },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('React Best Practices');
        expect(text).toContain('Trust');
      } finally {
        await teardownServer();
      }
    });

    it('rejects invalid URLs', async () => {
      await setupServer();
      try {
        const result = await client.callTool({
          name: 'get_asset_details',
          arguments: { url: 'ftp://invalid.com/file' },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('rejected');
      } finally {
        await teardownServer();
      }
    });
  });

  describe('generate_instructions', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `mcp-gen-instr-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('previews generated instructions without writing', async () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          type: 'module',
          dependencies: { express: '^4.0.0' },
          devDependencies: { typescript: '^5.0.0', vitest: '^4.0.0' },
        }),
      );
      mkdirSync(join(tempDir, 'src'), { recursive: true });
      writeFileSync(join(tempDir, 'src', 'app.ts'), 'const userName = "test";\nexport default userName;');

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'generate_instructions',
          arguments: { project_path: tempDir, confirm: false },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Preview');
        expect(text).toContain('Codebase Analysis');
        expect(text).toContain('confirm: true');
      } finally {
        await teardownServer();
      }
    });

    it('returns error for nonexistent path', async () => {
      await setupServer();
      try {
        const result = await client.callTool({
          name: 'generate_instructions',
          arguments: { project_path: join(tempDir, 'nope'), confirm: false },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Error');
      } finally {
        await teardownServer();
      }
    });
  });

  describe('score_setup', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `mcp-score-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('scores an empty project as low', async () => {
      writeFileSync(join(tempDir, 'package.json'), '{"name":"test"}');

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'score_setup',
          arguments: { project_path: tempDir },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Score');
        expect(text).toContain('0/');
        expect(text).toContain('Quick Wins');
      } finally {
        await teardownServer();
      }
    });

    it('scores a well-configured project higher', async () => {
      const ghDir = join(tempDir, '.github');
      mkdirSync(join(ghDir, 'instructions'), { recursive: true });
      mkdirSync(join(ghDir, 'prompts'), { recursive: true });
      mkdirSync(join(ghDir, 'agents'), { recursive: true });
      mkdirSync(join(ghDir, 'skills', 'commit'), { recursive: true });

      writeFileSync(
        join(ghDir, 'copilot-instructions.md'),
        '# Instructions\n\n## Naming conventions\ncamelCase\n\n## Error handling\ntry-catch\n\n## Testing\nVitest\n\n## Code style\nsemicolons\n' + 'x'.repeat(200),
      );
      writeFileSync(
        join(ghDir, 'instructions', 'security.instructions.md'),
        '---\ndescription: security\napplyTo: "**"\n---\n# Security governance rules',
      );
      writeFileSync(join(ghDir, 'prompts', 'review.prompt.md'), '---\nmode: agent\n---\n# Review');
      writeFileSync(join(ghDir, 'agents', 'helper.agent.md'), '---\nname: helper\n---\n# Helper');
      writeFileSync(join(ghDir, 'skills', 'commit', 'SKILL.md'), '---\nname: commit\n---\n# Conventional commits\nfeat: fix:');

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'score_setup',
          arguments: { project_path: tempDir },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Score');
        // Should contain a high score — the progress bar shows the percentage
        expect(text).toContain('100%');
      } finally {
        await teardownServer();
      }
    });
  });

  describe('generate_org_standards', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `mcp-org-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('previews org standards without writing', async () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({
          devDependencies: { typescript: '^5.0.0', vitest: '^4.0.0' },
        }),
      );

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'generate_org_standards',
          arguments: { project_path: tempDir, confirm: false },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Organization Standards');
        expect(text).toContain('naming-conventions');
        expect(text).toContain('security-governance');
        expect(text).toContain('confirm: true');
      } finally {
        await teardownServer();
      }
    });

    it('returns error for nonexistent path', async () => {
      await setupServer();
      try {
        const result = await client.callTool({
          name: 'generate_org_standards',
          arguments: { project_path: join(tempDir, 'nope'), confirm: false },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Error');
      } finally {
        await teardownServer();
      }
    });
  });
});
