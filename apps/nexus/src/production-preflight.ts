import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTION_ORIGINS, ORIGIN_KEYS } from '@nexus/environment';

import { PRODUCTION_OUTPUT_DIRECTORY } from './build-production.js';
import { assertProductionDeployment, createProductionDeployment } from './production.js';

export async function assertProductionAssets(repositoryRoot: string): Promise<void> {
  assertProductionDeployment(createProductionDeployment());
  const outputRoot = resolve(repositoryRoot, PRODUCTION_OUTPUT_DIRECTORY);
  for (const key of ORIGIN_KEYS) {
    const directory = resolve(outputRoot, key);
    const expected = ['_headers', 'browser.js', 'index.html', 'llms.txt', 'robots.txt', 'sitemap.xml'];
    const expectedFiles = key === 'nexus'
      ? expected.map((name) => name === 'browser.js' ? 'officepro-runtime-client.js' : name)
      : expected;
    const files = await readdir(directory);
    for (const file of expectedFiles) {
      if (!files.includes(file)) throw new Error(`${key} production output is missing ${file}.`);
    }
    for (const file of expectedFiles) {
      const contents = await readFile(resolve(directory, file), 'utf8');
      const insecureConfiguredOrigin = Object.values(PRODUCTION_ORIGINS)
        .map((origin) => origin.replace('https://', 'http://'))
        .find((origin) => contents.includes(origin));
      if (
        contents.includes('http://localhost') ||
        contents.includes('http://127.0.0.1') ||
        insecureConfiguredOrigin
      ) {
        throw new Error(`${key}/${file} contains a local or insecure production origin.`);
      }
    }
    const html = await readFile(resolve(directory, 'index.html'), 'utf8');
    if (!html.includes(PRODUCTION_ORIGINS[key])) {
      throw new Error(`${key} metadata does not reference its exact production origin.`);
    }
  }

  const nexusClient = await readFile(
    resolve(outputRoot, 'nexus/officepro-runtime-client.js'),
    'utf8',
  );
  for (const origin of Object.values(PRODUCTION_ORIGINS).slice(1)) {
    if (!nexusClient.includes(origin)) {
      throw new Error(`NEXUS production discovery is missing ${origin}.`);
    }
  }
  for (const key of ORIGIN_KEYS.filter((candidate) => candidate !== 'nexus')) {
    const browser = await readFile(resolve(outputRoot, key, 'browser.js'), 'utf8');
    if (!browser.includes(PRODUCTION_ORIGINS.nexus)) {
      throw new Error(`${key} does not expose WebMCP tools to the production NEXUS origin.`);
    }
    if (browser.includes('exposedTo:["*"]') || browser.includes("exposedTo: ['*']")) {
      throw new Error(`${key} contains a wildcard WebMCP permission.`);
    }
  }
}

const isMain = process.argv[1]?.endsWith('/production-preflight.js') === true;
if (isMain) {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  assertProductionAssets(repositoryRoot)
    .then(() => process.stdout.write('Production preflight passed: six HTTPS origins, exact WebMCP permissions, no localhost leaks.\n'))
    .catch((error: unknown) => {
      process.stderr.write(`Production preflight failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
