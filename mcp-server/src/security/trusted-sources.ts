export type TrustLevel = 'verified' | 'community' | 'unknown';

export interface TrustInfo {
  level: TrustLevel;
  badge: string;
  reason: string;
  org?: string;
}

const TRUSTED_ORGS = new Map<string, TrustLevel>([
  ['github/awesome-copilot', 'verified'],
  ['anthropics/skills', 'verified'],
  ['modelcontextprotocol/servers', 'verified'],
  ['modelcontextprotocol/registry', 'verified'],
  ['microsoft/*', 'verified'],
]);

const COMMUNITY_STAR_THRESHOLD = 50;

export const ALLOWED_DOMAINS: readonly string[] = [
  'raw.githubusercontent.com',
  'github.com',
  'registry.modelcontextprotocol.io',
  'api.github.com',
];

const SSRF_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc00:/i,
  /^\[?fd[0-9a-f]{2}:/i,
];

function isInternalHost(hostname: string): boolean {
  if (hostname === 'localhost') return true;
  return SSRF_PATTERNS.some((pattern) => pattern.test(hostname));
}

export function validateUrl(url: string): { valid: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: `Disallowed protocol: ${parsed.protocol}` };
  }

  if (isInternalHost(parsed.hostname)) {
    return { valid: false, reason: 'Internal/private addresses are not allowed' };
  }

  if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
    return { valid: false, reason: `Domain not in allowlist: ${parsed.hostname}` };
  }

  return { valid: true };
}

function extractGitHubOrgRepo(url: string): { org: string; repo: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const githubHosts = ['github.com', 'raw.githubusercontent.com', 'api.github.com'];
  if (!githubHosts.includes(parsed.hostname)) return null;

  // Paths: /{org}/{repo}/... or /repos/{org}/{repo}/... (API)
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (parsed.hostname === 'api.github.com' && segments[0] === 'repos' && segments.length >= 3) {
    return { org: segments[1], repo: segments[2] };
  }
  if (segments.length >= 2) {
    return { org: segments[0], repo: segments[1] };
  }
  return null;
}

function lookupTrustLevel(org: string, repo: string): TrustLevel {
  const exact = TRUSTED_ORGS.get(`${org}/${repo}`);
  if (exact) return exact;

  const wildcard = TRUSTED_ORGS.get(`${org}/*`);
  if (wildcard) return wildcard;

  return 'unknown';
}

export function getTrustBadge(level: TrustLevel): string {
  switch (level) {
    case 'verified':
      return '✅';
    case 'community':
      return '⚠️';
    case 'unknown':
      return '❌';
  }
}

export function getTrustLevel(url: string): TrustInfo {
  const parsed = extractGitHubOrgRepo(url);
  if (!parsed) {
    return { level: 'unknown', badge: getTrustBadge('unknown'), reason: 'Not a recognized GitHub URL' };
  }

  const level = lookupTrustLevel(parsed.org, parsed.repo);
  return {
    level,
    badge: getTrustBadge(level),
    reason:
      level === 'verified'
        ? `Verified source: ${parsed.org}/${parsed.repo}`
        : level === 'community'
          ? `Community source with ≥${COMMUNITY_STAR_THRESHOLD} stars`
          : `Unrecognized source: ${parsed.org}/${parsed.repo}`,
    org: parsed.org,
  };
}

export function isVerifiedSource(url: string): boolean {
  return getTrustLevel(url).level === 'verified';
}

export function getTrustRegistry(): { pattern: string; level: TrustLevel }[] {
  return Array.from(TRUSTED_ORGS.entries()).map(([pattern, level]) => ({ pattern, level }));
}

export function addTrustedOrg(org: string, level: TrustLevel): void {
  TRUSTED_ORGS.set(org, level);
}
