import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const port = Number(process.env.SECURENOW_PORT ?? 4900);
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
  response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SecureNow — office security</title><style>${styles()}</style></head><body><main><p class="brand">Independent provider · localhost:4900</p><h1>SecureNow office security</h1><p>SecureNow owns assessment, package contents, availability, pricing, installation details, and commitment execution on this origin.</p><p class="status" data-registration-status data-status="CHECKING" role="status">Checking WebMCP support…</p><button type="button" data-run-provider-flow>Build a non-binding security plan</button><p class="result" data-provider-output aria-live="polite">No installation has been requested. A human approval is always required.</p></main><script type="module" src="/browser.js"></script></body></html>`);
});
server.listen(port, '127.0.0.1', () => process.stdout.write(`Independent SecureNow provider: ${origin}\n`));

function styles(): string {
  return `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif}body{margin:0;color:#171d2b;background:#eff1f8}main{width:min(100% - 2rem,54rem);margin:auto;padding:2rem 0}.brand{color:#503b91;font-size:.75rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}h1{margin:.35rem 0 .5rem;font-size:clamp(1.8rem,5vw,3rem)}p{max-width:58ch;line-height:1.55}.status,.result{padding:.85rem 1rem;border:1px solid #bbb4d2;border-radius:.65rem;background:#fbfaff}button{margin:.8rem 0;padding:.8rem 1rem;border:0;border-radius:.55rem;color:white;background:#503b91;font:inherit;font-weight:800;cursor:pointer}button:focus-visible{outline:3px solid #271b52;outline-offset:3px}`;
}
