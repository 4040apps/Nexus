export const NEXUS_ENVIRONMENTS = ['LOCAL', 'PRODUCTION'] as const;

export type NexusEnvironment = (typeof NEXUS_ENVIRONMENTS)[number];

export const ORIGIN_KEYS = [
  'nexus',
  'officepro',
  'techsupply',
  'fibermx',
  'netbusiness',
  'securenow',
] as const;

export type OriginKey = (typeof ORIGIN_KEYS)[number];
export type NexusOrigins = Readonly<Record<OriginKey, string>>;

export const LOCAL_ORIGINS: NexusOrigins = Object.freeze({
  nexus: 'http://localhost:4400',
  officepro: 'http://localhost:4500',
  techsupply: 'http://localhost:4600',
  fibermx: 'http://localhost:4700',
  netbusiness: 'http://localhost:4800',
  securenow: 'http://localhost:4900',
});

export const PRODUCTION_ORIGINS: NexusOrigins = Object.freeze({
  nexus: 'https://nexus.1expert.pro',
  officepro: 'https://officepro.1expert.pro',
  techsupply: 'https://techsupply.1expert.pro',
  fibermx: 'https://fibermx.1expert.pro',
  netbusiness: 'https://netbusiness.1expert.pro',
  securenow: 'https://securenow.1expert.pro',
});

export const PROVIDER_ORIGIN_KEYS = ORIGIN_KEYS.filter(
  (key): key is Exclude<OriginKey, 'nexus'> => key !== 'nexus',
);

export class OriginConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OriginConfigurationError';
  }
}

export function parseNexusEnvironment(value: unknown): NexusEnvironment {
  if (value === 'LOCAL' || value === 'PRODUCTION') return value;
  throw new OriginConfigurationError(
    `NEXUS environment must be LOCAL or PRODUCTION; received ${String(value)}.`,
  );
}

export function getOrigins(environment: NexusEnvironment): NexusOrigins {
  const origins = environment === 'LOCAL' ? LOCAL_ORIGINS : PRODUCTION_ORIGINS;
  assertOriginConfiguration(environment, origins);
  return origins;
}

export function getProviderOrigins(origins: NexusOrigins): readonly string[] {
  return PROVIDER_ORIGIN_KEYS.map((key) => origins[key]);
}

export function assertOriginConfiguration(
  environment: NexusEnvironment,
  origins: NexusOrigins,
): void {
  const seen = new Set<string>();
  for (const key of ORIGIN_KEYS) {
    const candidate = origins[key];
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new OriginConfigurationError(`${environment}.${key} must be an absolute URL.`);
    }
    if (url.origin !== candidate || url.username || url.password) {
      throw new OriginConfigurationError(`${environment}.${key} must be an origin without credentials or a path.`);
    }
    if (seen.has(candidate)) {
      throw new OriginConfigurationError(`${environment}.${key} must be independently addressable.`);
    }
    seen.add(candidate);

    if (environment === 'PRODUCTION') {
      if (url.protocol !== 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        throw new OriginConfigurationError(`${environment}.${key} must be a non-local HTTPS origin.`);
      }
    } else if (url.protocol !== 'http:' || url.hostname !== 'localhost') {
      throw new OriginConfigurationError(`${environment}.${key} must be an HTTP localhost origin.`);
    }
  }
}

export function createBuildOriginDefine(environmentValue: unknown): Record<string, string> {
  const environment = parseNexusEnvironment(environmentValue ?? 'LOCAL');
  const origins = getOrigins(environment);
  return {
    __NEXUS_BUILD_ENVIRONMENT__: JSON.stringify(environment),
    __NEXUS_BUILD_ORIGINS__: JSON.stringify(JSON.stringify(origins)),
  };
}
