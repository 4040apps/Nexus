import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const port = Number(process.env.OFFICEPRO_PORT ?? 4500);
const origin = `http://localhost:${port}`;

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', origin);

  if (url.pathname === '/browser.js') {
    const bundle = await readFile(new URL('./browser.js', import.meta.url));
    response.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(bundle);
    return;
  }

  if (url.pathname !== '/') {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found.\n');
    return;
  }

  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(renderProviderPage());
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Independent OfficePro provider: ${origin}\n`);
});

function renderProviderPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OfficePro — Guadalajara furniture</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; color: #172033; background: #f5f0e8; }
    main { width: min(100% - 2rem, 54rem); margin: 0 auto; padding: 2rem 0; }
    .brand { color: #8b3e22; font-size: .75rem; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: .35rem 0 .5rem; font-size: clamp(1.8rem, 5vw, 3rem); letter-spacing: -.04em; }
    p { max-width: 58ch; line-height: 1.55; }
    .status, .result { padding: .85rem 1rem; border: 1px solid #c8b9a5; border-radius: .65rem; background: #fffaf2; }
    button { margin: .8rem 0; padding: .8rem 1rem; border: 0; border-radius: .55rem; color: white; background: #8b3e22; font: inherit; font-weight: 800; cursor: pointer; }
    button:disabled { cursor: wait; opacity: .6; }
  </style>
</head>
<body>
  <main>
    <p class="brand">Independent provider · localhost:4500</p>
    <h1>OfficePro furniture</h1>
    <p>OfficePro owns its catalog, stock, pricing, package rules, and delivery constraints on this origin.</p>
    <p class="status" data-registration-status data-status="CHECKING" role="status">Checking WebMCP support…</p>
    <button type="button" data-run-provider-flow>Check the OfficePro package</button>
    <p class="result" data-provider-output aria-live="polite">The normal provider website is ready.</p>
  </main>
  <script type="module" src="/browser.js"></script>
</body>
</html>`;
}
