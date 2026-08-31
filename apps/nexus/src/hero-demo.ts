import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { LOCAL_ORIGINS } from '@nexus/environment';

export type HeroService = {
  label: string;
  origin: string;
  entry: string;
};

export const HERO_SERVICES: readonly HeroService[] = [
  { label: 'NEXUS', origin: LOCAL_ORIGINS.nexus, entry: 'apps/nexus/dist/dashboard-preview.js' },
  { label: 'OfficePro', origin: LOCAL_ORIGINS.officepro, entry: 'apps/officepro/dist/server.js' },
  { label: 'TechSupply', origin: LOCAL_ORIGINS.techsupply, entry: 'apps/techsupply/dist/server.js' },
  { label: 'FiberMX', origin: LOCAL_ORIGINS.fibermx, entry: 'apps/fibermx/dist/server.js' },
  { label: 'NetBusiness', origin: LOCAL_ORIGINS.netbusiness, entry: 'apps/netbusiness/dist/server.js' },
  { label: 'SecureNow', origin: LOCAL_ORIGINS.securenow, entry: 'apps/securenow/dist/server.js' },
];

type FetchLike = (input: string) => Promise<{ ok: boolean }>;

export async function waitForHeroServices(
  services: readonly HeroService[],
  fetcher: FetchLike = fetch,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const pending = new Set(services.map(({ origin }) => origin));

  while (pending.size > 0 && Date.now() < deadline) {
    await Promise.all([...pending].map(async (origin) => {
      try {
        if ((await fetcher(origin)).ok) pending.delete(origin);
      } catch {
        // A server may still be binding its port. Retry until the shared deadline.
      }
    }));
    if (pending.size > 0) await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (pending.size > 0) {
    throw new Error(`Timed out waiting for required origins: ${[...pending].join(', ')}`);
  }
}

export function formatHeroReadyOutput(services: readonly HeroService[]): string {
  const width = Math.max(...services.map(({ label }) => label.length));
  return [
    'NEXUS Hero Demo',
    '',
    ...services.map(({ label, origin }) => `✓ ${label.padEnd(width)} ${origin}`),
    '',
    'Hero demo ready:',
    LOCAL_ORIGINS.nexus,
  ].join('\n');
}

export async function startHeroDemo(): Promise<void> {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const children: Array<{ service: HeroService; process: ChildProcess; exited: boolean }> = [];
  let shuttingDown = false;

  const stopAll = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
      if (!child.exited) child.process.kill('SIGTERM');
    }
  };

  for (const service of HERO_SERVICES) {
    const child = spawn(process.execPath, [resolve(repositoryRoot, service.entry)], {
      cwd: repositoryRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const record = { service, process: child, exited: false };
    children.push(record);
    child.stdout?.on('data', (chunk: Buffer) => {
      process.stdout.write(`[${service.label}] ${chunk.toString()}`);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(`[${service.label}] ${chunk.toString()}`);
    });
    child.on('error', (error) => {
      process.stderr.write(`Failed to start ${service.label}: ${error.message}\n`);
      stopAll();
      process.exitCode = 1;
    });
    child.on('exit', (code, signal) => {
      record.exited = true;
      if (shuttingDown) return;
      process.stderr.write(
        `${service.label} stopped unexpectedly (${signal ? `signal ${signal}` : `exit ${code ?? 1}`}).\n`,
      );
      stopAll();
      process.exitCode = 1;
    });
  }

  process.once('SIGINT', stopAll);
  process.once('SIGTERM', stopAll);

  try {
    await waitForHeroServices(HERO_SERVICES);
    const failed = children.find(({ exited }) => exited);
    if (failed) throw new Error(`${failed.service.label} exited before the demo became ready.`);
    process.stdout.write(`\n${formatHeroReadyOutput(HERO_SERVICES)}\n`);
  } catch (error) {
    stopAll();
    throw error;
  }
}

const isMain = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  startHeroDemo().catch((error: unknown) => {
    process.stderr.write(`Hero demo startup failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
