import { createHash } from 'node:crypto';

import type { GoalState } from '@nexus/goal-state';

import { MISSION_DASHBOARD_STYLES, renderMissionDashboard } from './dashboard.js';
import { createInitialHeroGoalState } from './dashboard-fixtures.js';

const GITHUB_REPOSITORY = 'https://github.com/4040apps/Nexus';
const GITHUB_ORGANIZATION = 'https://github.com/4040apps';
const READINESS_LAST_MODIFIED = '2026-09-02';
const HERO_SKILL_NAME = 'continue-procurement-mission';
const HERO_SKILL_PATH = `/.well-known/agent-skills/${HERO_SKILL_NAME}/SKILL.md` as const;

export const NEXUS_READINESS_ROUTES = [
  '/',
  '/developers',
  '/about',
  '/contact',
  '/privacy',
  '/index.md',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/.well-known/ard.json',
  '/.well-known/agent-skills/index.json',
  HERO_SKILL_PATH,
  '/og-image.svg',
] as const;

export type NexusReadinessRoute = (typeof NEXUS_READINESS_ROUTES)[number];

export type NexusReadinessConfig = {
  canonicalOrigin: string;
  goalState?: GoalState;
  officeProRuntime?: { providerOrigin: string };
};

type OrganizationStructuredData = {
  '@type': 'Organization';
  '@id': string;
  name: '4040apps';
  url: string;
  sameAs: readonly string[];
};

type WebSiteStructuredData = {
  '@type': 'WebSite';
  '@id': string;
  name: 'NEXUS';
  url: string;
  inLanguage: 'en';
  publisher: { '@id': string };
};

type SoftwareApplicationStructuredData = {
  '@type': 'SoftwareApplication';
  '@id': string;
  name: 'NEXUS';
  url: string;
  description: string;
  applicationCategory: 'BusinessApplication';
  operatingSystem: 'Web';
  inLanguage: 'en';
  isAccessibleForFree: true;
  sameAs: readonly string[];
  provider: { '@id': string };
  featureList: readonly string[];
};

export type NexusStructuredData = {
  '@context': 'https://schema.org';
  '@graph': readonly [OrganizationStructuredData, WebSiteStructuredData, SoftwareApplicationStructuredData];
};

export type NexusReadinessSurfaces = {
  canonicalOrigin: string;
  routes: typeof NEXUS_READINESS_ROUTES;
  html: string;
  developersHtml: string;
  aboutHtml: string;
  contactHtml: string;
  privacyHtml: string;
  indexMarkdown: string;
  robotsTxt: string;
  sitemapXml: string;
  llmsTxt: string;
  ardJson: string;
  agentSkillsIndexJson: string;
  heroSkillMarkdown: string;
  ogImageSvg: string;
  notFoundHtml: string;
  structuredData: NexusStructuredData;
};

export type NexusReadinessResponse = {
  status: 200 | 404;
  headers: Readonly<Record<string, string>>;
  body: string;
};

export type NexusReadinessValidation = {
  valid: boolean;
  checkedRoutes: readonly NexusReadinessRoute[];
  errors: readonly string[];
};

const CONTENT_TYPES: Readonly<Record<NexusReadinessRoute, string>> = {
  '/': 'text/html; charset=utf-8',
  '/developers': 'text/html; charset=utf-8',
  '/about': 'text/html; charset=utf-8',
  '/contact': 'text/html; charset=utf-8',
  '/privacy': 'text/html; charset=utf-8',
  '/index.md': 'text/markdown; charset=utf-8',
  '/robots.txt': 'text/plain; charset=utf-8',
  '/sitemap.xml': 'application/xml; charset=utf-8',
  '/llms.txt': 'text/plain; charset=utf-8',
  '/.well-known/ard.json': 'application/json; charset=utf-8',
  '/.well-known/agent-skills/index.json': 'application/json; charset=utf-8',
  [HERO_SKILL_PATH]: 'text/markdown; charset=utf-8',
  '/og-image.svg': 'image/svg+xml; charset=utf-8',
};

