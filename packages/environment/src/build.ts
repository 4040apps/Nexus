import type { NexusEnvironment, NexusOrigins } from './index.js';

const BUILD_ORIGIN_KEYS = [
  'nexus',
  'officepro',
  'techsupply',
  'fibermx',
  'netbusiness',
  'securenow',
] as const;

declare const __NEXUS_BUILD_ENVIRONMENT__: NexusEnvironment;
declare const __NEXUS_BUILD_ORIGINS__: string;

export function getBuildOriginConfiguration(): {
  environment: NexusEnvironment;
  origins: NexusOrigins;
} {
  const environment = __NEXUS_BUILD_ENVIRONMENT__;
  if (environment !== 'LOCAL' && environment !== 'PRODUCTION') {
    throw new Error('Embedded NEXUS environment must be LOCAL or PRODUCTION.');
  }
  const parsed: unknown = JSON.parse(__NEXUS_BUILD_ORIGINS__);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !BUILD_ORIGIN_KEYS.every(
      (key) => key in parsed && typeof (parsed as Record<string, unknown>)[key] === 'string',
    )
  ) {
    throw new Error('The embedded NEXUS origin map is incomplete or malformed.');
  }
  const origins = parsed as NexusOrigins;
  for (const key of BUILD_ORIGIN_KEYS) {
    const url = new URL(origins[key]);
    if (url.origin !== origins[key]) throw new Error(`Embedded ${key} value must be an origin.`);
    if (environment === 'PRODUCTION' && url.protocol !== 'https:') {
      throw new Error(`Embedded production ${key} origin must use HTTPS.`);
    }
    if (environment === 'LOCAL' && (url.protocol !== 'http:' || url.hostname !== 'localhost')) {
      throw new Error(`Embedded local ${key} origin must use HTTP localhost.`);
    }
  }
  return { environment, origins: Object.freeze({ ...origins }) };
}
