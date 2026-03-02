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
