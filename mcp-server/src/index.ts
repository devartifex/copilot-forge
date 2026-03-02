#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerAnalyzeProjectTool } from "./tools/analyze-project.js";
import { registerInstallAssetTool } from "./tools/install-asset.js";
import { registerGenerateInstructionsTool } from "./tools/generate-instructions.js";
import { registerScoreSetupTool } from "./tools/score-setup.js";
import { registerApplyOrgStandardsTool } from "./tools/apply-org-standards.js";
import { registerResources } from "./resources.js";

const server = new McpServer({
  name: "copilot-forge",
  version: "1.0.0",
});

registerAnalyzeProjectTool(server);
registerInstallAssetTool(server);
registerGenerateInstructionsTool(server);
registerScoreSetupTool(server);
registerApplyOrgStandardsTool(server);
registerResources(server);

const transport= new StdioServerTransport();
await server.connect(transport);

const shutdown = async () => {
  await server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
