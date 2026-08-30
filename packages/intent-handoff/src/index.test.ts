import {
  createGoalState,
  transitionRequirement,
  type GoalState,
  type Requirement,
  type RequirementStatus,
} from '@nexus/goal-state';
import { describe, expect, it } from 'vitest';

import {
  authorizeIntentHandoff,
  canBeginBrokerRouting,
  detectHandoffEligibility,
  executeIntentHandoff,
  IntentHandoffError,
  proposeIntentHandoff,
  validateIntentHandoff,
} from './index.js';
import type {
  AuthorizeIntentHandoffInput,
  IntentHandoffErrorCode,
} from './index.js';

describe('Intent Handoff', () => {
  it('detects OfficePro partial fulfillment and only the unresolved requirements', () => {
    const goalState = createOfficeProPartialGoal();
    const eligibility = detectHandoffEligibility(goalState, 'officepro');

    expect(eligibility).toEqual({
      status: 'PARTIAL',
      sourceProviderId: 'officepro',
      fulfilledRequirementIds: ['desks', 'chairs'],
      remainingRequirements: [
        { id: 'computers', type: 'computer', quantity: 20 },
        { id: 'internet', type: 'internet' },
        { id: 'security', type: 'security' },
      ],
      handoffAvailable: true,
      handoffAuthorized: false,
    });
  });

  it('proposes, authorizes, and executes a minimal handoff with an audit trail', () => {
    const partialGoal = createOfficeProPartialGoal();
    const proposed = proposeIntentHandoff(partialGoal, {
      handoffId: 'handoff-officepro-1',
      sourceProviderId: 'officepro',
      eventId: 'handoff-event-proposed',
      occurredAt: '2026-09-01T13:00:00.000Z',
    });

    expect(proposed.handoff).toMatchObject({
      status: 'PROPOSED',
      authorizedByUser: false,
      source: { providerId: 'officepro', mode: 'BRAND' },
      destination: { type: 'NEXUS', mode: 'BROKER' },
      constraints: {
        city: 'Guadalajara',
        deadline: '2026-10-01',
        remainingBudget: 345_000,
        currency: 'MXN',
      },
      authorization: { required: true, approved: false },
    });
    expect(canBeginBrokerRouting(proposed.handoff)).toBe(false);

    const authorized = authorizeIntentHandoff(proposed.goalState, proposed.handoff, {
      authorizedByUser: true,
      approvedAt: '2026-09-01T13:01:00.000Z',
      eventId: 'handoff-event-authorized',
    });
    expect(authorized.handoff).toMatchObject({
      status: 'AUTHORIZED',
      authorizedByUser: true,
      authorization: {
        required: true,
        approved: true,
        approvedAt: '2026-09-01T13:01:00.000Z',
      },
    });
    expect(canBeginBrokerRouting(authorized.handoff)).toBe(false);

    const executed = executeIntentHandoff(authorized.goalState, authorized.handoff, {
      executedAt: '2026-09-01T13:02:00.000Z',
      eventId: 'handoff-event-executed',
    });

    expect(canBeginBrokerRouting(executed.handoff)).toBe(true);
    expect(() => validateIntentHandoff(executed.handoff)).not.toThrow();
    expect(executed.handoff.remainingRequirements).toEqual([
      { id: 'computers', type: 'computer', quantity: 20 },
      { id: 'internet', type: 'internet' },
      { id: 'security', type: 'security' },
    ]);
    expect(executed.handoff.remainingRequirements.map((item) => item.id)).not.toContain('desks');
    expect(executed.handoff.remainingRequirements.map((item) => item.id)).not.toContain('chairs');
    expect(executed.handoff.constraints.remainingBudget).toBe(345_000);
    expect(Object.keys(executed.handoff.constraints).sort()).toEqual([
      'city',
      'currency',
      'deadline',
      'remainingBudget',
    ]);

    const handoffEvents = executed.goalState.activity.filter((event) =>
      event.action.startsWith('HANDOFF_'),
    );
    expect(handoffEvents.map((event) => event.action)).toEqual([
      'HANDOFF_PROPOSED',
      'HANDOFF_AUTHORIZED',
      'HANDOFF_EXECUTED',
    ]);
  });

  it('rejects execution before authorization with a structured error', () => {
    const partialGoal = createOfficeProPartialGoal();
    const proposed = proposeIntentHandoff(partialGoal, {
      handoffId: 'handoff-officepro-unauthorized',
      sourceProviderId: 'officepro',
      eventId: 'handoff-event-proposed',
      occurredAt: '2026-09-01T13:00:00.000Z',
    });

    expectHandoffError(
      () =>
        executeIntentHandoff(proposed.goalState, proposed.handoff, {
          executedAt: '2026-09-01T13:01:00.000Z',
          eventId: 'handoff-event-executed',
        }),
      'AUTHORIZATION_REQUIRED',
    );
    expect(canBeginBrokerRouting(proposed.handoff)).toBe(false);
    expect(proposed.goalState.activity.some((event) => event.action === 'HANDOFF_EXECUTED')).toBe(
      false,
    );
  });

  it('rejects a runtime attempt to bypass explicit user consent', () => {
    const partialGoal = createOfficeProPartialGoal();
    const proposed = proposeIntentHandoff(partialGoal, {
      handoffId: 'handoff-officepro-bypass',
      sourceProviderId: 'officepro',
      eventId: 'handoff-event-proposed',
      occurredAt: '2026-09-01T13:00:00.000Z',
    });
    const forgedAuthorization = {
      authorizedByUser: false,
      approvedAt: '2026-09-01T13:01:00.000Z',
      eventId: 'handoff-event-authorized',
    } as unknown as AuthorizeIntentHandoffInput;

    expectHandoffError(
      () => authorizeIntentHandoff(proposed.goalState, proposed.handoff, forgedAuthorization),
      'AUTHORIZATION_REQUIRED',
    );
    expect(proposed.handoff.source.mode).toBe('BRAND');
    expect(proposed.handoff.authorizedByUser).toBe(false);
  });

  it('projects the payload instead of copying provider-private Goal State data', () => {
    const partialGoal = createOfficeProPartialGoal();
    const internet = partialGoal.requirements.find((item) => item.id === 'internet');

    if (internet) {
      internet.providerId = 'officepro';
      internet.estimatedCost = 999_999;
      internet.blocker = { code: 'PRIVATE', message: 'Provider-only diagnostic' };
    }

    const proposed = proposeIntentHandoff(partialGoal, {
      handoffId: 'handoff-officepro-minimal',
      sourceProviderId: 'officepro',
      eventId: 'handoff-event-proposed',
      occurredAt: '2026-09-01T13:00:00.000Z',
    });
    const serialized = JSON.stringify(proposed.handoff);

    expect(serialized).not.toContain('999999');
    expect(serialized).not.toContain('Provider-only diagnostic');
    expect(serialized).not.toContain('estimatedCost');
    expect(serialized).not.toContain('blocker');
    expect(serialized).not.toContain('activity');
    expect(Object.keys(proposed.handoff.remainingRequirements[0] ?? {}).sort()).toEqual([
      'id',
      'quantity',
      'type',
    ]);
  });

  it('does not offer a handoff when the goal is already fulfilled', () => {
    let goalState = createGoal([
      { id: 'desks', type: 'desk', status: 'PENDING' },
      { id: 'chairs', type: 'chair', status: 'PENDING' },
    ]);
    goalState = fulfill(goalState, 'desks', 'officepro', 80_000);
    goalState = fulfill(goalState, 'chairs', 'officepro', 75_000);

    expect(detectHandoffEligibility(goalState, 'officepro')).toMatchObject({
      status: 'FULFILLED',
      remainingRequirements: [],
      handoffAvailable: false,
    });
    expectHandoffError(
      () =>
        proposeIntentHandoff(goalState, {
          handoffId: 'handoff-not-needed',
          sourceProviderId: 'officepro',
          eventId: 'handoff-event-proposed',
          occurredAt: '2026-09-01T13:00:00.000Z',
        }),
      'NO_REMAINING_REQUIREMENTS',
    );
  });

  it('validates final handoff payloads at runtime', () => {
    expectHandoffError(
      () =>
        validateIntentHandoff({
          status: 'EXECUTED',
          authorizedByUser: false,
          remainingRequirements: [],
        }),
      'INVALID_HANDOFF_PAYLOAD',
    );

    const partialGoal = createOfficeProPartialGoal();
    const proposed = proposeIntentHandoff(partialGoal, {
      handoffId: 'handoff-strict-validation',
      sourceProviderId: 'officepro',
      eventId: 'handoff-event-proposed',
      occurredAt: '2026-09-01T13:00:00.000Z',
    });
    const authorized = authorizeIntentHandoff(proposed.goalState, proposed.handoff, {
      authorizedByUser: true,
      approvedAt: '2026-09-01T13:01:00.000Z',
      eventId: 'handoff-event-authorized',
    });
    const executed = executeIntentHandoff(authorized.goalState, authorized.handoff, {
      executedAt: '2026-09-01T13:02:00.000Z',
      eventId: 'handoff-event-executed',
    });

    expectHandoffError(
      () => validateIntentHandoff({ ...executed.handoff, providerCatalog: ['private'] }),
      'INVALID_HANDOFF_PAYLOAD',
    );
  });
});

