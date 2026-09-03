import { createHash } from 'node:crypto';

import type { GoalState } from '@nexus/goal-state';

import { MISSION_DASHBOARD_STYLES, renderMissionDashboard } from './dashboard.js';
import { createInitialHeroGoalState } from './dashboard-fixtures.js';

const GITHUB_REPOSITORY = 'https://github.com/4040apps/Nexus';
const GITHUB_ORGANIZATION = 'https://github.com/4040apps';
const READINESS_LAST_MODIFIED = '2026-09-03';
const HERO_SKILL_NAME = 'continue-procurement-mission';
const HERO_SKILL_PATH = `/.well-known/agent-skills/${HERO_SKILL_NAME}/SKILL.md` as const;

export const NEXUS_READINESS_ROUTES = [
  '/',
  '/developers',
  '/about',
  '/contact',
  '/privacy',
  '/sandbox',
  '/index.md',
  '/developers.md',
  '/about.md',
  '/contact.md',
  '/privacy.md',
  '/sandbox.md',
  '/developers/llms.txt',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/.well-known/ard.json',
  '/.well-known/agent-skills/index.json',
  HERO_SKILL_PATH,
  '/favicon.svg',
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

type FaqPageStructuredData = {
  '@type': 'FAQPage';
  '@id': string;
  mainEntity: readonly {
    '@type': 'Question';
    name: string;
    acceptedAnswer: { '@type': 'Answer'; text: string };
  }[];
};

type NexusStructuredDataNode =
  | OrganizationStructuredData
  | WebSiteStructuredData
  | SoftwareApplicationStructuredData
  | FaqPageStructuredData;

export type NexusStructuredData = {
  '@context': 'https://schema.org';
  '@graph': readonly NexusStructuredDataNode[];
};

export type NexusReadinessSurfaces = {
  canonicalOrigin: string;
  routes: typeof NEXUS_READINESS_ROUTES;
  html: string;
  developersHtml: string;
  aboutHtml: string;
  contactHtml: string;
  privacyHtml: string;
  sandboxHtml: string;
  indexMarkdown: string;
  developersMarkdown: string;
  aboutMarkdown: string;
  contactMarkdown: string;
  privacyMarkdown: string;
  sandboxMarkdown: string;
  developersLlmsTxt: string;
  robotsTxt: string;
  sitemapXml: string;
  llmsTxt: string;
  ardJson: string;
  agentSkillsIndexJson: string;
  heroSkillMarkdown: string;
  faviconSvg: string;
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
  '/sandbox': 'text/html; charset=utf-8',
  '/index.md': 'text/markdown; charset=utf-8',
  '/developers.md': 'text/markdown; charset=utf-8',
  '/about.md': 'text/markdown; charset=utf-8',
  '/contact.md': 'text/markdown; charset=utf-8',
  '/privacy.md': 'text/markdown; charset=utf-8',
  '/sandbox.md': 'text/markdown; charset=utf-8',
  '/developers/llms.txt': 'text/plain; charset=utf-8',
  '/robots.txt': 'text/plain; charset=utf-8',
  '/sitemap.xml': 'application/xml; charset=utf-8',
  '/llms.txt': 'text/plain; charset=utf-8',
  '/.well-known/ard.json': 'application/json; charset=utf-8',
  '/.well-known/agent-skills/index.json': 'application/json; charset=utf-8',
  [HERO_SKILL_PATH]: 'text/markdown; charset=utf-8',
  '/favicon.svg': 'image/svg+xml; charset=utf-8',
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

const DEVELOPER_FAQ = [
  {
    question: 'Is NEXUS a public HTTP API?',
    answer:
      'No. NEXUS is a browser-based WebMCP proof of concept. It has no public REST API, OpenAPI description, OAuth service, or HTTP MCP server.',
  },
  {
    question: 'Where does provider business data live?',
    answer:
      'Each independent provider owns its catalog, pricing, stock, availability, constraints, validation, and tool execution. NEXUS stores only mission continuity state and discovery metadata.',
  },
  {
    question: 'When is human approval required?',
    answer:
      'Commitment actions such as purchases, reservations, signatures, quote acceptance, and installation requests require explicit, proposal-bound human approval.',
  },
] as const;

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
  return `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n# ARD: ${origin}/.well-known/ard.json\n`;
}

function renderSitemapXml(origin: string): string {
  const indexedPaths = [
    '/',
    '/developers',
    '/about',
    '/contact',
    '/privacy',
    '/sandbox',
    '/index.md',
    '/developers.md',
    '/about.md',
    '/contact.md',
    '/privacy.md',
    '/sandbox.md',
  ];
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
- [Developer guide in Markdown](${origin}/developers.md)
- [Scoped developer context](${origin}/developers/llms.txt)
- [About the public sandbox](${origin}/about)
- [Canonical sandbox page](${origin}/sandbox)
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

function markdownFrontmatter(
  title: string,
  description: string,
  canonicalUrl: string,
): string {
  return `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(description)}
canonical: ${JSON.stringify(canonicalUrl)}
last-updated: ${JSON.stringify(READINESS_LAST_MODIFIED)}
---

`;
}

function renderIndexMarkdown(origin: string): string {
  return `${markdownFrontmatter(
    'NEXUS — Intent continuity across providers',
    'A deterministic WebMCP-first public hackathon sandbox for continuing intent across independent providers.',
    `${origin}/`,
  )}# NEXUS

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

function renderDevelopersMarkdown(origin: string): string {
  return `${markdownFrontmatter(
    'Developer guide — NEXUS',
    'The real NEXUS WebMCP architecture, runtime requirements, approval boundaries, commands, and maintained sources.',
    `${origin}/developers`,
  )}# Developer guide

NEXUS is a browser-based WebMCP proof of concept, not a public HTTP API.

## Architecture

The consumer mission dashboard runs at ${origin}. OfficePro, TechSupply, FiberMX, NetBusiness, and SecureNow run on independent origins. Each provider registers genuine tools with \`document.modelContext\`; provider-owned catalog, pricing, stock, availability, constraints, and validation remain on that provider origin.

NEXUS preserves only Goal State and the minimum remaining-intent handoff. It does not proxy provider business logic through invented REST endpoints.

## Permission and approval boundaries

The controlled cross-origin path was validated with Chrome 151+ launched using \`--enable-features=WebMCP\`. Provider \`fromOrigins\`, tool \`exposedTo\`, and iframe \`allow="tools"\` restrict exposure to the authorized NEXUS origin. Chrome 151 is not claimed to enable WebMCP by default.

Read and planning operations may run autonomously after an explicit Intent Handoff. Purchases, reservations, signing, quote acceptance, and installation commitments require a separate, proposal-bound human approval.

## Local and production usage

From a repository checkout, install with \`pnpm install --frozen-lockfile\`, run the six-origin local hero with \`pnpm demo:hero\`, and build production static assets with \`pnpm build:production\`. The linked GitHub repository requires access granted by its owner.

## Frequently asked questions

### Is NEXUS a public HTTP API?

No. NEXUS is a browser-based WebMCP proof of concept. It has no public REST API, OpenAPI description, OAuth service, or HTTP MCP server.

### Where does provider business data live?

Each independent provider owns its catalog, pricing, stock, availability, constraints, validation, and tool execution. NEXUS stores only mission continuity state and discovery metadata.

### When is human approval required?

Commitment actions such as purchases, reservations, signatures, quote acceptance, and installation requests require explicit, proposal-bound human approval.

## Maintained references

- [Source repository (GitHub access required)](${GITHUB_REPOSITORY})
- [AGENTS.md operating contract](${GITHUB_REPOSITORY}/blob/main/AGENTS.md)
- [Architecture](${GITHUB_REPOSITORY}/blob/main/docs/architecture.md)
- [WebMCP validation](${GITHUB_REPOSITORY}/blob/main/docs/webmcp.md)
- [Deployment](${GITHUB_REPOSITORY}/blob/main/docs/deployment.md)
`;
}

function renderAboutMarkdown(origin: string): string {
  return `${markdownFrontmatter(
    'About NEXUS',
    'The mission, architecture, and limits of the deterministic NEXUS public hackathon sandbox.',
    `${origin}/about`,
  )}# About NEXUS

**Websites end. Human intentions don't.**

NEXUS is a proof of concept maintained by 4040apps. It demonstrates fulfillment, explicit Intent Handoff, recovery and rerouting, human approval, and Goal Complete across independent agent-ready providers. The mission dashboard keeps requirements, budget, deadline, provider assignments, failures, approvals, and the activity timeline visible.

The canonical mission opens an office for 20 people in Guadalajara before 2026-10-01 with a MXN 500,000 budget. OfficePro fulfills desks and chairs before the user authorizes NEXUS to continue. TechSupply supplies computers, FiberMX reports a late installation date, NetBusiness provides the valid internet reroute, and SecureNow pauses before commitment for explicit human approval.

## Why the demo is deterministic

Provider data and outcomes are synthetic and fixed so the same failure, reroute, approval boundary, final MXN 410,000 cost, and completed mission can be inspected repeatedly. Each provider still owns its own demo catalog and WebMCP execution. NEXUS preserves shared Goal State and the minimum remaining intent; it does not hide providers behind a central procurement API.

## What this is not

This sandbox is not a real marketplace, procurement service, payment processor, supplier registry, or production integration. It cannot place a real order or represent real supplier availability. It intentionally publishes no REST API, OAuth service, MCP server, pricing program, SDK, or CLI.

- [Open the mission](${origin}/)
- [Inspect the source](${GITHUB_REPOSITORY})
`;
}

function renderContactMarkdown(origin: string): string {
  return `${markdownFrontmatter(
    'Contact — NEXUS',
    'The repository support and reproducible bug-reporting path for the NEXUS hackathon proof of concept.',
    `${origin}/contact`,
  )}# Contact

NEXUS is maintained by 4040apps. [GitHub Issues](${GITHUB_REPOSITORY}/issues) is its support and bug-report channel for repository collaborators. The repository is access-controlled, so the link requires GitHub access granted by its owner; NEXUS does not advertise a separate public or private intake channel.

Appropriate reports include reproducible hero-flow failures, incorrect Goal State transitions, WebMCP discovery or permission errors, broken readiness routes, accessibility barriers, documentation mistakes, and production pages that do not match the repository's architecture.

## What to include in a report

Describe the affected page or provider, reproduction steps, expected result, and observed result. For browser or WebMCP problems, include the browser version, whether WebMCP was explicitly enabled, the failed provider step, and a redacted error or console excerpt when useful. Include the deployed URL and commit or deployment identifier if visible.

## Repository channel and sensitive information

Issue content may be read or copied by people with repository access and may become public if repository visibility changes. Do not submit passwords, access tokens, credentials, personal contact details, payment information, confidential supplier terms, real quotes, real availability, real procurement instructions, or other non-public information. Use synthetic demo values. NEXUS advertises no separate support intake, email address, telephone number, or physical support location.
`;
}

function renderPrivacyMarkdown(origin: string): string {
  return `${markdownFrontmatter(
    'Privacy — NEXUS',
    'The application-data and infrastructure boundaries of the deterministic NEXUS public sandbox.',
    `${origin}/privacy`,
  )}# Privacy

Use synthetic information only.

## Application data

The NEXUS demo provides no user accounts, login, authentication service, payment flow, or production datastore. Its office mission, provider examples, prices, availability, deadline conflict, reroute, and approval proposal are deterministic synthetic data used only for the hero flow. Mission state runs as browser-demo state and can be reset to the fixed starting point.

The application itself does not intentionally ask for or collect names, email addresses, postal addresses, credentials, payment details, real supplier records, or real procurement requirements. It has no signup form, private message form, checkout, analytics integration, or account profile in the implemented repository. This describes NEXUS application code, not every external network or browser component.

## Hosting and external services

Cloudflare delivers the public pages, and links may open GitHub. Cloudflare, GitHub, a browser, a network operator, or other infrastructure may process ordinary request metadata under their own configurations and policies. NEXUS does not claim to control those services or make privacy guarantees for them.

## What not to submit

Do not enter or publish personal information, passwords, tokens, credentials, real payment details, confidential supplier data, real quotes, real availability, or real procurement instructions. [GitHub Issues](${GITHUB_REPOSITORY}/issues) require repository access; issue content may be copied by collaborators or become public if repository visibility changes. Reports must use synthetic examples and contain no sensitive information.
`;
}

function renderSandboxMarkdown(origin: string): string {
  return `${markdownFrontmatter(
    'NEXUS public sandbox',
    'The canonical deterministic production demo and its synthetic-data, runtime, and commitment boundaries.',
    `${origin}/sandbox`,
  )}# NEXUS public sandbox

The production NEXUS site is itself the public sandbox for the deterministic hackathon hero flow. There is no separate API sandbox, credential, account, or production-data environment.

The sandbox opens a synthetic office-procurement mission for 20 people in Guadalajara. Its fixed provider data makes the partial fulfillment, explicit handoff, deadline failure, internet reroute, human approval, and Goal Complete outcome reproducible.

Genuine cross-origin WebMCP requires Chrome 151+ launched with \`--enable-features=WebMCP\`. The normal provider websites remain usable when WebMCP is unavailable, and the UI must not label fallback transport as WebMCP.

No action creates a real order, reservation, payment, supplier quote, or installation. Use only synthetic information.

- [Open the deterministic mission](${origin}/)
- [Read the developer guide](${origin}/developers)
- [Inspect the source (GitHub access required)](${GITHUB_REPOSITORY})
`;
}

function renderDevelopersLlmsTxt(origin: string): string {
  return `# NEXUS developer context

> Scoped technical context for the deterministic NEXUS public WebMCP sandbox.

## Product boundary

- NEXUS is a browser-based proof of concept, not a public HTTP API.
- NEXUS has no REST or GraphQL API, OpenAPI document, OAuth or OIDC service, HTTP MCP server, A2A endpoint, payment API, SDK, or CLI.

## WebMCP architecture and runtime

- Independent providers register genuine tools through document.modelContext on their own origins.
- Chrome 151+ must be launched with --enable-features=WebMCP for the validated controlled environment; WebMCP is not enabled by default.
- Production consumer: ${origin}
- Provider origins: https://officepro.1expert.pro, https://techsupply.1expert.pro, https://fibermx.1expert.pro, https://netbusiness.1expert.pro, and https://securenow.1expert.pro.
- Exact fromOrigins, exposedTo, and iframe allow="tools" permissions prevent wildcard exposure.
- Provider catalog, pricing, stock, availability, constraints, validation, and tool execution remain provider-owned.

## Approval boundaries

- Broker Mode begins only after an explicit Intent Handoff for remaining requirements.
- Read and planning operations may run after handoff.
- Purchases, reservations, signatures, quote acceptance, and installation commitments require separate proposal-bound human approval.

## Commands

- Install: pnpm install --frozen-lockfile
- Local six-origin hero: pnpm demo:hero
- Quality gates: pnpm lint, pnpm typecheck, pnpm test, pnpm build
- Production assets: pnpm build:production
- Production verification: pnpm verify:production

## Sources

- [Developer guide](${origin}/developers)
- [Developer guide Markdown](${origin}/developers.md)
- [Source repository (GitHub access required)](${GITHUB_REPOSITORY})
- [AGENTS.md](${GITHUB_REPOSITORY}/blob/main/AGENTS.md)
- [Architecture](${GITHUB_REPOSITORY}/blob/main/docs/architecture.md)
- [WebMCP validation](${GITHUB_REPOSITORY}/blob/main/docs/webmcp.md)
- [Deployment](${GITHUB_REPOSITORY}/blob/main/docs/deployment.md)
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
    specVersion: '1.0',
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

function createDeveloperStructuredData(
  origin: string,
  structuredData: NexusStructuredData,
): NexusStructuredData {
  return {
    ...structuredData,
    '@graph': [
      ...structuredData['@graph'],
      {
        '@type': 'FAQPage',
        '@id': `${origin}/developers#faq`,
        mainEntity: DEVELOPER_FAQ.map(({ question, answer }) => ({
          '@type': 'Question' as const,
          name: question,
          acceptedAnswer: { '@type': 'Answer' as const, text: answer },
        })),
      },
    ],
  };
}