const CONTENT_PAGE_STYLES = `
  .sandbox-notice { margin: 0 0 1.25rem; padding: .85rem 1rem; border: 1px solid #516d40; border-radius: .8rem; background: rgba(44, 68, 28, .42); color: #e9ffd0; }
  .content-page { width: min(100%, 54rem); padding-block: clamp(1rem, 4vw, 3rem); }
  .content-page h1 { font-size: clamp(2.2rem, 7vw, 4.5rem); line-height: .98; letter-spacing: -.045em; }
  .content-page h2 { margin-top: 2.25rem; }
  .content-page p, .content-page li { color: var(--muted); line-height: 1.7; }
  .content-page strong { color: var(--text); }
  .content-page code { padding: .12rem .35rem; border-radius: .25rem; background: var(--surface-raised); color: #e8f8ff; }
  .content-page .lead { color: var(--text); font-size: 1.18rem; }
  .content-page .actions { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 2rem; }
`;

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function normalizeCanonicalOrigin(candidate: string): string {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new TypeError('canonicalOrigin must be an absolute URL.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError('canonicalOrigin cannot contain credentials, a query, or a fragment.');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new TypeError('canonicalOrigin must not contain a path.');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalHostname(url.hostname))) {
    throw new TypeError('canonicalOrigin must use HTTPS, except for localhost development.');
  }
  return url.origin;
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function renderRobotsTxt(origin: string): string {
  return `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\nAgentmap: ${origin}/.well-known/ard.json\n`;
}

function renderSitemapXml(origin: string): string {
  const indexedPaths = ['/', '/developers', '/about', '/contact', '/privacy', '/index.md'];
  const urls = indexedPaths.map((path) => `  <url>\n    <loc>${escapeXml(`${origin}${path}`)}</loc>\n    <lastmod>${READINESS_LAST_MODIFIED}</lastmod>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function renderLlmsTxt(origin: string): string {
  return `# NEXUS

> NEXUS is a deterministic public hackathon sandbox that preserves a human's remaining intent across independent, agent-ready providers.

## When to use NEXUS

- Use NEXUS to demonstrate continuity after a deliberately chosen provider fulfills only part of an office-opening mission.
- Use it to inspect auditable Goal State progress, a provider deadline failure, a scoped reroute, and a proposal-bound human approval.
- Do not use this proof of concept for real procurement, real payments, or production commitments.
- Start at OfficePro for the canonical hero flow; Broker Mode starts only after the user explicitly authorizes the remaining-intent handoff.

## Product model

- Brand Mode keeps work within the provider the user deliberately chose.
- Broker Mode starts only after an explicitly authorized Intent Handoff is executed for the remaining requirements.
- Provider failures and reroutes stay visible in the Goal State activity timeline.
- Purchases, reservations, signatures, and other commitment operations require explicit human approval.

## WebMCP architecture

- Independent providers register genuine browser tools with document.modelContext.
- The authorized consumer invokes those tools on the provider origin; NEXUS does not proxy provider-owned catalog, pricing, stock, availability, or constraints.
- Tool exposure follows the validated fromOrigins, exposedTo, and iframe allow="tools" browser permission model documented by this repository.
- Chrome 151+ must be launched with WebMCP explicitly enabled for the controlled demo environment; WebMCP is not claimed to be enabled by default.
- TechSupply fulfills computers through provider-owned read and planning tools. FiberMX returns a deadline failure, and NEXUS reroutes only internet to NetBusiness.
- SecureNow plans autonomously, but its commitment-class request_installation tool runs only after a proposal-bound human approval is recorded.

## Documentation

- [Canonical Markdown overview](${origin}/index.md)
- [Developer guide](${origin}/developers)
- [About the public sandbox](${origin}/about)
- [Privacy](${origin}/privacy)
- [NEXUS source repository](${GITHUB_REPOSITORY})
- [Agent operating contract](${GITHUB_REPOSITORY}/blob/main/AGENTS.md)
- [Architecture documentation](${GITHUB_REPOSITORY}/blob/main/docs/architecture.md)
- [WebMCP validation documentation](${GITHUB_REPOSITORY}/blob/main/docs/webmcp.md)

## Machine-readable discovery

- [ARD manifest](${origin}/.well-known/ard.json)
- [Agent Skills index](${origin}/.well-known/agent-skills/index.json)
- [robots.txt](${origin}/robots.txt)
- [sitemap.xml](${origin}/sitemap.xml)
`;
}

function renderIndexMarkdown(origin: string): string {
  return `# NEXUS

NEXUS is a WebMCP-first, deterministic public hackathon sandbox for continuing a human's remaining intent across independent providers.

## Canonical mission

Open an office for 20 people in Guadalajara before 2026-10-01 within MXN 500,000. OfficePro fulfills desks and chairs; after explicit handoff, TechSupply fulfills computers, FiberMX reports a deadline conflict, NetBusiness supplies the valid internet reroute, and SecureNow pauses before commitment until a human approves.

## Safety and architecture

- Each provider owns its catalog, pricing, stock, availability, constraints, validation, and tool execution.
- Providers expose genuine WebMCP tools through \`document.modelContext\` on independent origins.
- NEXUS is not a REST proxy for provider business data.
- Agent clients are untrusted, Brand Mode never silently compares competitors, and Broker Mode requires an explicit handoff.
- Commitment operations require a proposal-bound human approval.
- The demo uses deterministic synthetic data. It is not a production procurement or payment system.

## Use the demo

Open [the NEXUS mission dashboard](${origin}/) and follow its visible controls and activity timeline. The controlled WebMCP runtime requirements are documented in the [developer guide](${origin}/developers).

## Maintained resources

- [AI-readable overview](${origin}/llms.txt)
- [Developer guide](${origin}/developers)
- [Agent Skills index](${origin}/.well-known/agent-skills/index.json)
- [ARD manifest](${origin}/.well-known/ard.json)
- [Public source](${GITHUB_REPOSITORY})
- [AGENTS.md operating contract](${GITHUB_REPOSITORY}/blob/main/AGENTS.md)
`;
}

function renderHeroSkill(origin: string): string {
  return `---
name: ${HERO_SKILL_NAME}
description: Demonstrate NEXUS intent continuity by completing its deterministic office-opening hero flow while preserving provider independence and explicit human approval.
---

# Continue a NEXUS procurement mission

Use this skill only for the public NEXUS hackathon sandbox at ${origin}. It demonstrates a synthetic mission; it does not place real orders, spend money, or create production commitments.

## Preconditions

1. Tell the user this is a deterministic public demo.
2. Open ${origin}/ and start with the deliberately selected OfficePro provider.
3. For genuine cross-origin WebMCP, use Chrome 151+ launched with \`--enable-features=WebMCP\`. The normal websites remain usable when WebMCP is unavailable.

## Procedure

1. Let OfficePro fulfill only desks and chairs in Brand Mode.
2. Ask the human before executing the Intent Handoff for computers, internet, and security. Do not enter Broker Mode without that authorization.
3. Continue computers with TechSupply through its provider-owned WebMCP logic.
4. Preserve FiberMX's installation-date failure as \`BLOCKED\`; reroute only internet to NetBusiness.
5. Stop when SecureNow reaches \`REQUIRES_HUMAN\`. Explain the exact proposal and consequence.
6. Invoke the commitment-class installation action only after the human explicitly approves that proposal.
7. Confirm the mission reaches 100%, MXN 410,000 used, MXN 90,000 remaining, with the failure, reroute, and approval still visible in the timeline.

## Guardrails

- Do not infer handoff or commitment approval from earlier navigation or conversation.
- Do not move provider catalog, pricing, stock, availability, or constraints into NEXUS.
- Do not describe website fallback transport as WebMCP.
- If WebMCP is unavailable, disclose that limitation; the normal website may still demonstrate the UI flow.
- Do not treat synthetic demo outcomes as real supplier quotes or availability.

See ${origin}/developers and ${GITHUB_REPOSITORY}/blob/main/AGENTS.md for the maintained architecture and operating contract.
`;
}

function renderArdJson(origin: string): string {
  const hostname = new URL(origin).hostname;
  const publisher = isLocalHostname(hostname) ? 'nexus.localhost' : hostname;
  return `${JSON.stringify({
    entries: [
      {
        '@context': 'https://agenticresourcediscovery.org/context/v1',
        identifier: `urn:air:${publisher}:documentation:nexus`,
        displayName: 'NEXUS canonical documentation',
        type: 'text/markdown',
        url: `${origin}/index.md`,
        description: 'Maintained architecture, safety boundaries, and usage guidance for the NEXUS public hackathon sandbox.',
        capabilities: ['GoalState', 'IntentHandoff', 'ProviderReroute', 'HumanApproval'],
        representativeQueries: ['How does NEXUS continue a partially fulfilled procurement mission?', 'How does NEXUS preserve provider failures and require human approval?'],
      },
      {
        '@context': 'https://agenticresourcediscovery.org/context/v1',
        identifier: `urn:air:${publisher}:skill:${HERO_SKILL_NAME}`,
        displayName: 'Continue a NEXUS procurement mission',
        type: 'application/ai-skill+md',
        url: `${origin}${HERO_SKILL_PATH}`,
        description: 'Instructions for running the real deterministic NEXUS hero flow without weakening handoff or commitment approval boundaries.',
        capabilities: ['GoalState', 'IntentHandoff', 'WebMCP', 'ProviderReroute', 'HumanApproval'],
        representativeQueries: ['Demonstrate the NEXUS office-opening hero flow.', 'Continue the remaining office requirements through independent WebMCP providers.'],
      },
    ],
  }, null, 2)}\n`;
}

function renderAgentSkillsIndex(origin: string, heroSkillMarkdown: string): string {
  const digest = createHash('sha256').update(heroSkillMarkdown).digest('hex');
  return `${JSON.stringify({
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [{
      name: HERO_SKILL_NAME,
      type: 'skill-md',
      description: 'Demonstrate NEXUS intent continuity by completing its deterministic office-opening hero flow while preserving provider independence and explicit human approval.',
      url: `${origin}${HERO_SKILL_PATH}`,
      digest: `sha256:${digest}`,
    }],
  }, null, 2)}\n`;
}

function createStructuredData(origin: string): NexusStructuredData {
  const organizationId = `${origin}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': organizationId, name: '4040apps', url: GITHUB_ORGANIZATION, sameAs: [GITHUB_ORGANIZATION] },
      { '@type': 'WebSite', '@id': `${origin}/#website`, name: 'NEXUS', url: `${origin}/`, inLanguage: 'en', publisher: { '@id': organizationId } },
      {
        '@type': 'SoftwareApplication',
        '@id': `${origin}/#application`,
        name: 'NEXUS',
        url: `${origin}/`,
        description: 'A deterministic WebMCP-first proof of concept that continues remaining intent across independent providers with visible rerouting and human approval.',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        inLanguage: 'en',
        isAccessibleForFree: true,
        sameAs: [GITHUB_REPOSITORY],
        provider: { '@id': organizationId },
        featureList: ['Goal State mission progress', 'Explicit Intent Handoff', 'Visible provider failure and rerouting', 'Human approval before commitments'],
      },
    ],
  };
}

