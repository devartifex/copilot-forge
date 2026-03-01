export interface ProjectProfile {
  languages: LanguageInfo[];
  frameworks: string[];
  packageManagers: string[];
  cicd: string[];
  cloudProviders: string[];
  existingCustomizations: ExistingCustomizations;
}

export interface LanguageInfo {
  name: string;
  fileCount: number;
  primary: boolean;
}

export interface ExistingCustomizations {
  instructions: string[];
  prompts: string[];
  skills: string[];
  agents: string[];
  mcpServers: string[];
}

export interface DiscoveryResult {
  name: string;
  type: "instruction" | "prompt" | "skill" | "agent" | "mcp-server" | "collection";
  description: string;
  source: string;
  sourceUrl: string;
  relevanceScore: number;
  status: "not-installed" | "installed" | "outdated";
}

export interface McpServerResult {
  name: string;
  description: string;
  transport: string;
  sourceUrl: string;
  relevanceScore: number;
  installCommand: string;
  configSnippet: Record<string, unknown>;
}

export interface CatalogEntry {
  name: string;
  description: string;
  path: string;
  type: string;
}

export interface CachedCatalog {
  entries: CatalogEntry[];
  fetchedAt: number;
  ttlMs: number;
}
