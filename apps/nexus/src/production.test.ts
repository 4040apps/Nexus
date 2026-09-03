import { describe, expect, it, vi } from 'vitest';
import { PRODUCTION_ORIGINS } from '@nexus/environment';

import {
  PRODUCTION_READINESS_PATHS,
  PROVIDER_SITES,
  assertProductionDeployment,
  createProductionDeployment,
  renderProductionProviderPage,
  verifyProductionOrigins,
} from './production.js';

describe('production deployment contract', () => {
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