function createOfficeProPartialGoal(): GoalState {
  let goalState = createGoal([
    { id: 'desks', type: 'desk', quantity: 20, status: 'PENDING' },
    { id: 'chairs', type: 'chair', quantity: 20, status: 'PENDING' },
    { id: 'computers', type: 'computer', quantity: 20, status: 'PENDING' },
    { id: 'internet', type: 'internet', status: 'PENDING' },
    { id: 'security', type: 'security', status: 'PENDING' },
  ]);
  goalState = fulfill(goalState, 'desks', 'officepro', 80_000);
  return fulfill(goalState, 'chairs', 'officepro', 75_000);
}

function createGoal(requirements: Requirement[]): GoalState {
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

function fulfill(
  goalState: GoalState,
  requirementId: string,
  providerId: string,
  estimatedCost: number,
): GoalState {
  let next = move(goalState, requirementId, 'DISCOVERED');
  next = move(next, requirementId, 'MATCHED', { providerId });
  next = move(next, requirementId, 'PROPOSED', { estimatedCost });
  return move(next, requirementId, 'FULFILLED');
}

function move(
  goalState: GoalState,
  requirementId: string,
  toStatus: RequirementStatus,
  values: { providerId?: string; estimatedCost?: number } = {},
): GoalState {
  return transitionRequirement(goalState, {
    requirementId,
    toStatus,
    eventId: `goal-event-${goalState.activity.length + 1}`,
    occurredAt: `2026-09-01T12:00:${String(goalState.activity.length + 1).padStart(2, '0')}.000Z`,
    ...values,
  });
}

function expectHandoffError(action: () => unknown, code: IntentHandoffErrorCode): void {
  try {
    action();
    throw new Error(`Expected IntentHandoffError with code ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(IntentHandoffError);
    expect((error as IntentHandoffError).code).toBe(code);
  }
}
