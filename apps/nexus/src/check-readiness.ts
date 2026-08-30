import {
  createNexusReadinessSurfaces,
  validateNexusReadinessSurfaces,
} from './readiness.js';

const canonicalOrigin = process.argv.slice(2).find((argument) => argument !== '--');

if (!canonicalOrigin) {
  throw new TypeError(
    'Usage: node dist/check-readiness.js <canonical-origin> (HTTPS, or HTTP for localhost)',
  );
}

const surfaces = createNexusReadinessSurfaces({ canonicalOrigin });
const result = validateNexusReadinessSurfaces(surfaces);

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

if (!result.valid) {
  process.exitCode = 1;
}