function navigation(): string {
  return `<nav aria-label="Primary navigation"><ul><li><a href="/">Mission</a></li><li><a href="/developers">Developers</a></li><li><a href="/sandbox">Sandbox</a></li><li><a href="/about">About</a></li><li><a href="/llms.txt">AI overview</a></li></ul></nav>`;
}

function renderHead(origin: string, path: string, title: string, description: string, structuredData: NexusStructuredData, preconnectOrigin?: string): string {
  const canonicalUrl = `${origin}${path}`;
  const markdownPath = path === '/' ? '/index.md' : ['/developers', '/about', '/contact', '/privacy', '/sandbox'].includes(path) ? `${path}.md` : '/index.md';
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
  <link rel="icon" type="image/svg+xml" href="${origin}/favicon.svg">
  ${preconnectOrigin ? `<link rel="preconnect" href="${preconnectOrigin}">` : ''}
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="alternate" type="text/markdown" href="${origin}${markdownPath}" title="${title} in Markdown">
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
<head>${renderHead(origin, '/', 'NEXUS — Intent continuity across providers', description, structuredData, officeProRuntime?.providerOrigin)}</head>
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
  return renderContentPage(origin, createDeveloperStructuredData(origin, structuredData), '/developers', 'Developer guide', 'How the NEXUS WebMCP hero demo preserves independent provider logic, explicit handoff, and human approval.', `<h1>Developer guide</h1>
<p class="lead">NEXUS is a browser-based WebMCP proof of concept, not a public HTTP API.</p>
<h2>Architecture</h2>
<p>The consumer mission dashboard runs at <code>${origin}</code>. OfficePro, TechSupply, FiberMX, NetBusiness, and SecureNow run on independent origins. Each provider registers genuine tools with <code>document.modelContext</code>; provider-owned catalog, pricing, stock, availability, constraints, and validation remain on that provider origin.</p>
<p>NEXUS preserves only Goal State and the minimum remaining-intent handoff. It does not proxy provider business logic through invented REST endpoints.</p>
<h2>Permission and approval boundaries</h2>
<p>The controlled cross-origin path was validated with Chrome 151+ launched using <code>--enable-features=WebMCP</code>. Provider <code>fromOrigins</code>, tool <code>exposedTo</code>, and iframe <code>allow="tools"</code> restrict exposure to the authorized NEXUS origin. Chrome 151 is not claimed to enable WebMCP by default.</p>
<p>Read and planning operations may run autonomously after an explicit Intent Handoff. Purchases, reservations, signing, quote acceptance, and installation commitments require a separate, proposal-bound human approval.</p>
<h2>Local and production usage</h2>
<p>From a repository checkout, install with <code>pnpm install --frozen-lockfile</code>, run the six-origin local hero with <code>pnpm demo:hero</code>, and build the production static assets with <code>pnpm build:production</code>. Exact deployment and WebMCP reproduction steps remain versioned with the source. The linked GitHub repository requires access granted by its owner.</p>
<h2 id="faq">Frequently asked questions</h2>
<dl>${DEVELOPER_FAQ.map(({ question, answer }) => `<dt><strong>${question}</strong></dt><dd>${answer}</dd>`).join('')}</dl>
<h2>Maintained references</h2>
<ul><li><a href="${GITHUB_REPOSITORY}">Source repository (GitHub access required)</a></li><li><a href="${GITHUB_REPOSITORY}/blob/main/AGENTS.md">AGENTS.md operating contract</a></li><li><a href="${GITHUB_REPOSITORY}/blob/main/docs/architecture.md">Architecture</a></li><li><a href="${GITHUB_REPOSITORY}/blob/main/docs/webmcp.md">WebMCP validation</a></li><li><a href="${GITHUB_REPOSITORY}/blob/main/docs/deployment.md">Deployment</a></li></ul>`);
}

