export const SYSTEM_DESIGN_DEMO_PROJECT_TITLE = 'System Design Prep';
export const SYSTEM_DESIGN_DEMO_PROJECT_DESCRIPTION = 'Practice system design interview concepts with branchable AI tutor nodes.';
export const SYSTEM_DESIGN_DEMO_GRAPH_TITLE = 'Design a URL Shortener';
export const SYSTEM_DESIGN_DEMO_ROOT_TITLE = 'Design a URL Shortener';
export const SYSTEM_DESIGN_DEMO_PROMPT_TEMPLATE_VERSION = 'knowflow-tutor-v0';
export const SYSTEM_DESIGN_DEMO_CONTEXT_POLICY_VERSION = 'current-node-selected-ancestor-v0';

export const SYSTEM_DESIGN_DEMO_USER_PROMPT = 'Design a URL shortener like bit.ly for a system design interview.';

export const SYSTEM_DESIGN_DEMO_ASSISTANT_RESPONSE = `A good URL shortener design should cover API design, short-code generation, database schema, cache-aside strategy, redirect latency, rate limiting, and analytics.

API design: expose endpoints such as POST /urls to create a short link and GET /{code} to redirect users.

short-code generation: create compact unique codes with base62 encoding, random tokens with collision checks, or ID-based encoding.

database schema: store the short code, original URL, owner metadata, creation time, expiration time, and lookup indexes.

cache-aside strategy: keep hot short-code lookups in Redis or another cache. On a redirect, read from cache first, fall back to PostgreSQL, then populate the cache.

redirect latency: keep the redirect path extremely fast because it is the most frequent user-facing request.

rate limiting: protect URL creation and redirect abuse with per-IP or per-user limits.

analytics: collect click events, referrers, user agents, geography, and timestamps asynchronously so analytics does not slow down redirects.`;

export const SYSTEM_DESIGN_DEMO_BRANCHES = [
  {
    layout: { height: 220, width: 430, x: 900, y: 80 },
    selectedText: 'short-code generation',
    summary: 'Explore options for creating compact, unique short codes.',
    title: 'Branch: short-code generation',
  },
  {
    layout: { height: 220, width: 430, x: 1400, y: 80 },
    selectedText: 'database schema',
    summary: 'Model the tables and indexes needed for fast redirects.',
    title: 'Branch: database schema',
  },
  {
    layout: { height: 220, width: 430, x: 900, y: 360 },
    selectedText: 'cache-aside strategy',
    summary: 'Understand how cache-aside keeps hot redirects fast.',
    title: 'Branch: cache-aside strategy',
  },
  {
    layout: { height: 220, width: 430, x: 1400, y: 360 },
    selectedText: 'redirect latency',
    summary: 'Reason about latency on the most important read path.',
    title: 'Branch: redirect latency',
  },
  {
    layout: { height: 220, width: 430, x: 900, y: 640 },
    selectedText: 'rate limiting',
    summary: 'Protect creation and redirect endpoints from abuse.',
    title: 'Branch: rate limiting',
  },
  {
    layout: { height: 220, width: 430, x: 1400, y: 640 },
    selectedText: 'analytics',
    summary: 'Collect useful click data without slowing redirects.',
    title: 'Branch: analytics',
  },
] as const;
