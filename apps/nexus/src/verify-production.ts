import { PRODUCTION_ORIGINS } from '@nexus/environment';

import { verifyProductionOrigins } from './production.js';

export async function runProductionVerification(): Promise<void> {
  const result = await verifyProductionOrigins();
  process.stdout.write('NEXUS Production\n\n');
  for (const origin of Object.values(PRODUCTION_ORIGINS)) {
    const failed = result.errors.some((error) => error.startsWith(`${origin}/`));
    process.stdout.write(`${failed ? '✗' : '✓'} ${origin}\n`);
  }
  if (!result.valid) throw new Error(result.errors.join('\n'));
  process.stdout.write('\nReadiness routes: robots.txt, sitemap.xml, llms.txt ✓\n');
}

const isMain = process.argv[1]?.endsWith('/verify-production.js') === true;
if (isMain) {
  runProductionVerification().catch((error: unknown) => {
    process.stderr.write(`Production verification failed:\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
