import { mkdirSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";

export interface AuditEntry {
  timestamp: string;
  action: "preview" | "install" | "skip" | "blocked";
  sourceUrl: string;
  targetPath: string;
  trustLevel: string;
  contentHash: string;
  contentSize: number;
  assetType: string;
  success: boolean;
  error?: string;
}

const AUDIT_DIR = join(homedir(), ".copilot-skills-discovery");
const AUDIT_LOG_PATH = join(AUDIT_DIR, "audit.jsonl");

export function getAuditLogPath(): string {
  return AUDIT_LOG_PATH;
}

export function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function logAuditEntry(entry: AuditEntry): void {
  try {
    if (!existsSync(AUDIT_DIR)) {
      mkdirSync(AUDIT_DIR, { recursive: true });
    }
    appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Log failures must not crash the server
  }
}

export function getRecentAuditEntries(count: number = 50): AuditEntry[] {
  try {
    if (!existsSync(AUDIT_LOG_PATH)) {
      return [];
    }
    const lines = readFileSync(AUDIT_LOG_PATH, "utf-8")
      .split("\n")
      .filter((line) => line.trim() !== "");
    return lines.slice(-count).map((line) => JSON.parse(line) as AuditEntry);
  } catch {
    return [];
  }
}
