import {
  PRODUCTION_ORIGINS,
  PROVIDER_ORIGIN_KEYS,
  assertOriginConfiguration,
  getProviderOrigins,
} from '@nexus/environment';
import type { NexusOrigins, OriginKey } from '@nexus/environment';

export type ProductionDeployment = {
  environment: 'PRODUCTION';
  origins: NexusOrigins;
  providerExposedTo: Readonly<Record<Exclude<OriginKey, 'nexus'>, readonly string[]>>;
  discoveryFromOrigins: readonly string[];
};

export type ProductionVerification = {
  valid: boolean;
  checkedUrls: readonly string[];
  errors: readonly string[];
};

export const PRODUCTION_READINESS_PATHS = [
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
  '/.well-known/agent-skills/continue-procurement-mission/SKILL.md',
  '/favicon.svg',
  '/og-image.svg',
] as const;

export function createProductionDeployment(): ProductionDeployment {
  const providerExposedTo: ProductionDeployment['providerExposedTo'] = {
    officepro: [PRODUCTION_ORIGINS.nexus],
    techsupply: [PRODUCTION_ORIGINS.nexus],
    fibermx: [PRODUCTION_ORIGINS.nexus],
    netbusiness: [PRODUCTION_ORIGINS.nexus],
    securenow: [PRODUCTION_ORIGINS.nexus],
  };
  return {
    environment: 'PRODUCTION',
    origins: PRODUCTION_ORIGINS,
    providerExposedTo,
    discoveryFromOrigins: getProviderOrigins(PRODUCTION_ORIGINS),
  };
}

export function assertProductionDeployment(deployment: ProductionDeployment): void {
  if (deployment.environment !== 'PRODUCTION') {
    throw new Error('Production deployment preflight requires the PRODUCTION environment.');
  }
  assertOriginConfiguration('PRODUCTION', deployment.origins);
  if (deployment.origins.nexus !== PRODUCTION_ORIGINS.nexus) {
    throw new Error(`Production NEXUS origin must be ${PRODUCTION_ORIGINS.nexus}.`);
  }
  const expectedProviders = getProviderOrigins(PRODUCTION_ORIGINS);
  if (JSON.stringify(deployment.discoveryFromOrigins) !== JSON.stringify(expectedProviders)) {
    throw new Error('NEXUS discovery must use the exact five production provider origins.');
  }
  for (const key of PROVIDER_ORIGIN_KEYS) {
    const exposedTo = deployment.providerExposedTo[key];
    if (
      exposedTo.length !== 1 ||
      exposedTo[0] !== PRODUCTION_ORIGINS.nexus ||
      exposedTo.includes('*')
    ) {
      throw new Error(`${key} exposedTo must contain only ${PRODUCTION_ORIGINS.nexus}.`);
    }
  }
}

export async function verifyProductionOrigins(
  fetcher: typeof fetch = fetch,
): Promise<ProductionVerification> {
  const deployment = createProductionDeployment();
  assertProductionDeployment(deployment);
  const checkedUrls = [
    ...Object.values(deployment.origins).map((origin) => `${origin}/`),
    ...PRODUCTION_READINESS_PATHS.map((path) => `${deployment.origins.nexus}${path}`),
  ];
  const errors: string[] = [];
  for (const url of checkedUrls) {
    try {
      const response = await fetcher(url, { redirect: 'error' });
      if (!response.ok) errors.push(`${url} returned HTTP ${response.status}.`);
    } catch (error) {
      errors.push(`${url} could not be reached: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { valid: errors.length === 0, checkedUrls, errors };
}

export type ProviderSiteDescriptor = {
  key: Exclude<OriginKey, 'nexus'>;
  name: string;
  title: string;
  description: string;
  action: string;
};

export const PROVIDER_SITES: readonly ProviderSiteDescriptor[] = [
  { key: 'officepro', name: 'OfficePro', title: 'OfficePro furniture', description: 'catalog, stock, pricing, package rules, and delivery constraints', action: 'Check the OfficePro package' },
  { key: 'techsupply', name: 'TechSupply', title: 'TechSupply computers', description: 'computer catalog, inventory, pricing, and delivery constraints', action: 'Check the computer package' },
  { key: 'fibermx', name: 'FiberMX', title: 'FiberMX connectivity', description: 'coverage, installation schedule, pricing, and deadline constraints', action: 'Check Guadalajara availability' },
  { key: 'netbusiness', name: 'NetBusiness', title: 'NetBusiness connectivity', description: 'coverage, installation schedule, pricing, and offer constraints', action: 'Check Guadalajara offer' },
  { key: 'securenow', name: 'SecureNow', title: 'SecureNow office security', description: 'assessment, package contents, pricing, installation details, and commitment execution', action: 'Build a non-binding security plan' },
] as const;

export function renderProductionProviderPage(
  descriptor: ProviderSiteDescriptor,
  origin: string,
): string {
  const canonical = new URL(origin);
  if (canonical.protocol !== 'https:' || canonical.origin !== origin) {
    throw new Error(`${descriptor.name} production metadata requires an exact HTTPS origin.`);
  }
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: descriptor.name,
    url: `${origin}/`,
    description: `Independent agent-ready provider for the NEXUS Guadalajara office demo.`,
  }).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${descriptor.name} is an independent agent-ready provider for the NEXUS demo.">
<link rel="canonical" href="${origin}/"><title>${descriptor.title}</title>
<script type="application/ld+json">${structuredData}</script>
<style>:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif}body{margin:0;color:#172033;background:#f3f5fa}main{width:min(100% - 2rem,54rem);margin:auto;padding:2rem 0}.brand{color:#3157a4;font-size:.75rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}h1{margin:.35rem 0 .5rem;font-size:clamp(1.8rem,5vw,3rem)}p{max-width:58ch;line-height:1.55}.status,.result{padding:.85rem 1rem;border:1px solid #b7c3d8;border-radius:.65rem;background:white}button{margin:.8rem 0;padding:.8rem 1rem;border:0;border-radius:.55rem;color:white;background:#3157a4;font:inherit;font-weight:800;cursor:pointer}button:focus-visible{outline:3px solid #142c5c;outline-offset:3px}</style></head>
<body><main><p class="brand">Independent provider · ${origin}</p><h1>${descriptor.title}</h1>
<p>${descriptor.name} owns its ${descriptor.description} on this origin.</p>
<p class="status" data-registration-status data-status="CHECKING" role="status">Checking WebMCP support…</p>
<button type="button" data-run-provider-flow>${descriptor.action}</button>
<p class="result" data-provider-output aria-live="polite">The normal provider website is ready.</p>
</main><script type="module" src="/browser.js"></script></body></html>`;
}