function navigation(): string {
  return `<nav aria-label="Primary navigation"><ul><li><a href="/">Mission</a></li><li><a href="/developers">Developers</a></li><li><a href="/about">About</a></li><li><a href="/llms.txt">AI overview</a></li></ul></nav>`;
}

function renderHead(origin: string, path: string, title: string, description: string, structuredData: NexusStructuredData): string {
  const canonicalUrl = `${origin}${path}`;
  const structuredDataJson = JSON.stringify(structuredData).replaceAll('<', '\\u003c');
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_US">
  <meta property="og:site_name" content="NEXUS">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${origin}/og-image.svg">
  <meta property="og:image:type" content="image/svg+xml">
  <meta property="og:image:alt" content="NEXUS — intent continuity across providers">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="alternate" type="text/markdown" href="${origin}/index.md" title="NEXUS Markdown overview">
  <link rel="ard" type="application/json" href="${origin}/.well-known/ard.json">
  <link rel="agent-skills" type="application/json" href="${origin}/.well-known/agent-skills/index.json">
  <title>${title}</title>
  <script type="application/ld+json">${structuredDataJson}</script>
  <style>${MISSION_DASHBOARD_STYLES}${CONTENT_PAGE_STYLES}</style>`;
}

function renderFooter(): string {
  return `<footer><div class="site-footer">Deterministic public hackathon sandbox. <a href="${GITHUB_REPOSITORY}">Source</a> · <a href="${GITHUB_REPOSITORY}/blob/main/AGENTS.md">AGENTS.md</a> · <a href="/contact">Contact</a> · <a href="/privacy">Privacy</a></div></footer>`;
}

function renderHtml(origin: string, structuredData: NexusStructuredData, goalState: GoalState, officeProRuntime?: { providerOrigin: string }): string {
  const description = 'NEXUS continues remaining intent across independent WebMCP providers with visible recovery and human approval.';
  return `<!doctype html>
<html lang="en">
<head>${renderHead(origin, '/', 'NEXUS — Intent continuity across providers', description, structuredData)}</head>
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header><div class="site-header"><div class="brand"><span class="brand-mark" aria-hidden="true">N</span><span>NEXUS</span></div>${navigation()}</div></header>
  <main id="main-content" tabindex="-1">
    <aside class="sandbox-notice" aria-label="Demo environment"><strong>Public hackathon sandbox.</strong> All provider data and outcomes are deterministic and synthetic; this site does not perform real procurement or payments.</aside>
    ${renderMissionDashboard(goalState, officeProRuntime ? { providerOrigin: officeProRuntime.providerOrigin, phase: 'READY', message: 'Waiting for the independent OfficePro origin to report its WebMCP capability.' } : undefined, undefined, undefined, undefined, officeProRuntime !== undefined)}
  </main>
  ${renderFooter()}
  ${officeProRuntime ? '<script type="module" src="/officepro-runtime-client.js"></script>' : ''}
</body>
</html>
`;
}

function renderContentPage(origin: string, structuredData: NexusStructuredData, path: string, title: string, description: string, content: string): string {
  return `<!doctype html>
<html lang="en">
<head>${renderHead(origin, path, `${title} — NEXUS`, description, structuredData)}</head>
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header><div class="site-header"><div class="brand"><span class="brand-mark" aria-hidden="true">N</span><span>NEXUS</span></div>${navigation()}</div></header>
  <main id="main-content" tabindex="-1"><article class="content-page">${content}</article></main>
  ${renderFooter()}
</body>
</html>
`;
}

function renderDevelopersHtml(origin: string, structuredData: NexusStructuredData): string {
  return renderContentPage(origin, structuredData, '/developers', 'Developer guide', 'How the NEXUS WebMCP hero demo preserves independent provider logic, explicit handoff, and human approval.', `<h1>Developer guide</h1>
<p class="lead">NEXUS is a browser-based WebMCP proof of concept, not a public HTTP API.</p>
<h2>Architecture</h2>
<p>The consumer mission dashboard runs at <code>${origin}</code>. OfficePro, TechSupply, FiberMX, NetBusiness, and SecureNow run on independent origins. Each provider registers genuine tools with <code>document.modelContext</code>; provider-owned catalog, pricing, stock, availability, constraints, and validation remain on that provider origin.</p>
<p>NEXUS preserves only Goal State and the minimum remaining-intent handoff. It does not proxy provider business logic through invented REST endpoints.</p>
<h2>Permission and approval boundaries</h2>
<p>The controlled cross-origin path was validated with Chrome 151+ launched using <code>--enable-features=WebMCP</code>. Provider <code>fromOrigins</code>, tool <code>exposedTo</code>, and iframe <code>allow="tools"</code> restrict exposure to the authorized NEXUS origin. Chrome 151 is not claimed to enable WebMCP by default.</p>
<p>Read and planning operations may run autonomously after an explicit Intent Handoff. Purchases, reservations, signing, quote acceptance, and installation commitments require a separate, proposal-bound human approval.</p>
<h2>Local and production usage</h2>
<p>From the public repository, install with <code>pnpm install --frozen-lockfile</code>, run the six-origin local hero with <code>pnpm demo:hero</code>, and build the production static assets with <code>pnpm build:production</code>. Exact deployment and WebMCP reproduction steps remain versioned with the source.</p>
<h2>Maintained references</h2>
<ul><li><a href="${GITHUB_REPOSITORY}">Public GitHub repository</a></li><li><a href="${GITHUB_REPOSITORY}/blob/main/AGENTS.md">AGENTS.md operating contract</a></li><li><a href="${GITHUB_REPOSITORY}/blob/main/docs/architecture.md">Architecture</a></li><li><a href="${GITHUB_REPOSITORY}/blob/main/docs/webmcp.md">WebMCP validation</a></li><li><a href="${GITHUB_REPOSITORY}/blob/main/docs/deployment.md">Deployment</a></li></ul>`);
}

function renderAboutHtml(origin: string, structuredData: NexusStructuredData): string {
  return renderContentPage(origin, structuredData, '/about', 'About', 'About the NEXUS deterministic public hackathon sandbox and its intent-continuity mission.', `<h1>About NEXUS</h1>
<p class="lead"><strong>Websites end. Human intentions don't.</strong></p>
<p>NEXUS demonstrates fulfillment, explicit Intent Handoff, recovery and rerouting, human approval, and Goal Complete across independent agent-ready providers.</p>
<p>The canonical mission opens an office for 20 people in Guadalajara before 2026-10-01 with a MXN 500,000 budget. Its data and outcomes are deterministic and synthetic so the three-minute hackathon narrative remains reproducible.</p>
<h2>What this is not</h2>
<p>This public sandbox is not a real marketplace, procurement service, payment processor, supplier registry, or production integration. It intentionally publishes no REST API, OAuth service, MCP server, pricing program, SDK, or CLI.</p>
<p class="actions"><a href="/">Open the mission</a><a href="${GITHUB_REPOSITORY}">Inspect the source</a></p>`);
}

function renderContactHtml(origin: string, structuredData: NexusStructuredData): string {
  return renderContentPage(origin, structuredData, '/contact', 'Contact', 'How to report NEXUS demo defects and discuss the public proof of concept.', `<h1>Contact</h1>
<p class="lead">NEXUS is maintained publicly by 4040apps.</p>
<p>Report reproducible defects, accessibility problems, or documentation errors through the repository's public issue tracker. Do not submit secrets, personal information, real supplier data, or real procurement requests.</p>
<p class="actions"><a href="${GITHUB_REPOSITORY}/issues">Open GitHub Issues</a><a href="${GITHUB_REPOSITORY}">View repository</a></p>`);
}

function renderPrivacyHtml(origin: string, structuredData: NexusStructuredData): string {
  return renderContentPage(origin, structuredData, '/privacy', 'Privacy', 'Privacy boundaries for the deterministic NEXUS public hackathon sandbox.', `<h1>Privacy</h1>
<p class="lead">Use synthetic information only.</p>
<p>The NEXUS demo does not provide accounts, authentication, payments, or a production data store. Its mission state and provider outcomes are deterministic browser-demo data, and the application does not intentionally collect or sell personal information.</p>
<p>The hosting provider may process standard request metadata under its own policies. Do not enter personal information, credentials, secrets, real payment details, supplier-confidential data, or real procurement instructions into this public sandbox.</p>
<p>For a repository-level concern, use <a href="${GITHUB_REPOSITORY}/issues">GitHub Issues</a>.</p>`);
}

function renderNotFoundHtml(origin: string, structuredData: NexusStructuredData): string {
  return renderContentPage(origin, structuredData, '/404', 'Not found', 'The requested NEXUS resource was not found.', `<h1>Resource not found</h1><p>The requested path is not part of the maintained NEXUS public sandbox.</p><ul><li><a href="/sitemap.xml">Sitemap</a></li><li><a href="/llms.txt">AI-readable overview</a></li><li><a href="/developers">Developer guide</a></li></ul>`);
}

function renderOgImageSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">NEXUS</title><desc id="desc">Intent continuity across independent providers</desc><rect width="1200" height="630" fill="#07101d"/><circle cx="1020" cy="60" r="330" fill="#1c4166" opacity=".55"/><rect x="86" y="84" width="86" height="86" rx="22" fill="#122137" stroke="#b8f24b" stroke-width="3"/><text x="129" y="146" text-anchor="middle" fill="#b8f24b" font-family="Arial, sans-serif" font-size="54" font-weight="800">N</text><text x="86" y="320" fill="#f4f7fb" font-family="Arial, sans-serif" font-size="118" font-weight="800" letter-spacing="8">NEXUS</text><text x="92" y="405" fill="#cae8ff" font-family="Arial, sans-serif" font-size="42">Intent continuity across providers</text><text x="92" y="500" fill="#a8b6ca" font-family="Arial, sans-serif" font-size="28">WebMCP · visible rerouting · human approval</text>
</svg>
`;
}

