import { describe, expect, it } from 'vitest';

import {
  canTransitionRequirement,
  createGoalState,
  GoalStateError,
  isRequirementStatus,
  REQUIREMENT_STATUSES,
  rerouteRequirement,
  transitionRequirement,
} from './index.js';
import type {
  GoalState,
  GoalStateErrorCode,
  Requirement,
  RequirementApproval,
  RequirementBlocker,
  RequirementStatus,
} from './index.js';

type TransitionOptions = {
  providerId?: string;
  estimatedCost?: number;
  blocker?: RequirementBlocker;
  approval?: RequirementApproval;
  details?: Readonly<Record<string, unknown>>;
};

describe('Goal State contract', () => {
  it('recognizes every canonical requirement status', () => {
    for (const status of REQUIREMENT_STATUSES) {
      expect(isRequirementStatus(status)).toBe(true);
    }

    expect(isRequirementStatus('REROUTED')).toBe(false);
  });

  it('declares only the canonical valid transitions', () => {
    expect(canTransitionRequirement('PENDING', 'DISCOVERED')).toBe(true);
    expect(canTransitionRequirement('DISCOVERED', 'MATCHED')).toBe(true);
    expect(canTransitionRequirement('MATCHED', 'PROPOSED')).toBe(true);
    expect(canTransitionRequirement('PROPOSED', 'BLOCKED')).toBe(true);
    expect(canTransitionRequirement('PROPOSED', 'REQUIRES_HUMAN')).toBe(true);
    expect(canTransitionRequirement('PROPOSED', 'FULFILLED')).toBe(true);
    expect(canTransitionRequirement('BLOCKED', 'MATCHED')).toBe(true);
    expect(canTransitionRequirement('REQUIRES_HUMAN', 'FULFILLED')).toBe(true);
    expect(canTransitionRequirement('PENDING', 'MATCHED')).toBe(false);
    expect(canTransitionRequirement('FULFILLED', 'PENDING')).toBe(false);
  });
});

