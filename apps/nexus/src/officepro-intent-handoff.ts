import type { GoalState } from '@nexus/goal-state';
import {
  IntentHandoffError,
  authorizeIntentHandoff,
  executeIntentHandoff,
  proposeIntentHandoff,
} from '@nexus/intent-handoff';
import type {
  AuthorizedIntentHandoff,
  HandoffResult,
  IntentHandoff,
  IntentHandoffProposal,
} from '@nexus/intent-handoff';

export const OFFICEPRO_HANDOFF_ID = 'handoff-officepro-hero';

export function proposeOfficeProIntentHandoff(
  goalState: GoalState,
): HandoffResult<IntentHandoffProposal> {
  assertOfficeProPartialGoal(goalState);
  return proposeIntentHandoff(goalState, {
    handoffId: OFFICEPRO_HANDOFF_ID,
    sourceProviderId: 'officepro',
    eventId: 'officepro-handoff-proposed',
    occurredAt: '2026-08-30T16:09:00.000Z',
  });
}

export function authorizeOfficeProIntentHandoff(
  goalState: GoalState,
  proposal: IntentHandoffProposal,
): HandoffResult<AuthorizedIntentHandoff> {
  return authorizeIntentHandoff(goalState, proposal, {
    authorizedByUser: true,
    approvedAt: '2026-08-30T16:10:00.000Z',
    eventId: 'officepro-handoff-authorized',
  });
}

export function executeOfficeProIntentHandoff(
  goalState: GoalState,
  authorizedHandoff: AuthorizedIntentHandoff,
): HandoffResult<IntentHandoff> {
  return executeIntentHandoff(goalState, authorizedHandoff, {
    executedAt: '2026-08-30T16:11:00.000Z',
    eventId: 'officepro-handoff-executed',
  });
}

function assertOfficeProPartialGoal(goalState: GoalState): void {
  const expected: ReadonlyMap<
    string,
    { status: 'FULFILLED' | 'PENDING'; providerId?: 'officepro'; estimatedCost?: number }
  > = new Map([
    ['desks', { status: 'FULFILLED', providerId: 'officepro', estimatedCost: 80_000 }],
    ['chairs', { status: 'FULFILLED', providerId: 'officepro', estimatedCost: 75_000 }],
    ['computers', { status: 'PENDING' }],
    ['internet', { status: 'PENDING' }],
    ['security', { status: 'PENDING' }],
  ]);

  const validRequirements =
    goalState.requirements.length === expected.size &&
    goalState.requirements.every((requirement) => {
      const expectedRequirement = expected.get(requirement.id);
      if (!expectedRequirement || requirement.status !== expectedRequirement.status) return false;
      if ('providerId' in expectedRequirement) {
        return (
          requirement.providerId === expectedRequirement.providerId &&
          requirement.estimatedCost === expectedRequirement.estimatedCost
        );
      }
      return requirement.providerId === undefined && requirement.estimatedCost === undefined;
    });

  if (
    !validRequirements ||
    goalState.progress !== 40 ||
    goalState.budgetUsed !== 155_000 ||
    goalState.budgetRemaining !== 345_000 ||
    goalState.activity.some((event) => event.action.startsWith('HANDOFF_'))
  ) {
    throw new IntentHandoffError(
      'INVALID_HANDOFF_STATE',
      'The OfficePro handoff requires the exact post-furniture Brand Mode Goal State.',
      { goalId: goalState.id },
    );
  }
}
