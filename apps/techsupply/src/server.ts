import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const port = Number(process.env.TECHSUPPLY_PORT ?? 4600);
const origin = `http://localhost:${port}`;

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', origin);
  const commonHeaders = {
    'cache-control': 'no-store',
    'origin-agent-cluster': '?1',
  };

  if (url.pathname === '/browser.js') {
    const bundle = await readFile(new URL('./browser.js', import.meta.url));
    response.writeHead(200, {
      ...commonHeaders,
      'content-type': 'text/javascript; charset=utf-8',
    });
    response.end(bundle);
    return;
  }

  if (url.pathname !== '/') {
    response.writeHead(404, { ...commonHeaders, 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found.\n');
    return;
  }

  response.writeHead(200, {
    ...commonHeaders,
    'content-type': 'text/html; charset=utf-8',
  });
  response.end(renderProviderPage());
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Independent TechSupply provider: ${origin}\n`);
});

function renderProviderPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TechSupply — Guadalajara computers</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; color: #182031; background: #eef3f8; }
    main { width: min(100% - 2rem, 54rem); margin: 0 auto; padding: 2rem 0; }
    .brand { color: #195c8d; font-size: .75rem; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: .35rem 0 .5rem; font-size: clamp(1.8rem, 5vw, 3rem); letter-spacing: -.04em; }
    p { max-width: 58ch; line-height: 1.55; }
    .status, .result { padding: .85rem 1rem; border: 1px solid #aebfd0; border-radius: .65rem; background: #f9fcff; }
    button { margin: .8rem 0; padding: .8rem 1rem; border: 0; border-radius: .55rem; color: white; background: #195c8d; font: inherit; font-weight: 800; cursor: pointer; }
    button:focus-visible { outline: 3px solid #0b2940; outline-offset: 3px; }
    button:disabled { cursor: wait; opacity: .6; }
  </style>
</head>
<body>
  <main>
    <p class="brand">Independent provider · localhost:4600</p>
    <h1>TechSupply computers</h1>
    <p>TechSupply owns its catalog, item identifiers, inventory, unit pricing, package rules, and delivery dates on this origin.</p>
    <p class="status" data-registration-status data-status="CHECKING" role="status">Checking WebMCP support…</p>
    <button type="button" data-run-provider-flow>Check the 20-computer package</button>
    <p class="result" data-provider-output aria-live="polite">The normal provider website is ready.</p>
  </main>
  <script type="module" src="/browser.js"></script>
</body>
</html>`;
}
