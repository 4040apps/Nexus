import { createProviderReadinessSurfaces } from './readiness.js';
import type { AgentReadyProvider } from './types.js';

export function renderAccessibleProviderPage(provider: AgentReadyProvider): string {
  const readiness = createProviderReadinessSurfaces(provider);
  const canonicalUrl = new URL('/', provider.metadata.origin).toString();
  const toolItems = provider.tools
    .map(
      (tool) => `
        <li>
          <article aria-labelledby="tool-${escapeAttribute(tool.name)}">
            <h3 id="tool-${escapeAttribute(tool.name)}">${escapeHtml(tool.title ?? tool.name)}</h3>
            <p>${escapeHtml(tool.description)}</p>
            <p><strong>Operation:</strong> ${escapeHtml(operationLabel(tool.operation))}</p>
          </article>
        </li>`,
    )
    .join('');
  const structuredData = JSON.stringify(readiness.structuredData).replaceAll('<', '\\u003c');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeAttribute(provider.metadata.description)}">
    <link rel="canonical" href="${escapeAttribute(canonicalUrl)}">
    <title>${escapeHtml(provider.metadata.name)}</title>
    <script type="application/ld+json">${structuredData}</script>
  </head>
  <body>
    <a href="#main-content">Skip to main content</a>
    <header>
      <h1>${escapeHtml(provider.metadata.name)}</h1>
      <p>${escapeHtml(provider.metadata.description)}</p>
    </header>
    <main id="main-content" tabindex="-1">
      <section aria-labelledby="capabilities-heading">
        <h2 id="capabilities-heading">Agent-ready capabilities</h2>
        <ul>${toolItems}
        </ul>
      </section>
      <p role="status" aria-live="polite" aria-atomic="true"></p>
    </main>
    <footer>
      <p>Provider: ${escapeHtml(provider.metadata.name)}</p>
    </footer>
  </body>
</html>
`;
}

function operationLabel(operation: AgentReadyProvider['tools'][number]['operation']): string {
  switch (operation) {
    case 'READ':
      return 'Read only';
    case 'PLAN':
      return 'Planning';
    case 'COMMIT':
      return 'Commitment — human approval required';
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