describe('Goal State state machine', () => {
  it('performs the direct fulfillment path immutably and appends every transition', () => {
    const initial = createTestGoal([{ id: 'desks', type: 'desk', status: 'PENDING' }]);
    const discovered = move(initial, 'desks', 'DISCOVERED');
    const matched = move(discovered, 'desks', 'MATCHED', { providerId: 'officepro' });
    const proposed = move(matched, 'desks', 'PROPOSED', { estimatedCost: 80_000 });
    const fulfilled = move(proposed, 'desks', 'FULFILLED');

    expect(requirement(initial, 'desks').status).toBe('PENDING');
    expect(proposed).toMatchObject({
      budgetUsed: 0,
      budgetRemaining: 500_000,
      progress: 0,
    });
    expect(requirement(fulfilled, 'desks')).toMatchObject({
      status: 'FULFILLED',
      providerId: 'officepro',
      estimatedCost: 80_000,
    });
    expect(fulfilled.activity).toHaveLength(4);
    expect(fulfilled.activity.map((event) => event.outcome)).toEqual([
      'DISCOVERED',
      'MATCHED',
      'PROPOSED',
      'FULFILLED',
    ]);
    expect(fulfilled).toMatchObject({
      budgetUsed: 80_000,
      budgetRemaining: 420_000,
      progress: 100,
    });
  });

  it('reroutes a blocked requirement while retaining structured failure history', () => {
    let state = createTestGoal([{ id: 'internet', type: 'internet', status: 'PENDING' }]);
    state = move(state, 'internet', 'DISCOVERED');
    state = move(state, 'internet', 'MATCHED', { providerId: 'fibermx' });
    state = move(state, 'internet', 'PROPOSED', { estimatedCost: 30_000 });
    state = move(state, 'internet', 'BLOCKED', {
      blocker: {
        code: 'DELIVERY_DEADLINE',
        message: 'Installation is available after the required deadline.',
      },
    });

    const blocked = requirement(state, 'internet');
    expect(blocked.failureHistory).toHaveLength(1);
    expect(blocked.blocker?.code).toBe('DELIVERY_DEADLINE');

    state = rerouteRequirement(state, {
      requirementId: 'internet',
      providerId: 'netbusiness',
      eventId: nextEventId(state),
      occurredAt: nextOccurredAt(state),
      details: { reason: 'FiberMX misses the deadline' },
    });

    const rerouted = requirement(state, 'internet');
    expect(rerouted).toMatchObject({ status: 'MATCHED', providerId: 'netbusiness' });
    expect(rerouted.blocker).toBeUndefined();
    expect(rerouted.failureHistory).toEqual(blocked.failureHistory);
    expect(state.activity.at(-1)).toMatchObject({
      action: 'REQUIREMENT_REROUTED',
      fromStatus: 'BLOCKED',
      toStatus: 'MATCHED',
      providerId: 'netbusiness',
      details: {
        previousProviderId: 'fibermx',
        blocker: { code: 'DELIVERY_DEADLINE' },
      },
    });
  });

  it('requires explicit approval before fulfilling a human-gated requirement', () => {
    let state = createTestGoal([{ id: 'security', type: 'security', status: 'PROPOSED' }]);
    state = move(state, 'security', 'REQUIRES_HUMAN', {
      providerId: 'securenow',
      approval: { required: true, approved: false },
    });

    expectGoalStateError(
      () => move(state, 'security', 'FULFILLED'),
      'APPROVAL_REQUIRED',
    );

    state = move(state, 'security', 'FULFILLED', {
      estimatedCost: 40_000,
      approval: { required: true, approved: true },
    });

    expect(requirement(state, 'security').approval).toEqual({ required: true, approved: true });
  });

  it('rejects invalid transitions and malformed transition data', () => {
    const pending = createTestGoal([{ id: 'computers', type: 'computer', status: 'PENDING' }]);
    expectGoalStateError(
      () => move(pending, 'computers', 'MATCHED', { providerId: 'techsupply' }),
      'INVALID_TRANSITION',
    );

    const discovered = move(pending, 'computers', 'DISCOVERED');
    expectGoalStateError(
      () => move(discovered, 'computers', 'MATCHED'),
      'PROVIDER_REQUIRED',
    );

    const proposed = createTestGoal([
      { id: 'internet', type: 'internet', status: 'PROPOSED', providerId: 'fibermx' },
    ]);
    expectGoalStateError(
      () => move(proposed, 'internet', 'BLOCKED'),
      'BLOCKER_REQUIRED',
    );
    expectGoalStateError(
      () => move(proposed, 'internet', 'FULFILLED', { estimatedCost: -1 }),
      'INVALID_ESTIMATED_COST',
    );
  });

  it('rejects duplicate audit event IDs', () => {
    const pending = createTestGoal([{ id: 'chairs', type: 'chair', status: 'PENDING' }]);
    const discovered = move(pending, 'chairs', 'DISCOVERED');

    expectGoalStateError(
      () =>
        transitionRequirement(discovered, {
          requirementId: 'chairs',
          toStatus: 'MATCHED',
          providerId: 'officepro',
          eventId: discovered.activity[0]?.id ?? '',
          occurredAt: nextOccurredAt(discovered),
        }),
      'DUPLICATE_ACTIVITY_EVENT',
    );
  });

  it('reproduces the complete hero scenario within budget', () => {
    let state = createTestGoal([
      { id: 'desks', type: 'desk', quantity: 20, status: 'PENDING' },
      { id: 'chairs', type: 'chair', quantity: 20, status: 'PENDING' },
      { id: 'computers', type: 'computer', quantity: 20, status: 'PENDING' },
      { id: 'internet', type: 'internet', status: 'PENDING' },
      { id: 'security', type: 'security', status: 'PENDING' },
    ]);

    state = fulfillDirectly(state, 'desks', 'officepro', 80_000);
    state = fulfillDirectly(state, 'chairs', 'officepro', 50_000);
    state = fulfillDirectly(state, 'computers', 'techsupply', 200_000);

    state = move(state, 'internet', 'DISCOVERED');
    state = move(state, 'internet', 'MATCHED', { providerId: 'fibermx' });
    state = move(state, 'internet', 'PROPOSED', { estimatedCost: 30_000 });
    state = move(state, 'internet', 'BLOCKED', {
      blocker: {
        code: 'DELIVERY_DEADLINE',
        message: 'Available 2026-10-08; required by 2026-10-01.',
      },
    });
    state = rerouteRequirement(state, {
      requirementId: 'internet',
      providerId: 'netbusiness',
      eventId: nextEventId(state),
      occurredAt: nextOccurredAt(state),
    });
    state = move(state, 'internet', 'PROPOSED', { estimatedCost: 30_000 });
    state = move(state, 'internet', 'FULFILLED');

    state = move(state, 'security', 'DISCOVERED');
    state = move(state, 'security', 'MATCHED', { providerId: 'securenow' });
    state = move(state, 'security', 'PROPOSED', { estimatedCost: 40_000 });
    state = move(state, 'security', 'REQUIRES_HUMAN', {
      approval: { required: true, approved: false },
    });
    state = move(state, 'security', 'FULFILLED', {
      approval: { required: true, approved: true },
    });

    expect(state.requirements.every((item) => item.status === 'FULFILLED')).toBe(true);
    expect(state).toMatchObject({
      progress: 100,
      budgetUsed: 400_000,
      budgetRemaining: 100_000,
    });
    expect(requirement(state, 'internet').failureHistory).toHaveLength(1);
    expect(state.activity).toHaveLength(24);
    expect(state.activity.some((event) => event.action === 'REQUIREMENT_REROUTED')).toBe(true);
  });
});

function createTestGoal(requirements: Requirement[]): GoalState {
  return createGoalState({
    id: 'goal-office-guadalajara',
    goal: 'Open an office for 20 people in Guadalajara',
    constraints: {
      city: 'Guadalajara',
      employees: 20,
      budget: 500_000,
      currency: 'MXN',
      deadline: '2026-10-01',
    },
    requirements,
    activity: [],
  });
}

function move(
  state: GoalState,
  requirementId: string,
  toStatus: RequirementStatus,
  options: TransitionOptions = {},
): GoalState {
  return transitionRequirement(state, {
    requirementId,
    toStatus,
    eventId: nextEventId(state),
    occurredAt: nextOccurredAt(state),
    ...options,
  });
}

function fulfillDirectly(
  state: GoalState,
  requirementId: string,
  providerId: string,
  estimatedCost: number,
): GoalState {
  let next = move(state, requirementId, 'DISCOVERED');
  next = move(next, requirementId, 'MATCHED', { providerId });
  next = move(next, requirementId, 'PROPOSED', { estimatedCost });
  return move(next, requirementId, 'FULFILLED');
}

function requirement(state: GoalState, requirementId: string): Requirement {
  const match = state.requirements.find((item) => item.id === requirementId);
  expect(match).toBeDefined();
  return match as Requirement;
}

function nextEventId(state: GoalState): string {
  return `event-${state.activity.length + 1}`;
}

function nextOccurredAt(state: GoalState): string {
  const seconds = String(state.activity.length + 1).padStart(2, '0');
  return `2026-09-01T12:00:${seconds}.000Z`;
}

function expectGoalStateError(action: () => unknown, code: GoalStateErrorCode): void {
  try {
    action();
    throw new Error(`Expected GoalStateError with code ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(GoalStateError);
    expect((error as GoalStateError).code).toBe(code);
  }
}
