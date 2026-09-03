import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  NEXUS_READINESS_ROUTES,
  createNexusReadinessSurfaces,
  getNexusReadinessResponse,
  validateNexusReadinessSurfaces,
} from './readiness.js';

const TEST_ORIGIN = 'https://nexus.example.org';
const HERO_SKILL_PATH = '/.well-known/agent-skills/continue-procurement-mission/SKILL.md';

function visibleArticleText(html: string): string {
  const article = html.match(/<article class="content-page">(?<content>.*?)<\/article>/s);
  return (article?.groups?.content ?? '')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/\s+([,.;:!?])/g, '$1')
    .trim();
}

describe('NEXUS agent-readiness surfaces', () => {
  it('uses a configurable canonical production origin consistently', () => {
    const surfaces = createNexusReadinessSurfaces({ canonicalOrigin: `${TEST_ORIGIN}/` });
    const application = surfaces.structuredData['@graph'].find(
      (node) => node['@type'] === 'SoftwareApplication',
    );

    expect(surfaces.canonicalOrigin).toBe(TEST_ORIGIN);
    expect(surfaces.html).toContain(`<link rel="canonical" href="${TEST_ORIGIN}/">`);
    expect(application?.url).toBe(`${TEST_ORIGIN}/`);
    expect(surfaces.robotsTxt).toContain(`Sitemap: ${TEST_ORIGIN}/sitemap.xml`);
    expect(surfaces.robotsTxt).toContain(
      `Agentmap: ${TEST_ORIGIN}/.well-known/ard.json`,
    );
    expect(surfaces.sitemapXml).toContain(`<loc>${TEST_ORIGIN}/</loc>`);
  });

  it('rejects unsafe or ambiguous production identities', () => {
    expect(() =>
      createNexusReadinessSurfaces({ canonicalOrigin: 'http://nexus.example.org' }),
    ).toThrow(/HTTPS/);
    expect(() =>
      createNexusReadinessSurfaces({ canonicalOrigin: `${TEST_ORIGIN}/app` }),
    ).toThrow(/path/);
    expect(() => createNexusReadinessSurfaces({ canonicalOrigin: 'not a URL' })).toThrow(
      /absolute URL/,
    );
    expect(() =>
      createNexusReadinessSurfaces({ canonicalOrigin: 'http://localhost:4100' }),
    ).not.toThrow();
  });

  it('serves every truthful endpoint with an appropriate content type and headers', () => {
    const surfaces = createNexusReadinessSurfaces({ canonicalOrigin: TEST_ORIGIN });

    expect(surfaces.routes).toEqual(NEXUS_READINESS_ROUTES);
    for (const route of surfaces.routes) {
      const response = getNexusReadinessResponse(route, surfaces);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBeTruthy();
      expect(response.headers.link).toContain('rel="alternate"; type="text/markdown"');
      expect(response.body.trim()).not.toBe('');
    }
    expect(
      getNexusReadinessResponse('/.well-known/ard.json', surfaces).headers[
        'access-control-allow-origin'
      ],
    ).toBe('*');
    expect(getNexusReadinessResponse('/openapi.json', surfaces).status).toBe(404);
    expect(getNexusReadinessResponse('/.well-known/webmcp.json', surfaces).status).toBe(404);
    expect(getNexusReadinessResponse('/.well-known/mcp/server-card.json', surfaces).status).toBe(
      404,
    );
  });

  it('publishes useful Markdown aligned with the real architecture and sandbox', () => {
    const { indexMarkdown, llmsTxt } = createNexusReadinessSurfaces({
      canonicalOrigin: TEST_ORIGIN,
    });

    expect(llmsTxt).toContain('## When to use NEXUS');
    expect(llmsTxt).toContain('deterministic public hackathon sandbox');
    expect(llmsTxt).toContain('Brand Mode');
    expect(llmsTxt).toContain('Broker Mode');
    expect(llmsTxt).toContain('explicit human approval');
    expect(llmsTxt).toContain('document.modelContext');
    expect(llmsTxt).toContain('fromOrigins, exposedTo, and iframe allow="tools"');
    expect(llmsTxt).toContain('NEXUS does not proxy provider-owned catalog');
    expect(llmsTxt).toContain('/blob/main/AGENTS.md');
    expect(indexMarkdown).toContain('not a production procurement or payment system');
    expect(indexMarkdown).toContain(`${TEST_ORIGIN}/developers`);
    expect(llmsTxt).not.toContain('/openapi.json');
    expect(llmsTxt).not.toContain('navigator.modelContext');
  });

  it('publishes a complete ARD manifest for only maintained documentation and skill resources', () => {
    const { ardJson } = createNexusReadinessSurfaces({ canonicalOrigin: TEST_ORIGIN });
    const manifest = JSON.parse(ardJson) as {
      entries: Array<Record<string, unknown>>;
    };

    expect(manifest.entries).toHaveLength(2);
    expect(manifest.entries.map((entry) => entry.type)).toEqual([
      'text/markdown',
      'application/ai-skill+md',
    ]);
    for (const entry of manifest.entries) {
      expect(entry.identifier).toMatch(/^urn:air:nexus\.example\.org:/);
      expect(entry.url).toMatch(new RegExp(`^${TEST_ORIGIN}`));
      expect(entry).not.toHaveProperty('data');
      expect(entry.representativeQueries).toHaveLength(2);
    }
    expect(ardJson).not.toMatch(/openapi|oauth|mcp-server|agent-card|payment/i);
  });

  it('publishes one real Agent Skills artifact with a byte-accurate digest', () => {
    const surfaces = createNexusReadinessSurfaces({ canonicalOrigin: TEST_ORIGIN });
    const index = JSON.parse(surfaces.agentSkillsIndexJson) as {
      $schema: string;
      skills: Array<{ name: string; type: string; url: string; digest: string }>;
    };
    const skill = index.skills[0];
    const expectedDigest = createHash('sha256')
      .update(surfaces.heroSkillMarkdown)
      .digest('hex');

    expect(index.$schema).toBe('https://schemas.agentskills.io/discovery/0.2.0/schema.json');
    expect(index.skills).toHaveLength(1);
    expect(skill).toEqual({
      name: 'continue-procurement-mission',
      type: 'skill-md',
      description:
        'Demonstrate NEXUS intent continuity by completing its deterministic office-opening hero flow while preserving provider independence and explicit human approval.',
      url: `${TEST_ORIGIN}${HERO_SKILL_PATH}`,
      digest: `sha256:${expectedDigest}`,
    });
    expect(surfaces.heroSkillMarkdown).toMatch(
      /^---\nname: continue-procurement-mission\ndescription:/,
    );
    expect(surfaces.heroSkillMarkdown).toContain('REQUIRES_HUMAN');
    expect(surfaces.heroSkillMarkdown).toContain('--enable-features=WebMCP');
  });

  it('embeds truthful linked Schema.org metadata without synthetic scores', () => {
    const surfaces = createNexusReadinessSurfaces({ canonicalOrigin: TEST_ORIGIN });
    const script = surfaces.html.match(
      /<script type="application\/ld\+json">(?<json>.+)<\/script>/,
    );
    const structuredData = JSON.parse(script?.groups?.json ?? '{}') as {
      '@graph': Array<Record<string, unknown>>;
    };

    expect(structuredData['@graph'].map((node) => node['@type'])).toEqual([
      'Organization',
      'WebSite',
      'SoftwareApplication',
    ]);
    expect(JSON.stringify(structuredData)).toContain('https://github.com/4040apps/Nexus');
    expect(structuredData).not.toHaveProperty('aggregateRating');
    expect(structuredData).not.toHaveProperty('review');
    expect(JSON.stringify(surfaces)).not.toMatch(
      /readinessScore|lighthouseScore|externalScore/,
    );
  });

  it('renders semantic pages, metadata, a sandbox disclosure, and an agent-friendly 404', () => {
    const surfaces = createNexusReadinessSurfaces({ canonicalOrigin: TEST_ORIGIN });
    const notFound = getNexusReadinessResponse('/missing', surfaces);

    expect(surfaces.html).toContain('<html lang="en">');
    expect(surfaces.html).toContain('href="#main-content">Skip to main content</a>');
    expect(surfaces.html).toContain('<nav aria-label="Primary navigation">');
    expect(surfaces.html).toContain('<main id="main-content" tabindex="-1">');
    expect(surfaces.html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(surfaces.html).toContain('<meta property="og:type" content="website">');
    expect(surfaces.html).toContain(`<meta property="og:image" content="${TEST_ORIGIN}/og-image.svg">`);
    expect(surfaces.html).toContain(
      `<link rel="alternate" type="text/markdown" href="${TEST_ORIGIN}/index.md"`,
    );
    expect(surfaces.html).toContain('Public hackathon sandbox.');
    expect(surfaces.developersHtml).toContain('not a public HTTP API');
    expect(surfaces.developersHtml).toContain('Chrome 151 is not claimed');
    expect(surfaces.aboutHtml).toContain('What this is not');
    expect(surfaces.privacyHtml).toContain('Use synthetic information only');
    expect(surfaces.contactHtml).toContain('/issues');
    expect(notFound.status).toBe(404);
    expect(notFound.headers['content-type']).toContain('text/html');
    expect(notFound.body).toContain('/sitemap.xml');
    expect(notFound.body).toContain('/llms.txt');
    expect(notFound.body).toContain('/developers');
    expect(surfaces.html).toContain('a:focus-visible');
  });

  it('keeps every trust-anchor page substantive and fact-specific', () => {
    const surfaces = createNexusReadinessSurfaces({ canonicalOrigin: TEST_ORIGIN });
    const trustPages = [
      ['about', surfaces.aboutHtml],
      ['contact', surfaces.contactHtml],
      ['privacy', surfaces.privacyHtml],
    ] as const;

    for (const [name, html] of trustPages) {
      expect(visibleArticleText(html).length, `${name} visible prose`).toBeGreaterThanOrEqual(500);
    }

    const contact = visibleArticleText(surfaces.contactHtml);
    expect(contact).toContain('maintained publicly by 4040apps');
    expect(contact).toContain('GitHub Issues is the public support and bug-report channel');
    expect(contact).toContain('steps needed to reproduce it');
    expect(contact).toContain('GitHub Issues are public');
    expect(contact).toContain('Do not submit passwords, access tokens, credentials');

    const privacy = visibleArticleText(surfaces.privacyHtml);
    expect(privacy).toContain('no user accounts, login, authentication service, payment flow');
    expect(privacy).toContain('deterministic synthetic data');
    expect(privacy).toContain('does not intentionally ask for or collect');
    expect(privacy).toContain('Cloudflare, GitHub, a browser, a network operator');
    expect(privacy).toContain('GitHub Issues, but those issues are public');
  });

  it('validates the complete graph and detects a broken advertised endpoint', () => {
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
      errors: [`readiness Markdown references an unavailable resource: ${TEST_ORIGIN}/missing.txt`],
    });
  });
});