export function createNexusReadinessSurfaces(config: NexusReadinessConfig): NexusReadinessSurfaces {
  const canonicalOrigin = normalizeCanonicalOrigin(config.canonicalOrigin);
  const structuredData = createStructuredData(canonicalOrigin);
  const goalState = config.goalState ?? createInitialHeroGoalState();
  const officeProRuntime = config.officeProRuntime ? { providerOrigin: normalizeCanonicalOrigin(config.officeProRuntime.providerOrigin) } : undefined;
  const heroSkillMarkdown = renderHeroSkill(canonicalOrigin);
  return {
    canonicalOrigin,
    routes: NEXUS_READINESS_ROUTES,
    html: renderHtml(canonicalOrigin, structuredData, goalState, officeProRuntime),
    developersHtml: renderDevelopersHtml(canonicalOrigin, structuredData),
    aboutHtml: renderAboutHtml(canonicalOrigin, structuredData),
    contactHtml: renderContactHtml(canonicalOrigin, structuredData),
    privacyHtml: renderPrivacyHtml(canonicalOrigin, structuredData),
    indexMarkdown: renderIndexMarkdown(canonicalOrigin),
    robotsTxt: renderRobotsTxt(canonicalOrigin),
    sitemapXml: renderSitemapXml(canonicalOrigin),
    llmsTxt: renderLlmsTxt(canonicalOrigin),
    ardJson: renderArdJson(canonicalOrigin),
    agentSkillsIndexJson: renderAgentSkillsIndex(canonicalOrigin, heroSkillMarkdown),
    heroSkillMarkdown,
    ogImageSvg: renderOgImageSvg(),
    notFoundHtml: renderNotFoundHtml(canonicalOrigin, structuredData),
    structuredData,
  };
}

