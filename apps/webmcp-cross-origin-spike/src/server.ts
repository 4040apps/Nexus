import { createServer, type Server } from 'node:http';

import {
  AUTHORIZED_CONSUMER_ORIGIN,
  PROVIDER_ORIGIN,
  UNAUTHORIZED_CONSUMER_ORIGIN,
} from './config.js';

type Harness = {
  servers: readonly Server[];
  close: () => Promise<void>;
};

export function renderConsumerPage(origin: string): string {
  const label = origin === AUTHORIZED_CONSUMER_ORIGIN ? 'Authorized consumer' : 'Unauthorized consumer';
  return html(
    `${label} — WebMCP spike`,
    `<main>
      <h1>${label}</h1>
      <dl>
        <dt>Consumer origin</dt><dd id="consumer-origin">Loading</dd>
        <dt>Expected access</dt><dd id="expected-access">Loading</dd>
        <dt>Provider registration</dt><dd id="provider-ready">Waiting for provider</dd>
        <dt>Runtime</dt><dd id="runtime">Loading</dd>
      </dl>
      <button id="discover-and-invoke" type="button">Discover and invoke provider tool</button>
      <p>Outcome: <strong id="outcome">NOT_RUN</strong></p>
      <pre id="result" aria-live="polite">No result yet.</pre>
      <h2>Independent provider origin</h2>
      <iframe title="Independent Example Provider" src="${PROVIDER_ORIGIN}" allow="tools"></iframe>
    </main>
    <script type="module" src="/consumer.js"></script>`,
  );
}

export function renderProviderPage(): string {
  return html(
    'Example Provider — WebMCP spike',
    `<main>
      <h1>Example Provider</h1>
      <p>This normal provider page works independently of WebMCP.</p>
      <p>Registration: <strong id="registration-status">Starting</strong></p>
      <p>Runtime: <span id="runtime">Loading</span></p>
      <button id="website-check" type="button">Check website availability</button>
      <pre id="website-result" aria-live="polite">No website check yet.</pre>
      <dl>
        <dt>Provider-owned invocations</dt><dd id="invocation-count">0</dd>
        <dt>Last provider-owned call</dt><dd id="provider-owned-call">None</dd>
      </dl>
    </main>
    <script type="module" src="/provider.js"></script>`,
  );
}

export async function startHarness(): Promise<Harness> {
  const servers = [
    await listen(AUTHORIZED_CONSUMER_ORIGIN, renderConsumerPage(AUTHORIZED_CONSUMER_ORIGIN)),
    await listen(PROVIDER_ORIGIN, renderProviderPage()),
    await listen(UNAUTHORIZED_CONSUMER_ORIGIN, renderConsumerPage(UNAUTHORIZED_CONSUMER_ORIGIN)),
  ];

  return {
    servers,
    async close() {
      await Promise.all(servers.map((server) => close(server)));
    },
  };
}

function html(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { max-width: 72rem; margin: 0 auto; padding: 2rem; }
    iframe { width: 100%; min-height: 24rem; border: 2px solid currentColor; }
    dt { font-weight: 700; } dd { margin-bottom: .6rem; }
    pre { padding: 1rem; white-space: pre-wrap; background: CanvasText; color: Canvas; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

async function listen(origin: string, page: string): Promise<Server> {
  const url = new URL(origin);
  const port = Number(url.port);
  const server = createServer(async (request, response) => {
    response.setHeader('Origin-Agent-Cluster', '?1');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (request.url && /^\/[a-zA-Z0-9-]+\.js$/.test(request.url)) {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      response.end(await loadBundle(request.url.slice(1)));
      return;
    }

    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(page);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, url.hostname, resolve);
  });
  return server;
}

async function loadBundle(name: string): Promise<string> {
  const file = new URL(name, import.meta.url);
  return (await import('node:fs/promises')).readFile(file, 'utf8');
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  await startHarness();
  console.log(`Authorized consumer:   ${AUTHORIZED_CONSUMER_ORIGIN}`);
  console.log(`Independent provider: ${PROVIDER_ORIGIN}`);
  console.log(`Unauthorized consumer: ${UNAUTHORIZED_CONSUMER_ORIGIN}`);
}
