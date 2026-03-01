#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerSearchAwesomeCopilotTool } from "./tools/search-awesome-copilot.js";
import { registerSearchMcpRegistryTool } from "./tools/search-mcp-registry.js";
import { registerAnalyzeProjectTool } from "./tools/analyze-project.js";
import { registerGetDetailsTool } from "./tools/get-details.js";
import { registerInstallAssetTool } from "./tools/install-asset.js";
import { registerRecommendSkillsTool } from "./tools/recommend-skills.js";
import { registerAutopilotImproveTool } from "./tools/autopilot-improve.js";
import { registerGenerateInstructionsTool } from "./tools/generate-instructions.js";
import { registerScoreSetupTool } from "./tools/score-setup.js";
import { registerGenerateOrgStandardsTool } from "./tools/generate-org-standards.js";
import { registerResources } from "./resources.js";

const server = new McpServer({
  name: "copilot-skills-discovery",
  version: "1.0.0",
});

registerSearchAwesomeCopilotTool(server);
registerSearchMcpRegistryTool(server);
registerAnalyzeProjectTool(server);
registerGetDetailsTool(server);
registerInstallAssetTool(server);
registerRecommendSkillsTool(server);
registerAutopilotImproveTool(server);
registerGenerateInstructionsTool(server);
registerScoreSetupTool(server);
registerGenerateOrgStandardsTool(server);
registerResources(server);

const transport= new StdioServerTransport();
await server.connect(transport);

const shutdown = async () => {
  await server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
