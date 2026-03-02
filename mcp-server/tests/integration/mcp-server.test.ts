import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { registerAnalyzeProjectTool } from '../../src/tools/analyze-project.js';
import { registerInstallAssetTool } from '../../src/tools/install-asset.js';
import { registerGenerateInstructionsTool } from '../../src/tools/generate-instructions.js';
import { registerScoreSetupTool } from '../../src/tools/score-setup.js';
import { registerApplyOrgStandardsTool } from '../../src/tools/apply-org-standards.js';
import { registerResources } from '../../src/resources.js';

// Mock audit log to avoid filesystem side effects
vi.mock('../../src/security/audit-log.js', () => ({
  logAuditEntry: vi.fn(),
  computeContentHash: vi.fn(() => 'abc123'),
  getRecentAuditEntries: vi.fn(() => []),
}));

let server: McpServer;
let client: Client;

async function setupServer(): Promise<void> {
  server = new McpServer({ name: 'copilot-forge', version: '1.0.0' });

  registerAnalyzeProjectTool(server);
  registerInstallAssetTool(server);
  registerGenerateInstructionsTool(server);
  registerScoreSetupTool(server);
  registerApplyOrgStandardsTool(server);
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
  beforeEach(() => {
    vi.resetAllMocks();
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

        expect(toolNames).toContain('analyze_project');
        expect(toolNames).toContain('install_asset');
        expect(toolNames).toContain('generate_instructions');
        expect(toolNames).toContain('score_setup');
        expect(toolNames).toContain('apply_org_standards');
        expect(toolNames.length).toBe(5);
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
        expect(resourceUris.length).toBe(2);
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
  });

  describe('apply_org_standards', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `mcp-org-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('previews generated standards without writing (fallback mode)', async () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({
          devDependencies: { typescript: '^5.0.0', vitest: '^4.0.0' },
        }),
      );

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'apply_org_standards',
          arguments: { project_path: tempDir, confirm: false },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Apply Organization Standards');
        expect(text).toContain('naming-conventions');
        expect(text).toContain('security-governance');
        expect(text).toContain('confirm: true');
      } finally {
        await teardownServer();
      }
    });

    it('applies standards from a local org source', async () => {
      const orgDir = join(tmpdir(), `mcp-org-source-${Date.now()}`);
      const orgInstrDir = join(orgDir, '.github', 'instructions');
      mkdirSync(orgInstrDir, { recursive: true });
      writeFileSync(
        join(orgInstrDir, 'org-naming.instructions.md'),
        "---\ndescription: 'Org naming rules'\napplyTo: '**'\n---\n# Naming\n\nUse camelCase.",
      );

      await setupServer();
      try {
        const result = await client.callTool({
          name: 'apply_org_standards',
          arguments: {
            project_path: tempDir,
            org_source: orgDir,
            confirm: false,
          },
        });
        const text = (result.content as { type: string; text: string }[])[0].text;
        expect(text).toContain('Applying from org source');
        expect(text).toContain('org-naming.instructions.md');
      } finally {
        await teardownServer();
        rmSync(orgDir, { recursive: true, force: true });
      }
    });

    it('returns error for nonexistent path', async () => {
      await setupServer();
      try {
        const result = await client.callTool({
          name: 'apply_org_standards',
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
