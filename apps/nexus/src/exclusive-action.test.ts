import { describe, expect, it, vi } from 'vitest';

import { ExclusiveActionRunner } from './exclusive-action.js';

describe('judge action duplicate protection', () => {
  it('runs only the first rapid action and unlocks after it settles', async () => {
    let release: (() => void) | undefined;
    const operation = vi.fn(() => new Promise<void>((resolve) => {
      release = resolve;
    }));
    const changes = vi.fn();
    const runner = new ExclusiveActionRunner<'APPROVE' | 'RESET'>(changes);

    const first = runner.run('APPROVE', operation);
    const duplicate = runner.run('APPROVE', operation);
    const conflictingReset = runner.run('RESET', operation);

    await expect(duplicate).resolves.toBe(false);
    await expect(conflictingReset).resolves.toBe(false);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(runner.active).toBe('APPROVE');

    release?.();
    await expect(first).resolves.toBe(true);
    expect(runner.active).toBeUndefined();
    await expect(runner.run('RESET', async () => undefined)).resolves.toBe(true);
    expect(changes).toHaveBeenCalledTimes(4);
  });
});
