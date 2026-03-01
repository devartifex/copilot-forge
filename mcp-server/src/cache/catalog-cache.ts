import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CatalogEntry, CachedCatalog } from "../types.js";

const CACHE_DIR = join(homedir(), ".copilot-skills-discovery", "cache");
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheFilePath(key: string): string {
  return join(CACHE_DIR, `${key}.json`);
}

export function getCached(key: string): CatalogEntry[] | null {
  const filePath = cacheFilePath(key);
  if (!existsSync(filePath)) return null;

  try {
    const data = JSON.parse(readFileSync(filePath, "utf-8")) as CachedCatalog;
    if (Date.now() - data.fetchedAt < data.ttlMs) {
      return data.entries;
    }
  } catch {
    // Corrupted cache, ignore
  }
  return null;
}

export function setCache(
  key: string,
  entries: CatalogEntry[],
  ttlMs: number = DEFAULT_TTL_MS
): void {
  ensureCacheDir();
  const data: CachedCatalog = { entries, fetchedAt: Date.now(), ttlMs };
  writeFileSync(cacheFilePath(key), JSON.stringify(data), "utf-8");
}

export interface CacheStatusEntry {
  key: string;
  fetchedAt: number;
  ttlMs: number;
  ageMs: number;
  fresh: boolean;
  entryCount: number;
}

export function getCacheStatus(): CacheStatusEntry[] {
  ensureCacheDir();
  const results: CacheStatusEntry[] = [];
  for (const file of readdirSync(CACHE_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const data = JSON.parse(readFileSync(join(CACHE_DIR, file), "utf-8")) as CachedCatalog;
      const ageMs = Date.now() - data.fetchedAt;
      results.push({
        key: file.replace(/\.json$/, ""),
        fetchedAt: data.fetchedAt,
        ttlMs: data.ttlMs,
        ageMs,
        fresh: ageMs < data.ttlMs,
        entryCount: data.entries.length,
      });
    } catch {
      // skip corrupted cache files
    }
  }
  return results;
}

export function clearCache(): void {
  ensureCacheDir();
  for (const file of readdirSync(CACHE_DIR)) {
    if (file.endsWith(".json")) {
      unlinkSync(join(CACHE_DIR, file));
    }
  }
}