function renderAboutHtml(origin: string, structuredData: NexusStructuredData): string {
  return renderContentPage(origin, structuredData, '/about', 'About', 'About the NEXUS deterministic public hackathon sandbox and its intent-continuity mission.', `<h1>About NEXUS</h1>
<p class="lead"><strong>Websites end. Human intentions don't.</strong></p>
<p>NEXUS is a proof of concept maintained by 4040apps. It demonstrates fulfillment, explicit Intent Handoff, recovery and rerouting, human approval, and Goal Complete across independent agent-ready providers. The mission dashboard keeps requirements, budget, deadline, provider assignments, failures, approvals, and the activity timeline visible instead of asking a user to trust chat text alone.</p>
<p>The canonical mission opens an office for 20 people in Guadalajara before 2026-10-01 with a MXN 500,000 budget. OfficePro fulfills desks and chairs before the user authorizes NEXUS to continue the remaining work. TechSupply supplies computers, FiberMX reports an installation date outside the deadline, NetBusiness provides the valid internet reroute, and SecureNow pauses before commitment for explicit human approval.</p>
<h2>Why the demo is deterministic</h2>
<p>Provider data and outcomes are synthetic and fixed so the same failure, reroute, approval boundary, final MXN 410,000 cost, and completed mission can be inspected repeatedly. Each provider still owns its own demo catalog and WebMCP execution. NEXUS preserves the shared Goal State and the minimum remaining intent; it does not hide all providers behind a central procurement API.</p>
<h2>What this is not</h2>
<p>This public sandbox is not a real marketplace, procurement service, payment processor, supplier registry, or production integration. It cannot place a real order or represent real supplier availability. It intentionally publishes no REST API, OAuth service, MCP server, pricing program, SDK, or CLI. Its purpose is limited to showing the implemented NEXUS architecture and hero flow clearly and reproducibly.</p>
<p class="actions"><a href="/">Open the mission</a><a href="${GITHUB_REPOSITORY}">Inspect the source</a></p>`);
}

