import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';
import { PRODUCTION_ORIGINS } from '@nexus/environment';

import { STATIC_ASSET_CACHE_CONTROL } from './build-production.js';
import {
  PRODUCTION_READINESS_PATHS,
  PROVIDER_SITES,
  assertProductionDeployment,
  createProductionDeployment,
  renderProductionProviderPage,
  verifyProductionOrigins,
} from './production.js';

describe('production deployment contract', () => {
  it('keeps NEXUS directory pages canonical and serves the generated 404 page', () => {
    const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    const wranglerConfig = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'cloudflare/nexus/wrangler.jsonc'), 'utf8'),
    ) as {
      assets?: {
        directory?: string;
        html_handling?: string;
        not_found_handling?: string;
      };
    };

    expect(wranglerConfig.assets).toEqual({
      directory: '../../dist/cloudflare/nexus',
      html_handling: 'drop-trailing-slash',
      not_found_handling: '404-page',
    });
  });

  it('uses revalidated static caching without disabling back/forward cache', () => {
    expect(STATIC_ASSET_CACHE_CONTROL).toBe('public, max-age=0, must-revalidate');
  });

  it('uses exact exposedTo and fromOrigins boundaries without wildcards', () => {
    const deployment = createProductionDeployment();
    expect(() => assertProductionDeployment(deployment)).not.toThrow();
    expect(Object.values(deployment.providerExposedTo)).toEqual(Array(5).fill([PRODUCTION_ORIGINS.nexus]));
    expect(JSON.stringify(deployment)).not.toContain('"*"');
    expect(deployment.discoveryFromOrigins).toEqual(Object.values(PRODUCTION_ORIGINS).slice(1));
  });

  it('fails visibly when permissions or discovery origins drift', () => {
    const deployment = createProductionDeployment();
    expect(() => assertProductionDeployment({
      ...deployment,
      providerExposedTo: { ...deployment.providerExposedTo, officepro: ['*'] },
    })).toThrow('exposedTo');
    expect(() => assertProductionDeployment({
      ...deployment,
      discoveryFromOrigins: ['http://localhost:4600'],
    })).toThrow('exact five');
  });

  it('renders canonical production provider metadata', () => {
    for (const provider of PROVIDER_SITES) {
      const html = renderProductionProviderPage(provider, PRODUCTION_ORIGINS[provider.key]);
      expect(html).toContain(`<link rel="canonical" href="${PRODUCTION_ORIGINS[provider.key]}/">`);
      expect(html).not.toContain('localhost');
    }
  });

  it('reports success only after all origins and readiness routes respond', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok', { status: 200 }));
    const result = await verifyProductionOrigins(fetcher);
    expect(result.valid).toBe(true);
    const expectedCount = Object.keys(PRODUCTION_ORIGINS).length + PRODUCTION_READINESS_PATHS.length;
    expect(result.checkedUrls).toHaveLength(expectedCount);
    expect(fetcher).toHaveBeenCalledTimes(expectedCount);
  });

  it('returns a failed verification for an unavailable required origin', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      return new Response('status', { status: url.includes('fibermx') ? 503 : 200 });
    });
    const result = await verifyProductionOrigins(fetcher);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['https://fibermx.1expert.pro/ returned HTTP 503.']);
  });
});
