import { describe, expect, it } from 'vitest';

import { defineIntentHandoff } from './index.js';

describe('Intent Handoff contract', () => {
  it('preserves only explicitly authorized continuation data', () => {
    const handoff = defineIntentHandoff({
      goalId: 'goal-1',
      sourceProviderId: 'officepro',
      authorizedByUser: true,
      constraints: {
        city: 'Guadalajara',
        deadline: '2026-10-01',
        remainingBudget: 300_000,
        currency: 'MXN',
      },
      remainingRequirements: [{ id: 'computers', type: 'computer', quantity: 20 }],
    });

    expect(handoff.authorizedByUser).toBe(true);
    expect(handoff.remainingRequirements).toHaveLength(1);
  });
});
