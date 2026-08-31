import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import {
  HERO_DASHBOARD_STATE_NAMES,
  createHeroDashboardStates,
} from './dashboard-fixtures.js';
import type { HeroDashboardStateName } from './dashboard-fixtures.js';
import {
  createNexusReadinessSurfaces,
  getNexusReadinessResponse,
} from './readiness.js';

const port = Number(process.env.NEXUS_DASHBOARD_PORT ?? 4400);
const origin = `http://localhost:${port}`;
const states = createHeroDashboardStates();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', origin);

  if (url.pathname === '/officepro-runtime-client.js') {
    const bundle = await readFile(new URL('./officepro-runtime-client.js', import.meta.url));
    response.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(bundle);
    return;
  }

  const requestedState = url.searchParams.get('state');
  const stateName = isHeroDashboardStateName(requestedState) ? requestedState : 'initial';
  const surfaces = createNexusReadinessSurfaces({
    canonicalOrigin: origin,
    goalState: states[stateName],
    ...(requestedState === null
      ? { officeProRuntime: { providerOrigin: 'http://localhost:4500' } }
      : {}),
  });
  const readinessResponse = getNexusReadinessResponse(url.pathname, surfaces);

  response.writeHead(readinessResponse.status, {
    ...readinessResponse.headers,
    'cache-control': 'no-store',
    'origin-agent-cluster': '?1',
  });
  response.end(readinessResponse.body);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`NEXUS Mission Dashboard preview: ${origin}\n`);
  process.stdout.write('Live OfficePro → handoff → TechSupply → FiberMX → NetBusiness → SecureNow flow: open without a ?state fixture.\n');
  process.stdout.write(`States: ${HERO_DASHBOARD_STATE_NAMES.join(', ')}\n`);
});

function isHeroDashboardStateName(value: string | null): value is HeroDashboardStateName {
  return (
    value !== null && (HERO_DASHBOARD_STATE_NAMES as readonly string[]).includes(value)
  );
}
