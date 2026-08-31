import { describe, expect, it, vi } from 'vitest';

import {
  HERO_SERVICES,
  formatHeroReadyOutput,
  waitForHeroServices,
} from './hero-demo.js';

describe('hero demo launcher', () => {
  it('defines the exact six independent origins and clear ready output', () => {
    expect(HERO_SERVICES.map(({ label, origin }) => [label, origin])).toEqual([
      ['NEXUS', 'http://localhost:4400'],
      ['OfficePro', 'http://localhost:4500'],
      ['TechSupply', 'http://localhost:4600'],
      ['FiberMX', 'http://localhost:4700'],
      ['NetBusiness', 'http://localhost:4800'],
      ['SecureNow', 'http://localhost:4900'],
    ]);
    const output = formatHeroReadyOutput(HERO_SERVICES);
    expect(output).toContain('NEXUS Hero Demo');
    expect(output).toContain('Hero demo ready:\nhttp://localhost:4400');
    for (const { label, origin } of HERO_SERVICES) {
      expect(output).toContain(label);
      expect(output).toContain(origin);
    }
  });

  it('waits for every origin and fails with the missing origin', async () => {
    const attempts = new Map<string, number>();
    const eventuallyReady = vi.fn(async (origin: string) => {
      const count = (attempts.get(origin) ?? 0) + 1;
      attempts.set(origin, count);
      return { ok: count > 1 };
    });
    await expect(waitForHeroServices(HERO_SERVICES, eventuallyReady, 500)).resolves.toBeUndefined();

    const missing = HERO_SERVICES.at(-1)?.origin ?? '';
    await expect(waitForHeroServices(HERO_SERVICES, async (origin) => ({ ok: origin !== missing }), 25))
      .rejects.toThrow(missing);
  });
});
