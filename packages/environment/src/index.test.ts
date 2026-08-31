import { describe, expect, it } from 'vitest';

import {
  LOCAL_ORIGINS,
  PRODUCTION_ORIGINS,
  OriginConfigurationError,
  assertOriginConfiguration,
  getOrigins,
  getProviderOrigins,
  parseNexusEnvironment,
} from './index.js';

describe('NEXUS environment origins', () => {
  it('keeps the complete local six-origin demo on localhost', () => {
    expect(getOrigins('LOCAL')).toEqual(LOCAL_ORIGINS);
    expect(Object.values(LOCAL_ORIGINS).every((origin) => origin.startsWith('http://localhost:'))).toBe(true);
  });

  it('uses the exact production NEXUS and five provider HTTPS origins', () => {
    expect(PRODUCTION_ORIGINS.nexus).toBe('https://nexus.1expert.pro');
    expect(getProviderOrigins(PRODUCTION_ORIGINS)).toEqual([
      'https://officepro.1expert.pro',
      'https://techsupply.1expert.pro',
      'https://fibermx.1expert.pro',
      'https://netbusiness.1expert.pro',
      'https://securenow.1expert.pro',
    ]);
    expect(JSON.stringify(PRODUCTION_ORIGINS)).not.toContain('localhost');
  });

  it('fails closed for unknown environments and non-HTTPS production origins', () => {
    expect(() => parseNexusEnvironment('staging')).toThrow(OriginConfigurationError);
    expect(() => assertOriginConfiguration('PRODUCTION', {
      ...PRODUCTION_ORIGINS,
      officepro: 'http://officepro.1expert.pro',
    })).toThrow('must be a non-local HTTPS origin');
  });

  it('rejects wildcard, path, and duplicate origin configuration', () => {
    expect(() => assertOriginConfiguration('PRODUCTION', {
      ...PRODUCTION_ORIGINS,
      officepro: '*',
    })).toThrow();
    expect(() => assertOriginConfiguration('PRODUCTION', {
      ...PRODUCTION_ORIGINS,
      officepro: 'https://officepro.1expert.pro/tools',
    })).toThrow('must be an origin');
    expect(() => assertOriginConfiguration('PRODUCTION', {
      ...PRODUCTION_ORIGINS,
      officepro: PRODUCTION_ORIGINS.techsupply,
    })).toThrow('independently addressable');
  });
});
