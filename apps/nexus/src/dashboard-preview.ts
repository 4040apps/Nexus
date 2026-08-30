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

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', origin);
  const requestedState = url.searchParams.get('state');
  const stateName = isHeroDashboardStateName(requestedState) ? requestedState : 'initial';
  const surfaces = createNexusReadinessSurfaces({
    canonicalOrigin: origin,
    goalState: states[stateName],
  });
  const readinessResponse = getNexusReadinessResponse(url.pathname, surfaces);

  response.writeHead(readinessResponse.status, {
    ...readinessResponse.headers,
    'cache-control': 'no-store',
  });
  response.end(readinessResponse.body);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`NEXUS Mission Dashboard preview: ${origin}\n`);
  process.stdout.write(`States: ${HERO_DASHBOARD_STATE_NAMES.join(', ')}\n`);
});

function isHeroDashboardStateName(value: string | null): value is HeroDashboardStateName {
  return (
    value !== null && (HERO_DASHBOARD_STATE_NAMES as readonly string[]).includes(value)
  );
}
