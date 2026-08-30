import { describe, expect, it } from 'vitest';

import { isRequirementStatus, REQUIREMENT_STATUSES } from './index.js';

describe('Goal State contract', () => {
  it('recognizes every canonical requirement status', () => {
    for (const status of REQUIREMENT_STATUSES) {
      expect(isRequirementStatus(status)).toBe(true);
    }
  });

  it('rejects non-canonical requirement statuses', () => {
    expect(isRequirementStatus('REROUTED')).toBe(false);
  });
});