function renderContactHtml(origin: string, structuredData: NexusStructuredData): string {
  return renderContentPage(origin, structuredData, '/contact', 'Contact', 'How to report NEXUS demo defects and discuss the public proof of concept.', `<h1>Contact</h1>
<p class="lead">NEXUS is maintained by 4040apps.</p>
<p><a href="${GITHUB_REPOSITORY}/issues">GitHub Issues</a> is its support and bug-report channel for repository collaborators. The repository is access-controlled, so the link requires GitHub access granted by its owner; NEXUS does not advertise a separate public or private intake channel. Appropriate reports include reproducible hero-flow failures, incorrect Goal State transitions, WebMCP discovery or permission errors, broken readiness routes, accessibility barriers, documentation mistakes, and production pages that do not match the repository's stated architecture.</p>
<h2>What to include in a report</h2>
<p>Describe the page or provider where the problem occurred, the steps needed to reproduce it, the result you expected, and the result you observed. For browser or WebMCP problems, include the browser name and version, whether WebMCP was explicitly enabled, the provider step that failed, and a redacted error message or console excerpt when useful. Include the deployed URL and commit or deployment identifier if they are visible. A minimal repeatable report helps maintainers distinguish an application defect from an unsupported runtime or an origin-permission mismatch.</p>
<h2>Repository channel and sensitive information</h2>
<p>Issue content may be read or copied by people with repository access and may become public if repository visibility changes. Do not submit passwords, access tokens, credentials, personal contact details, payment information, confidential supplier terms, real quotes, real availability, real procurement instructions, or any other non-public information. Use synthetic demo values when an example is needed. NEXUS has no separate support intake, email address, telephone number, or physical support location advertised by this project.</p>
<p class="actions"><a href="${GITHUB_REPOSITORY}/issues">Open GitHub Issues</a><a href="${GITHUB_REPOSITORY}">View repository</a></p>`);
}

