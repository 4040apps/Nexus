import { describe, expect, it } from 'vitest';

import {
  NEXUS_READINESS_ROUTES,
  createNexusReadinessSurfaces,
  getNexusReadinessResponse,
  validateNexusReadinessSurfaces,
} from './readiness.js';

const TEST_ORIGIN = 'https://nexus.example.org';

describe('NEXUS agent-readiness surfaces', () => {
  it('uses a configurable canonical production origin consistently', () => {
    const surfaces = createNexusReadinessSurfaces({ canonicalOrigin: `${TEST_ORIGIN}/` });

    expect(surfaces.canonicalOrigin).toBe(TEST_ORIGIN);
    expect(surfaces.html).toContain(`<link rel="canonical" href="${TEST_ORIGIN}/">`);
    expect(surfaces.structuredData.url).toBe(`${TEST_ORIGIN}/`);
    expect(surfaces.robotsTxt).toContain(`Sitemap: ${TEST_ORIGIN}/sitemap.xml`);
    expect(surfaces.sitemapXml).toContain(`<loc>${TEST_ORIGIN}/</loc>`);
  });

  it('rejects unsafe or ambiguous production identities', () => {
    expect(() => createNexusReadinessSurfaces({ canonicalOrigin: 'http://nexus.example.org' })).toThrow(
      /HTTPS/,
    );
    expect(() => createNexusReadinessSurfaces({ canonicalOrigin: `${TEST_ORIGIN}/app` })).toThrow(
      /path/,
    );
    expect(() => createNexusReadinessSurfaces({ canonicalOrigin: 'not a URL' })).toThrow(
      /absolute URL/,
    );
    expect(() => createNexusReadinessSurfaces({ canonicalOrigin: 'http://localhost:4100' })).not.toThrow();
  });

  it('serves every advertised endpoint with an appropriate content type', () => {
    const surfaces = createNexusReadinessSurfaces({ canonicalOrigin: TEST_ORIGIN });

    expect(surfaces.routes).toEqual(NEXUS_READINESS_ROUTES);
    for (const route of surfaces.routes) {
      const response = getNexusReadinessResponse(route, surfaces);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBeTruthy();
      expect(response.body.trim()).not.toBe('');
    }
    expect(getNexusReadinessResponse('/openapi.json', surfaces).status).toBe(404);
    expect(getNexusReadinessResponse('/.well-known/webmcp.json', surfaces).status).toBe(404);
  });

  it('publishes a useful llms.txt aligned with the real architecture', () => {
    const { llmsTxt } = createNexusReadinessSurfaces({ canonicalOrigin: TEST_ORIGIN });

    expect(llmsTxt).toContain('Brand Mode');
    expect(llmsTxt).toContain('Broker Mode');
    expect(llmsTxt).toContain('Intent Handoff');
    expect(llmsTxt).toContain('explicit human approval');
    expect(llmsTxt).toContain('document.modelContext');
    expect(llmsTxt).toContain('fromOrigins, exposedTo, and iframe allow="tools"');
    expect(llmsTxt).toContain('NEXUS does not proxy provider-owned catalog');
    expect(llmsTxt).not.toContain('/openapi.json');
    expect(llmsTxt).not.toContain('/.well-known/');
  });

  it('embeds truthful and parseable Schema.org metadata without synthetic scores', () => {
    const surfaces = createNexusReadinessSurfaces({ canonicalOrigin: TEST_ORIGIN });
    const script = surfaces.html.match(
      /<script type="application\/ld\+json">(?<json>.+)<\/script>/,
    );
    const structuredData = JSON.parse(script?.groups?.json ?? '{}') as Record<string, unknown>;

    expect(structuredData['@type']).toBe('SoftwareApplication');
    expect(structuredData.url).toBe(`${TEST_ORIGIN}/`);
    expect(structuredData).not.toHaveProperty('aggregateRating');
    expect(structuredData).not.toHaveProperty('review');
    expect(JSON.stringify(surfaces)).not.toMatch(/readinessScore|lighthouseScore|externalScore/);
  });

  it('renders an accessible semantic shell with real discovery links', () => {
    const { html } = createNexusReadinessSurfaces({ canonicalOrigin: TEST_ORIGIN });

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('href="#main-content">Skip to main content</a>');
    expect(html).toContain('<header>');
    expect(html).toContain('<nav aria-label="Machine-readable discovery">');
    expect(html).toContain('<main id="main-content" tabindex="-1">');
    expect(html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(html.match(/<h2(?:\s|>)/g)).toHaveLength(3);
    expect(html).toContain('<footer>');
    expect(html).toContain('a:focus-visible');
    expect(html).not.toMatch(/<button|<form/);
  });

  it('validates references and detects a broken advertised endpoint', () => {
    const surfaces = createNexusReadinessSurfaces({ canonicalOrigin: TEST_ORIGIN });

    expect(validateNexusReadinessSurfaces(surfaces)).toEqual({
      valid: true,
      checkedRoutes: NEXUS_READINESS_ROUTES,
      errors: [],
    });

    const broken = {
      ...surfaces,
      llmsTxt: `${surfaces.llmsTxt}- [Missing](${TEST_ORIGIN}/missing.txt)\n`,
    };
    expect(validateNexusReadinessSurfaces(broken)).toMatchObject({
      valid: false,
      errors: [`llms.txt references an unavailable readiness endpoint: ${TEST_ORIGIN}/missing.txt`],
    });
  });
});
