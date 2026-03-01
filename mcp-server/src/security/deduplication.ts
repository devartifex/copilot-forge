export interface DeduplicatedResult {
  name: string;
  type: string;
  description: string;
  primarySource: string;
  primaryUrl: string;
  alsoFoundIn: { source: string; url: string }[];
  trustLevel: string;
  relevanceScore: number;
}

interface SearchResult {
  name: string;
  type: string;
  description: string;
  source: string;
  sourceUrl: string;
  relevanceScore: number;
  trustLevel?: string;
}

const STRIP_PREFIXES = ['awesome-'];
const STRIP_SUFFIXES = ['-copilot', '-skill', '-instruction', '-prompt'];

const TRUST_RANK: Record<string, number> = {
  verified: 2,
  community: 1,
  unknown: 0,
};

export function canonicalizeName(name: string): string {
  let canonical = name.toLowerCase();

  for (const prefix of STRIP_PREFIXES) {
    if (canonical.startsWith(prefix)) {
      canonical = canonical.slice(prefix.length);
    }
  }

  for (const suffix of STRIP_SUFFIXES) {
    if (canonical.endsWith(suffix)) {
      canonical = canonical.slice(0, -suffix.length);
    }
  }

  return canonical.replace(/[-_]/g, ' ').trim();
}

export function extractGitHubRepo(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const githubHosts = ['github.com', 'raw.githubusercontent.com', 'api.github.com'];
  if (!githubHosts.includes(parsed.hostname)) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);

  if (parsed.hostname === 'api.github.com' && segments[0] === 'repos' && segments.length >= 3) {
    return `${segments[1]}/${segments[2]}`.toLowerCase();
  }

  if (segments.length >= 2) {
    return `${segments[0]}/${segments[1]}`.toLowerCase();
  }

  return null;
}

function trustRank(level: string | undefined): number {
  return TRUST_RANK[level ?? 'unknown'] ?? 0;
}

export function deduplicateResults(results: SearchResult[]): DeduplicatedResult[] {
  // Build a union-find to group items by canonical name or shared org/repo
  const parent = new Map<number, number>();

  function find(i: number): number {
    let root = i;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    // Path compression
    let curr = i;
    while (curr !== root) {
      const next = parent.get(curr)!;
      parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (let i = 0; i < results.length; i++) {
    parent.set(i, i);
  }

  // Index by canonical name
  const nameIndex = new Map<string, number[]>();
  for (let i = 0; i < results.length; i++) {
    const key = canonicalizeName(results[i].name);
    const group = nameIndex.get(key);
    if (group) {
      group.push(i);
    } else {
      nameIndex.set(key, [i]);
    }
  }

  for (const indices of nameIndex.values()) {
    for (let j = 1; j < indices.length; j++) {
      union(indices[0], indices[j]);
    }
  }

  // Index by org/repo
  const repoIndex = new Map<string, number[]>();
  for (let i = 0; i < results.length; i++) {
    const repo = extractGitHubRepo(results[i].sourceUrl);
    if (repo) {
      const group = repoIndex.get(repo);
      if (group) {
        group.push(i);
      } else {
        repoIndex.set(repo, [i]);
      }
    }
  }

  for (const indices of repoIndex.values()) {
    for (let j = 1; j < indices.length; j++) {
      union(indices[0], indices[j]);
    }
  }

  // Collect groups
  const groups = new Map<number, number[]>();
  for (let i = 0; i < results.length; i++) {
    const root = find(i);
    const group = groups.get(root);
    if (group) {
      group.push(i);
    } else {
      groups.set(root, [i]);
    }
  }

  // Merge each group into a single DeduplicatedResult
  const deduplicated: DeduplicatedResult[] = [];

  for (const indices of groups.values()) {
    // Sort group members: highest trust first, then highest relevance
    indices.sort((a, b) => {
      const trustDiff = trustRank(results[b].trustLevel) - trustRank(results[a].trustLevel);
      if (trustDiff !== 0) return trustDiff;
      return results[b].relevanceScore - results[a].relevanceScore;
    });

    const primary = results[indices[0]];
    const alsoFoundIn: { source: string; url: string }[] = [];

    for (let i = 1; i < indices.length; i++) {
      const r = results[indices[i]];
      alsoFoundIn.push({ source: r.source, url: r.sourceUrl });
    }

    deduplicated.push({
      name: primary.name,
      type: primary.type,
      description: primary.description,
      primarySource: primary.source,
      primaryUrl: primary.sourceUrl,
      alsoFoundIn,
      trustLevel: primary.trustLevel ?? 'unknown',
      relevanceScore: primary.relevanceScore,
    });
  }

  // Sort final results: by relevance descending, then trust level descending
  deduplicated.sort((a, b) => {
    const scoreDiff = b.relevanceScore - a.relevanceScore;
    if (scoreDiff !== 0) return scoreDiff;
    return trustRank(b.trustLevel) - trustRank(a.trustLevel);
  });

  return deduplicated;
}
