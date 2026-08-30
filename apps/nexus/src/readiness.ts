export const NEXUS_READINESS_ROUTES = [
  '/',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
] as const;

export type NexusReadinessRoute = (typeof NEXUS_READINESS_ROUTES)[number];

export type NexusReadinessConfig = {
  canonicalOrigin: string;
  goalState?: GoalState;
  officeProRuntime?: {
    providerOrigin: string;
  };
};

export type NexusStructuredData = {
  '@context': 'https://schema.org';
  '@type': 'SoftwareApplication';
  '@id': string;
  name: 'NEXUS';
  url: string;
  description: string;
  applicationCategory: 'BusinessApplication';
  operatingSystem: 'Web';
  inLanguage: 'en';
  featureList: readonly string[];
};

export type NexusReadinessSurfaces = {
  canonicalOrigin: string;
  routes: typeof NEXUS_READINESS_ROUTES;
  robotsTxt: string;
  sitemapXml: string;
  llmsTxt: string;
  structuredData: NexusStructuredData;
  html: string;
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
  '/robots.txt': 'text/plain; charset=utf-8',
  '/sitemap.xml': 'application/xml; charset=utf-8',
  '/llms.txt': 'text/plain; charset=utf-8',
};

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
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function renderRobotsTxt(origin: string): string {
  return `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
}

function renderSitemapXml(origin: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(`${origin}/`)}</loc>
  </url>
</urlset>
`;
}

function renderLlmsTxt(origin: string): string {
  return `# NEXUS

> NEXUS preserves a human's remaining intent across independent, agent-ready providers.

## Product model

- Brand Mode keeps work within the provider the user deliberately chose.
- Broker Mode starts only after an explicitly authorized Intent Handoff is executed for the remaining requirements.
- Provider failures and reroutes stay visible in the Goal State activity timeline.
- Purchases, reservations, signatures, and other commitment operations require explicit human approval.

## WebMCP architecture

- Independent providers register genuine browser tools with document.modelContext.
- The authorized consumer invokes those tools on the provider origin; NEXUS does not proxy provider-owned catalog, pricing, stock, availability, or constraints.
- Tool exposure follows the validated fromOrigins, exposedTo, and iframe allow="tools" browser permission model documented by this repository.
- After an executed handoff, TechSupply fulfills computers through provider-owned read and planning tools without invoking its commitment-class quote tool.

## Discovery

- [NEXUS home](${origin}/)
- [robots.txt](${origin}/robots.txt)
- [sitemap.xml](${origin}/sitemap.xml)
`;
}

function createStructuredData(origin: string): NexusStructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${origin}/#application`,
    name: 'NEXUS',
    url: `${origin}/`,
    description:
      'A WebMCP-first proof of concept that continues remaining intent across independent providers with visible rerouting and human approval.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: 'en',
    featureList: [
      'Goal State mission progress',
      'Explicit Intent Handoff',
      'Visible provider failure and rerouting',
      'Human approval before commitments',
    ],
  };
}