function renderPrivacyHtml(origin: string, structuredData: NexusStructuredData): string {
  return renderContentPage(origin, structuredData, '/privacy', 'Privacy', 'Privacy boundaries for the deterministic NEXUS public hackathon sandbox.', `<h1>Privacy</h1>
<p class="lead">Use synthetic information only.</p>
<h2>Application data</h2>
<p>The NEXUS demo provides no user accounts, login, authentication service, payment flow, or production datastore. Its office mission, provider catalog examples, prices, availability, deadline conflict, reroute, and approval proposal are deterministic synthetic data used only to demonstrate the hero flow. Mission state runs as browser-demo state and can be returned to the fixed starting point with the reset control.</p>
<p>The application itself does not intentionally ask for or collect names, email addresses, postal addresses, credentials, payment details, real supplier records, or real procurement requirements. It has no signup form, private message form, checkout, analytics integration, or account profile in the implemented repository. These statements describe the NEXUS application code; they are not a guarantee about every network or browser component outside the application.</p>
<h2>Hosting and external services</h2>
<p>The public pages are delivered using Cloudflare infrastructure, and links on this site may open an access-controlled GitHub repository. Cloudflare, GitHub, a browser, a network operator, or other infrastructure may process ordinary request metadata such as an IP address, timestamp, user agent, requested URL, or diagnostic logs under their own configurations and policies. NEXUS does not claim to control those independent services or make privacy guarantees on their behalf.</p>
<h2>What not to submit</h2>
<p>Do not enter or publish personal information, passwords, tokens, credentials, real payment details, confidential supplier data, real quotes, real availability, or real procurement instructions in this sandbox. Repository questions and defects may be reported through <a href="${GITHUB_REPOSITORY}/issues">GitHub Issues</a> by collaborators with access. Issue content may be copied by collaborators or become public if repository visibility changes. Reports must use synthetic examples and must not contain sensitive information.</p>`);
}

