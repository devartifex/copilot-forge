import { describe, it, expect } from "vitest";
import {
  CURATED_ASSETS,
  matchAssets,
  filterInstalled,
} from "../../src/data/asset-index.js";

describe("asset-index", () => {
  describe("CURATED_ASSETS", () => {
    it("contains assets", () => {
      expect(CURATED_ASSETS.length).toBeGreaterThan(0);
    });

    it("every asset has required fields", () => {
      for (const asset of CURATED_ASSETS) {
        expect(asset.name).toBeTruthy();
        expect(asset.type).toBeTruthy();
        expect(asset.description).toBeTruthy();
        expect(asset.source_url).toBeTruthy();
        expect(asset.tags.length).toBeGreaterThan(0);
        expect(["verified", "community"]).toContain(asset.quality_tier);
      }
    });

    it("has no duplicate names", () => {
      const names = CURATED_ASSETS.map((a) => a.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("all source URLs are valid URLs", () => {
      for (const asset of CURATED_ASSETS) {
        expect(() => new URL(asset.source_url)).not.toThrow();
      }
    });
  });

  describe("matchAssets", () => {
    it("returns TypeScript-related assets for TypeScript project", () => {
      const results = matchAssets(["TypeScript"], [], [], []);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((a) => a.name === "typescript-strict")).toBe(true);
    });

    it("returns Python-related assets for Python project", () => {
      const results = matchAssets(["Python"], [], [], []);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((a) => a.name === "python-best-practices")).toBe(true);
    });

    it("matches React framework", () => {
      const results = matchAssets(["TypeScript"], ["React"], [], []);
      expect(results.some((a) => a.name === "react-patterns")).toBe(true);
    });

    it("matches Django framework", () => {
      const results = matchAssets(["Python"], ["Django"], [], []);
      expect(results.some((a) => a.name === "django-patterns")).toBe(true);
    });

    it("matches Docker", () => {
      const results = matchAssets([], ["Docker"], [], []);
      expect(results.some((a) => a.name === "docker-best-practices")).toBe(true);
    });

    it("matches GitHub Actions CI/CD", () => {
      const results = matchAssets([], [], ["GitHub Actions"], []);
      expect(results.some((a) => a.name === "github-actions-patterns")).toBe(true);
    });

    it("matches cloud providers", () => {
      const results = matchAssets([], [], [], ["AWS"]);
      expect(results.some((a) => a.name === "terraform-patterns")).toBe(true);
    });

    it("returns empty for no matching tags", () => {
      const results = matchAssets([], [], [], []);
      expect(results).toEqual([]);
    });

    it("sorts by match count descending", () => {
      const results = matchAssets(["TypeScript", "JavaScript"], ["React", "Vitest"], [], []);
      const reactIdx = results.findIndex((a) => a.name === "react-patterns");
      const swiftIdx = results.findIndex((a) => a.name === "swift-best-practices");
      if (swiftIdx >= 0) {
        expect(reactIdx).toBeLessThan(swiftIdx);
      }
    });

    it("strips workflow count from CI/CD when matching", () => {
      const results = matchAssets([], [], ["GitHub Actions (2 workflow(s))"], []);
      expect(results.some((a) => a.name === "github-actions-patterns")).toBe(true);
    });
  });

  describe("filterInstalled", () => {
    it("removes already installed assets", () => {
      const assets = matchAssets(["TypeScript"], ["React"], [], []);
      const installed = new Set(["typescript-strict", "react-patterns"]);
      const filtered = filterInstalled(assets, installed);
      expect(filtered.some((a) => a.name === "typescript-strict")).toBe(false);
      expect(filtered.some((a) => a.name === "react-patterns")).toBe(false);
    });

    it("keeps assets not in installed set", () => {
      const assets = matchAssets(["TypeScript"], [], [], []);
      const filtered = filterInstalled(assets, new Set(["nonexistent"]));
      expect(filtered.length).toBe(assets.length);
    });

    it("returns empty when all are installed", () => {
      const assets = matchAssets(["Swift"], [], [], []);
      const allNames = new Set(assets.map((a) => a.name));
      const filtered = filterInstalled(assets, allNames);
      expect(filtered).toEqual([]);
    });
  });
});