function alternateLinkHeader(origin: string): string {
  return `<${origin}/index.md>; rel="alternate"; type="text/markdown", <${origin}/.well-known/ard.json>; rel="ard"; type="application/json", <${origin}/.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"`;
}

function responseForRoute(route: NexusReadinessRoute, surfaces: NexusReadinessSurfaces): NexusReadinessResponse {
  const bodies: Readonly<Record<NexusReadinessRoute, string>> = {
    '/': surfaces.html,
    '/developers': surfaces.developersHtml,
    '/about': surfaces.aboutHtml,
    '/contact': surfaces.contactHtml,
    '/privacy': surfaces.privacyHtml,
    '/index.md': surfaces.indexMarkdown,
    '/robots.txt': surfaces.robotsTxt,
    '/sitemap.xml': surfaces.sitemapXml,
    '/llms.txt': surfaces.llmsTxt,
    '/.well-known/ard.json': surfaces.ardJson,
    '/.well-known/agent-skills/index.json': surfaces.agentSkillsIndexJson,
    [HERO_SKILL_PATH]: surfaces.heroSkillMarkdown,
    '/og-image.svg': surfaces.ogImageSvg,
  };
  const headers: Record<string, string> = { 'content-type': CONTENT_TYPES[route], link: alternateLinkHeader(surfaces.canonicalOrigin), 'x-content-type-options': 'nosniff' };
  if (route.startsWith('/.well-known/')) headers['access-control-allow-origin'] = '*';
  return { status: 200, headers, body: bodies[route] };
}

