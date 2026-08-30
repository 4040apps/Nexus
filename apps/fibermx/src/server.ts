import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const port = Number(process.env.FIBERMX_PORT ?? 4700);
const origin = `http://localhost:${port}`;
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', origin);
  const headers = { 'cache-control': 'no-store', 'origin-agent-cluster': '?1' };
  if (url.pathname === '/browser.js') {
    response.writeHead(200, { ...headers, 'content-type': 'text/javascript; charset=utf-8' });
    response.end(await readFile(new URL('./browser.js', import.meta.url)));
    return;
  }
  if (url.pathname !== '/') {
    response.writeHead(404, { ...headers, 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found.\n');
    return;
  }
  response.writeHead(200, { ...headers, 'content-type': 'text/html; charset=utf-8' });
  response.end(renderPage());
});
server.listen(port, '127.0.0.1', () => process.stdout.write(`Independent FiberMX provider: ${origin}\n`));

function renderPage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FiberMX — business internet</title><style>${styles('#8f2d22')}</style></head><body><main><p class="brand">Independent provider · localhost:4700</p><h1>FiberMX business internet</h1><p>FiberMX owns its coverage, installation schedule, pricing, and offer constraints on this origin.</p><p class="status" data-registration-status data-status="CHECKING" role="status">Checking WebMCP support…</p><button type="button" data-run-provider-flow>Check Guadalajara installation</button><p class="result" data-provider-output aria-live="polite">The normal provider website is ready.</p></main><script type="module" src="/browser.js"></script></body></html>`;
}

function styles(accent: string): string {
  return `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif}body{margin:0;color:#241b1a;background:#f7eeeb}main{width:min(100% - 2rem,54rem);margin:auto;padding:2rem 0}.brand{color:${accent};font-size:.75rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}h1{margin:.35rem 0 .5rem;font-size:clamp(1.8rem,5vw,3rem)}p{max-width:58ch;line-height:1.55}.status,.result{padding:.85rem 1rem;border:1px solid #cbb1ab;border-radius:.65rem;background:#fffaf8}button{margin:.8rem 0;padding:.8rem 1rem;border:0;border-radius:.55rem;color:white;background:${accent};font:inherit;font-weight:800;cursor:pointer}button:focus-visible{outline:3px solid #35100c;outline-offset:3px}`;
}