function renderHtml(
  origin: string,
  structuredData: NexusStructuredData,
  goalState: GoalState,
  officeProRuntime?: { providerOrigin: string },
): string {
  const structuredDataJson = JSON.stringify(structuredData).replaceAll('<', '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="NEXUS continues remaining intent across independent WebMCP providers with visible recovery and human approval.">
  <link rel="canonical" href="${origin}/">
  <title>NEXUS — Intent continuity across providers</title>
  <script type="application/ld+json">${structuredDataJson}</script>
  <style>${MISSION_DASHBOARD_STYLES}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header>
    <div class="site-header">
      <div class="brand"><span class="brand-mark" aria-hidden="true">N</span><span>NEXUS</span></div>
      <nav aria-label="Machine-readable discovery">
        <ul>
          <li><a href="/robots.txt">Robots policy</a></li>
          <li><a href="/sitemap.xml">Sitemap</a></li>
          <li><a href="/llms.txt">AI-readable overview</a></li>
        </ul>
      </nav>
    </div>
  </header>
  <main id="main-content" tabindex="-1">
    ${renderMissionDashboard(
      goalState,
      officeProRuntime
        ? {
            providerOrigin: officeProRuntime.providerOrigin,
            phase: 'READY',
            message: 'Waiting for the independent OfficePro origin to report its WebMCP capability.',
          }
        : undefined,
    )}
  </main>
  <footer>
    <div class="site-footer">NEXUS is a deterministic proof of concept for intent continuity across independent agent-ready providers.</div>
  </footer>
  ${officeProRuntime ? '<script type="module" src="/officepro-runtime-client.js"></script>' : ''}
</body>
</html>
`;
}

export function createNexusReadinessSurfaces(
  config: NexusReadinessConfig,
): NexusReadinessSurfaces {
  const canonicalOrigin = normalizeCanonicalOrigin(config.canonicalOrigin);
  const structuredData = createStructuredData(canonicalOrigin);
  const goalState = config.goalState ?? createInitialHeroGoalState();
  const officeProRuntime = config.officeProRuntime
    ? { providerOrigin: normalizeCanonicalOrigin(config.officeProRuntime.providerOrigin) }
    : undefined;

  return {
    canonicalOrigin,
    routes: NEXUS_READINESS_ROUTES,
    robotsTxt: renderRobotsTxt(canonicalOrigin),
    sitemapXml: renderSitemapXml(canonicalOrigin),
    llmsTxt: renderLlmsTxt(canonicalOrigin),
    structuredData,
    html: renderHtml(canonicalOrigin, structuredData, goalState, officeProRuntime),
  };
}

function responseForRoute(
  route: NexusReadinessRoute,
  surfaces: NexusReadinessSurfaces,
): NexusReadinessResponse {
  const bodies: Readonly<Record<NexusReadinessRoute, string>> = {
    '/': surfaces.html,
    '/robots.txt': surfaces.robotsTxt,
    '/sitemap.xml': surfaces.sitemapXml,
    '/llms.txt': surfaces.llmsTxt,
  };

  return {
    status: 200,
    headers: { 'content-type': CONTENT_TYPES[route] },
    body: bodies[route],
  };
}

export function getNexusReadinessResponse(
  pathname: string,
  surfaces: NexusReadinessSurfaces,
): NexusReadinessResponse {
  if ((NEXUS_READINESS_ROUTES as readonly string[]).includes(pathname)) {
    return responseForRoute(pathname as NexusReadinessRoute, surfaces);
  }

  return {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: 'Not found.\n',
  };
}

function linkedDiscoveryUrls(llmsTxt: string): string[] {
  return [...llmsTxt.matchAll(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g)].map((match) => match[1] ?? '');
}

export function validateNexusReadinessSurfaces(
  surfaces: NexusReadinessSurfaces,
): NexusReadinessValidation {
  const errors: string[] = [];
  const expectedOrigin = normalizeCanonicalOrigin(surfaces.canonicalOrigin);

  for (const route of NEXUS_READINESS_ROUTES) {
    const response = getNexusReadinessResponse(route, surfaces);
    if (response.status !== 200 || response.body.trim().length === 0) {
      errors.push(`${route} must resolve to a non-empty 200 response.`);
    }
  }

  if (!surfaces.robotsTxt.includes(`Sitemap: ${expectedOrigin}/sitemap.xml`)) {
    errors.push('robots.txt must reference the canonical sitemap.');
  }

  if (!surfaces.robotsTxt.startsWith('User-agent: *\nAllow: /\n')) {
    errors.push('robots.txt must contain a valid public crawler policy.');
  }

  if (
    !surfaces.sitemapXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>') ||
    !surfaces.sitemapXml.includes(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ) ||
    !surfaces.sitemapXml.includes(`<loc>${escapeXml(`${expectedOrigin}/`)}</loc>`)
  ) {
    errors.push('sitemap.xml must include the canonical NEXUS home URL.');
  }

  for (const linkedUrl of linkedDiscoveryUrls(surfaces.llmsTxt)) {
    const url = new URL(linkedUrl);
    if (url.origin !== expectedOrigin || getNexusReadinessResponse(url.pathname, surfaces).status !== 200) {
      errors.push(`llms.txt references an unavailable readiness endpoint: ${linkedUrl}`);
    }
  }

  if (
    surfaces.structuredData['@type'] !== 'SoftwareApplication' ||
    surfaces.structuredData.url !== `${expectedOrigin}/`
  ) {
    errors.push('Schema.org data must identify the canonical NEXUS SoftwareApplication.');
  }

  if (
    !surfaces.html.includes('<main id="main-content" tabindex="-1">') ||
    !/<h1(?:\s|>)/.test(surfaces.html)
  ) {
    errors.push('The NEXUS shell must include a labelled main landmark and level-one heading.');
  }

  const jsonLdMatch = surfaces.html.match(
    /<script type="application\/ld\+json">(?<json>.+)<\/script>/,
  );

  try {
    const embeddedData = JSON.parse(jsonLdMatch?.groups?.json ?? '') as Record<string, unknown>;
    if (
      embeddedData['@type'] !== surfaces.structuredData['@type'] ||
      embeddedData.url !== surfaces.structuredData.url
    ) {
      errors.push('Embedded JSON-LD must match the maintained Schema.org data.');
    }
  } catch {
    errors.push('The NEXUS shell must embed its Schema.org JSON-LD.');
  }

  return {
    valid: errors.length === 0,
    checkedRoutes: NEXUS_READINESS_ROUTES,
    errors,
  };
}
import type { GoalState } from '@nexus/goal-state';

import { MISSION_DASHBOARD_STYLES, renderMissionDashboard } from './dashboard.js';
import { createInitialHeroGoalState } from './dashboard-fixtures.js';