export function getNexusReadinessResponse(pathname: string, surfaces: NexusReadinessSurfaces): NexusReadinessResponse {
  if ((NEXUS_READINESS_ROUTES as readonly string[]).includes(pathname)) return responseForRoute(pathname as NexusReadinessRoute, surfaces);
  return { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', link: alternateLinkHeader(surfaces.canonicalOrigin), 'x-content-type-options': 'nosniff' }, body: surfaces.notFoundHtml };
}

function linkedUrls(markdown: string): string[] {
  return [...markdown.matchAll(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g)].map((match) => match[1] ?? '');
}

function isMaintainedExternalDocumentation(url: URL): boolean {
  return url.origin === 'https://github.com' && url.pathname.startsWith('/4040apps/Nexus');
}

export function validateNexusReadinessSurfaces(surfaces: NexusReadinessSurfaces): NexusReadinessValidation {
  const errors: string[] = [];
  const expectedOrigin = normalizeCanonicalOrigin(surfaces.canonicalOrigin);
  for (const route of NEXUS_READINESS_ROUTES) {
    const response = getNexusReadinessResponse(route, surfaces);
    if (response.status !== 200 || response.body.trim().length === 0) errors.push(`${route} must resolve to a non-empty 200 response.`);
  }
  if (!surfaces.robotsTxt.includes(`Sitemap: ${expectedOrigin}/sitemap.xml`) || !surfaces.robotsTxt.includes(`Agentmap: ${expectedOrigin}/.well-known/ard.json`)) errors.push('robots.txt must reference the canonical sitemap and ARD manifest.');
  if (!surfaces.robotsTxt.startsWith('User-agent: *\nAllow: /\n')) errors.push('robots.txt must contain a valid public crawler policy.');
  if (!surfaces.sitemapXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>') || !surfaces.sitemapXml.includes(`<loc>${escapeXml(`${expectedOrigin}/`)}</loc>`) || !surfaces.sitemapXml.includes(`<lastmod>${READINESS_LAST_MODIFIED}</lastmod>`)) errors.push('sitemap.xml must include canonical maintained pages with last-modified dates.');

  for (const linkedUrl of [...linkedUrls(surfaces.llmsTxt), ...linkedUrls(surfaces.indexMarkdown)]) {
    const url = new URL(linkedUrl);
    const internalAvailable = url.origin === expectedOrigin && getNexusReadinessResponse(url.pathname, surfaces).status === 200;
    if (!internalAvailable && !isMaintainedExternalDocumentation(url)) errors.push(`readiness Markdown references an unavailable resource: ${linkedUrl}`);
  }

  const application = surfaces.structuredData['@graph'].find((node) => node['@type'] === 'SoftwareApplication');
  const organization = surfaces.structuredData['@graph'].find((node) => node['@type'] === 'Organization');
  if (application?.url !== `${expectedOrigin}/` || !application.sameAs.includes(GITHUB_REPOSITORY) || organization?.url !== GITHUB_ORGANIZATION) errors.push('Schema.org data must identify the canonical NEXUS application and real 4040apps sources.');

  try {
    const ard = JSON.parse(surfaces.ardJson) as { entries?: Array<Record<string, unknown>> };
    if (!Array.isArray(ard.entries) || ard.entries.length === 0 || ard.entries.some((entry) => typeof entry.identifier !== 'string' || typeof entry.displayName !== 'string' || typeof entry.type !== 'string' || typeof entry.url !== 'string' || 'data' in entry || !Array.isArray(entry.representativeQueries) || entry.representativeQueries.length < 2 || entry.representativeQueries.length > 5)) errors.push('ARD must contain only complete, reference-based, discoverable resources.');
  } catch {
    errors.push('ARD manifest must be valid JSON.');
  }

  try {
    const index = JSON.parse(surfaces.agentSkillsIndexJson) as { $schema?: string; skills?: Array<{ name?: string; type?: string; url?: string; digest?: string }> };
    const skill = index.skills?.[0];
    const digest = `sha256:${createHash('sha256').update(surfaces.heroSkillMarkdown).digest('hex')}`;
    if (index.$schema !== 'https://schemas.agentskills.io/discovery/0.2.0/schema.json' || index.skills?.length !== 1 || skill?.name !== HERO_SKILL_NAME || skill.type !== 'skill-md' || skill.url !== `${expectedOrigin}${HERO_SKILL_PATH}` || skill.digest !== digest) errors.push('Agent Skills index must describe and authenticate the maintained hero skill.');
  } catch {
    errors.push('Agent Skills index must be valid JSON.');
  }

  if (!surfaces.html.includes('<main id="main-content" tabindex="-1">') || !/<h1(?:\s|>)/.test(surfaces.html) || !surfaces.html.includes('Public hackathon sandbox.')) errors.push('The NEXUS shell must include its labelled main landmark, level-one heading, and sandbox disclosure.');
  if (!surfaces.html.includes('<link rel="alternate" type="text/markdown"') || !surfaces.html.includes('<meta property="og:image"') || !surfaces.html.includes('<meta property="og:type" content="website">')) errors.push('The NEXUS shell must advertise its canonical Markdown and Open Graph metadata.');

  const jsonLdMatch = surfaces.html.match(/<script type="application\/ld\+json">(?<json>.+)<\/script>/);
  try {
    const embeddedData = JSON.parse(jsonLdMatch?.groups?.json ?? '') as NexusStructuredData;
    if (JSON.stringify(embeddedData) !== JSON.stringify(surfaces.structuredData)) errors.push('Embedded JSON-LD must match the maintained Schema.org data.');
  } catch {
    errors.push('The NEXUS shell must embed its Schema.org JSON-LD.');
  }

  const notFound = getNexusReadinessResponse('/missing', surfaces);
  if (notFound.status !== 404 || !notFound.body.includes('/sitemap.xml') || !notFound.body.includes('/llms.txt') || !notFound.body.includes('/developers')) errors.push('The 404 response must link agents to sitemap, llms.txt, and developer documentation.');
  return { valid: errors.length === 0, checkedRoutes: NEXUS_READINESS_ROUTES, errors };
}
