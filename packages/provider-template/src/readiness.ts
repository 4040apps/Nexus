import type { AgentReadyProvider, ProviderReadinessSurfaces } from './types.js';

export function createProviderReadinessSurfaces(
  provider: AgentReadyProvider,
): ProviderReadinessSurfaces {
  const homeUrl = new URL('/', provider.metadata.origin).toString();
  const sitemapUrl = new URL('/sitemap.xml', provider.metadata.origin).toString();
  const capabilities = provider.tools.map((tool) => tool.name);

  return {
    robotsTxt: [`User-agent: *`, `Allow: /`, `Sitemap: ${sitemapUrl}`, ''].join('\n'),
    sitemapXml: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      `  <url><loc>${escapeXml(homeUrl)}</loc></url>`,
      '</urlset>',
      '',
    ].join('\n'),
    llmsTxt: [
      `# ${provider.metadata.name}`,
      '',
      provider.metadata.description,
      '',
      `Canonical URL: ${homeUrl}`,
      `Service areas: ${provider.metadata.serviceAreas.join(', ')}`,
      `Capabilities: ${capabilities.join(', ')}`,
      '',
      'Tools are exposed through document.modelContext on the provider website.',
      '',
    ].join('\n'),
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${homeUrl}#organization`,
      name: provider.metadata.name,
      description: provider.metadata.description,
      url: homeUrl,
      areaServed: [...provider.metadata.serviceAreas],
      knowsAbout: [...provider.metadata.categories],
    },
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