function renderSandboxHtml(origin: string, structuredData: NexusStructuredData): string {
  return renderContentPage(origin, structuredData, '/sandbox', 'Public sandbox', 'The runtime, synthetic-data, and commitment boundaries of the canonical deterministic NEXUS production demo.', `<h1>NEXUS public sandbox</h1>
<p class="lead">The production NEXUS site is itself the public sandbox for the deterministic hackathon hero flow.</p>
<p>There is no separate API sandbox, credential, account, or production-data environment. The sandbox opens a synthetic office-procurement mission for 20 people in Guadalajara. Fixed provider data makes the partial fulfillment, explicit handoff, deadline failure, internet reroute, human approval, and Goal Complete outcome reproducible.</p>
<h2>Runtime and data boundaries</h2>
<p>Genuine cross-origin WebMCP requires Chrome 151+ launched with <code>--enable-features=WebMCP</code>. The normal provider websites remain usable when WebMCP is unavailable, and the UI must not label fallback transport as WebMCP.</p>
<p>No action creates a real order, reservation, payment, supplier quote, or installation. The mission and provider results are deterministic synthetic data. Do not submit personal, credential, payment, procurement, or confidential supplier information.</p>
<p class="actions"><a href="/">Open the deterministic mission</a><a href="/developers">Read the developer guide</a><a href="${GITHUB_REPOSITORY}">Inspect the source</a></p>`);
}

