import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTION_ORIGINS } from '@nexus/environment';

import { createHeroDashboardStates } from './dashboard-fixtures.js';
import { createNexusReadinessSurfaces } from './readiness.js';
import { PROVIDER_SITES, renderProductionProviderPage } from './production.js';

export const PRODUCTION_OUTPUT_DIRECTORY = 'dist/cloudflare';

export async function buildProductionAssets(repositoryRoot: string): Promise<void> {
  const outputRoot = resolve(repositoryRoot, PRODUCTION_OUTPUT_DIRECTORY);
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  const nexusDirectory = resolve(outputRoot, 'nexus');
  await mkdir(nexusDirectory, { recursive: true });
  const surfaces = createNexusReadinessSurfaces({
    canonicalOrigin: PRODUCTION_ORIGINS.nexus,
    goalState: createHeroDashboardStates().initial,
    officeProRuntime: { providerOrigin: PRODUCTION_ORIGINS.officepro },
  });
  const nexusAssets: Readonly<Record<string, string>> = {
    'index.html': surfaces.html,
    'developers/index.html': surfaces.developersHtml,
    'about/index.html': surfaces.aboutHtml,
    'contact/index.html': surfaces.contactHtml,
    'privacy/index.html': surfaces.privacyHtml,
    '404.html': surfaces.notFoundHtml,
    'index.md': surfaces.indexMarkdown,
    'robots.txt': surfaces.robotsTxt,
    'sitemap.xml': surfaces.sitemapXml,
    'llms.txt': surfaces.llmsTxt,
    '.well-known/ard.json': surfaces.ardJson,
    '.well-known/agent-skills/index.json': surfaces.agentSkillsIndexJson,
    '.well-known/agent-skills/continue-procurement-mission/SKILL.md':
      surfaces.heroSkillMarkdown,
    'og-image.svg': surfaces.ogImageSvg,
    _headers: nexusStaticHeaders(PRODUCTION_ORIGINS.nexus),
  };
  await Promise.all(
    Object.keys(nexusAssets).map((relativePath) =>
      mkdir(dirname(resolve(nexusDirectory, relativePath)), { recursive: true }),
    ),
  );
  await Promise.all([
    ...Object.entries(nexusAssets).map(([relativePath, contents]) =>
      writeFile(resolve(nexusDirectory, relativePath), contents),
    ),
    copyFile(
      resolve(repositoryRoot, 'apps/nexus/dist/officepro-runtime-client.js'),
      resolve(nexusDirectory, 'officepro-runtime-client.js'),
    ),
  ]);

  for (const provider of PROVIDER_SITES) {
    const directory = resolve(outputRoot, provider.key);
    const origin = PRODUCTION_ORIGINS[provider.key];
    await mkdir(directory, { recursive: true });
    await Promise.all([
      writeFile(resolve(directory, 'index.html'), renderProductionProviderPage(provider, origin)),
      writeFile(resolve(directory, 'robots.txt'), providerRobots(origin)),
      writeFile(resolve(directory, 'sitemap.xml'), providerSitemap(origin)),
      writeFile(resolve(directory, 'llms.txt'), providerLlms(provider.name, origin)),
      writeFile(resolve(directory, '_headers'), staticHeaders()),
      copyFile(
        resolve(repositoryRoot, `apps/${provider.key}/dist/browser.js`),
        resolve(directory, 'browser.js'),
      ),
    ]);
  }
}

function staticHeaders(): string {
  return `/*\n  Cache-Control: no-store\n  Origin-Agent-Cluster: ?1\n`;
}

function nexusStaticHeaders(origin: string): string {
  return `/*
  Cache-Control: no-store
  Origin-Agent-Cluster: ?1
  Link: <${origin}/index.md>; rel="alternate"; type="text/markdown", <${origin}/.well-known/ard.json>; rel="ard"; type="application/json", <${origin}/.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"
  X-Content-Type-Options: nosniff

/.well-known/*
  Access-Control-Allow-Origin: *
`;
}

function providerRobots(origin: string): string {
  return `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
}

function providerSitemap(origin: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`;
}

function providerLlms(name: string, origin: string): string {
  return `# ${name}\n\n> Independent provider in the NEXUS hero demo.\n\n- Canonical origin: ${origin}\n- Genuine WebMCP tools register through document.modelContext.\n- Provider-owned business data and validation remain on this origin.\n- The normal website remains usable when WebMCP is unavailable.\n`;
}

const isMain = process.argv[1]?.endsWith('/build-production.js') === true;
if (isMain) {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  buildProductionAssets(repositoryRoot)
    .then(() => process.stdout.write(`Production assets built in ${PRODUCTION_OUTPUT_DIRECTORY}.\n`))
    .catch((error: unknown) => {
      process.stderr.write(`Production build failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
