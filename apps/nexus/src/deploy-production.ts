import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertProductionAssets } from './production-preflight.js';
import { PROVIDER_SITES } from './production.js';

export async function deployProduction(repositoryRoot: string): Promise<void> {
  await assertProductionAssets(repositoryRoot);
  const deployments = ['nexus', ...PROVIDER_SITES.map(({ key }) => key)];
  for (const deployment of deployments) {
    const config = resolve(repositoryRoot, `cloudflare/${deployment}/wrangler.jsonc`);
    const result = spawnSync('pnpm', ['exec', 'wrangler', 'deploy', '--config', config], {
      cwd: repositoryRoot,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      throw new Error(`Wrangler deployment failed for ${deployment}.`);
    }
  }
}

const isMain = process.argv[1]?.endsWith('/deploy-production.js') === true;
if (isMain) {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  deployProduction(repositoryRoot).catch((error: unknown) => {
    process.stderr.write(`Production deployment failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