function renderNotFoundHtml(origin: string, structuredData: NexusStructuredData): string {
  return renderContentPage(origin, structuredData, '/404', 'Not found', 'The requested NEXUS resource was not found.', `<h1>Resource not found</h1>
<p><strong>HTTP status: 404.</strong> The requested path is not part of the maintained NEXUS public sandbox. No API-style error contract is implied.</p>
<p>Agents and people can recover through these canonical resources:</p>
<ul><li><a href="/index.md">Markdown overview</a></li><li><a href="/sitemap.xml">Sitemap</a></li><li><a href="/llms.txt">AI-readable overview</a></li><li><a href="/developers">Developer guide</a></li><li><a href="/developers.md">Developer guide in Markdown</a></li><li><a href="/sandbox">Public sandbox</a></li></ul>`);
}

function renderOgImageSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">NEXUS</title><desc id="desc">Intent continuity across independent providers</desc><rect width="1200" height="630" fill="#07101d"/><circle cx="1020" cy="60" r="330" fill="#1c4166" opacity=".55"/><rect x="86" y="84" width="86" height="86" rx="22" fill="#122137" stroke="#b8f24b" stroke-width="3"/><text x="129" y="146" text-anchor="middle" fill="#b8f24b" font-family="Arial, sans-serif" font-size="54" font-weight="800">N</text><text x="86" y="320" fill="#f4f7fb" font-family="Arial, sans-serif" font-size="118" font-weight="800" letter-spacing="8">NEXUS</text><text x="92" y="405" fill="#cae8ff" font-family="Arial, sans-serif" font-size="42">Intent continuity across providers</text><text x="92" y="500" fill="#a8b6ca" font-family="Arial, sans-serif" font-size="28">WebMCP · visible rerouting · human approval</text>
</svg>
`;
}

function renderFaviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title">
  <title id="title">NEXUS</title>
  <rect width="64" height="64" rx="14" fill="#122137"/>
  <path d="M18 46V18h7l14 18V18h7v28h-7L25 28v18z" fill="#b8f24b"/>
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
    sandboxHtml: renderSandboxHtml(canonicalOrigin, structuredData),
    indexMarkdown: renderIndexMarkdown(canonicalOrigin),
    developersMarkdown: renderDevelopersMarkdown(canonicalOrigin),
    aboutMarkdown: renderAboutMarkdown(canonicalOrigin),
    contactMarkdown: renderContactMarkdown(canonicalOrigin),
    privacyMarkdown: renderPrivacyMarkdown(canonicalOrigin),
    sandboxMarkdown: renderSandboxMarkdown(canonicalOrigin),
    developersLlmsTxt: renderDevelopersLlmsTxt(canonicalOrigin),
    robotsTxt: renderRobotsTxt(canonicalOrigin),
    sitemapXml: renderSitemapXml(canonicalOrigin),
    llmsTxt: renderLlmsTxt(canonicalOrigin),
    ardJson: renderArdJson(canonicalOrigin),
    agentSkillsIndexJson: renderAgentSkillsIndex(canonicalOrigin, heroSkillMarkdown),
    heroSkillMarkdown,
    faviconSvg: renderFaviconSvg(),
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
    '/sandbox': surfaces.sandboxHtml,
    '/index.md': surfaces.indexMarkdown,
    '/developers.md': surfaces.developersMarkdown,
    '/about.md': surfaces.aboutMarkdown,
    '/contact.md': surfaces.contactMarkdown,
    '/privacy.md': surfaces.privacyMarkdown,
    '/sandbox.md': surfaces.sandboxMarkdown,
    '/developers/llms.txt': surfaces.developersLlmsTxt,
    '/robots.txt': surfaces.robotsTxt,
    '/sitemap.xml': surfaces.sitemapXml,
    '/llms.txt': surfaces.llmsTxt,
    '/.well-known/ard.json': surfaces.ardJson,
    '/.well-known/agent-skills/index.json': surfaces.agentSkillsIndexJson,
    [HERO_SKILL_PATH]: surfaces.heroSkillMarkdown,
    '/favicon.svg': surfaces.faviconSvg,
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

function hasCanonicalFrontmatter(markdown: string, canonicalUrl: string): boolean {
  const frontmatter = markdown.match(/^---\n(?<fields>.*?)\n---\n/s)?.groups?.fields ?? '';
  return (
    frontmatter.includes('title: ') &&
    frontmatter.includes('description: ') &&
    frontmatter.includes(`canonical: ${JSON.stringify(canonicalUrl)}`) &&
    frontmatter.includes(`last-updated: ${JSON.stringify(READINESS_LAST_MODIFIED)}`)
  );
}

export function validateNexusReadinessSurfaces(surfaces: NexusReadinessSurfaces): NexusReadinessValidation {
  const errors: string[] = [];
  const expectedOrigin = normalizeCanonicalOrigin(surfaces.canonicalOrigin);
  for (const route of NEXUS_READINESS_ROUTES) {
    const response = getNexusReadinessResponse(route, surfaces);
    if (response.status !== 200 || response.body.trim().length === 0) errors.push(`${route} must resolve to a non-empty 200 response.`);
  }
  if (!surfaces.robotsTxt.includes(`Sitemap: ${expectedOrigin}/sitemap.xml`) || !surfaces.robotsTxt.includes(`# ARD: ${expectedOrigin}/.well-known/ard.json`)) errors.push('robots.txt must reference the canonical sitemap and document the separately advertised ARD manifest.');
  if (!surfaces.robotsTxt.startsWith('User-agent: *\nAllow: /\n')) errors.push('robots.txt must contain a valid public crawler policy.');
  if (!surfaces.sitemapXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>') || !surfaces.sitemapXml.includes(`<loc>${escapeXml(`${expectedOrigin}/`)}</loc>`) || !surfaces.sitemapXml.includes(`<lastmod>${READINESS_LAST_MODIFIED}</lastmod>`)) errors.push('sitemap.xml must include canonical maintained pages with last-modified dates.');

  const markdownDocuments = [
    surfaces.llmsTxt,
    surfaces.indexMarkdown,
    surfaces.developersMarkdown,
    surfaces.aboutMarkdown,
    surfaces.contactMarkdown,
    surfaces.privacyMarkdown,
    surfaces.sandboxMarkdown,
    surfaces.developersLlmsTxt,
  ];
  for (const linkedUrl of markdownDocuments.flatMap((document) => linkedUrls(document))) {
    const url = new URL(linkedUrl);
    const internalAvailable = url.origin === expectedOrigin && getNexusReadinessResponse(url.pathname, surfaces).status === 200;
    if (!internalAvailable && !isMaintainedExternalDocumentation(url)) errors.push(`readiness Markdown references an unavailable resource: ${linkedUrl}`);
  }

  const canonicalMarkdown: ReadonlyArray<readonly [string, string]> = [
    [surfaces.indexMarkdown, `${expectedOrigin}/`],
    [surfaces.developersMarkdown, `${expectedOrigin}/developers`],
    [surfaces.aboutMarkdown, `${expectedOrigin}/about`],
    [surfaces.contactMarkdown, `${expectedOrigin}/contact`],
    [surfaces.privacyMarkdown, `${expectedOrigin}/privacy`],
    [surfaces.sandboxMarkdown, `${expectedOrigin}/sandbox`],
  ];
  if (canonicalMarkdown.some(([markdown, canonical]) => !hasCanonicalFrontmatter(markdown, canonical))) {
    errors.push('Every canonical Markdown document must include truthful maintained frontmatter.');
  }

  const application = surfaces.structuredData['@graph'].find((node) => node['@type'] === 'SoftwareApplication');
  const organization = surfaces.structuredData['@graph'].find((node) => node['@type'] === 'Organization');
  if (application?.url !== `${expectedOrigin}/` || !application.sameAs.includes(GITHUB_REPOSITORY) || organization?.url !== GITHUB_ORGANIZATION) errors.push('Schema.org data must identify the canonical NEXUS application and real 4040apps sources.');

  try {
    const ard = JSON.parse(surfaces.ardJson) as { specVersion?: string; entries?: Array<Record<string, unknown>> };
    if (ard.specVersion !== '1.0' || !Array.isArray(ard.entries) || ard.entries.length === 0 || ard.entries.some((entry) => typeof entry.identifier !== 'string' || typeof entry.displayName !== 'string' || typeof entry.type !== 'string' || typeof entry.url !== 'string' || 'data' in entry || !Array.isArray(entry.representativeQueries) || entry.representativeQueries.length < 2 || entry.representativeQueries.length > 5)) errors.push('ARD must declare specVersion 1.0 and contain only complete, reference-based, discoverable resources.');
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
  if (!surfaces.html.includes(`<link rel="icon" type="image/svg+xml" href="${expectedOrigin}/favicon.svg">`)) errors.push('The NEXUS shell must advertise its maintained favicon.');
  if (!surfaces.developersHtml.includes(`${expectedOrigin}/developers.md`) || !surfaces.developersHtml.includes('"@type":"FAQPage"')) {
    errors.push('The developer guide must advertise its Markdown twin and embed its visible FAQ data.');
  }

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
