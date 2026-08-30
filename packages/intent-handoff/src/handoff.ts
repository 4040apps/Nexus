import type { GoalState, HandoffActivityEvent, Requirement } from '@nexus/goal-state';

import { IntentHandoffError } from './errors.js';
import type {
  AuthorizedIntentHandoff,
  AuthorizeIntentHandoffInput,
  ExecuteIntentHandoffInput,
  HandoffEligibility,
  HandoffRequirement,
  HandoffResult,
  IntentHandoff,
  IntentHandoffLifecycle,
  IntentHandoffProposal,
  ProposeIntentHandoffInput,
} from './types.js';

export function detectHandoffEligibility(
  goalState: GoalState,
  sourceProviderId: string,
): HandoffEligibility {
  assertSourceProvider(sourceProviderId);

  const fulfilledRequirementIds = goalState.requirements
    .filter((requirement) => requirement.status === 'FULFILLED')
    .map((requirement) => requirement.id);
  const remainingRequirements = goalState.requirements
    .filter((requirement) => requirement.status !== 'FULFILLED')
    .map(toHandoffRequirement);

  return {
    status:
      remainingRequirements.length === 0
        ? 'FULFILLED'
        : fulfilledRequirementIds.length > 0
          ? 'PARTIAL'
          : 'UNFULFILLED',
    sourceProviderId,
    fulfilledRequirementIds,
    remainingRequirements,
    handoffAvailable: remainingRequirements.length > 0,
    handoffAuthorized: false,
  };
}

export function proposeIntentHandoff(
  goalState: GoalState,
  input: ProposeIntentHandoffInput,
): HandoffResult<IntentHandoffProposal> {
  assertSourceProvider(input.sourceProviderId);
  assertUniqueEvent(goalState, input.eventId);

  const eligibility = detectHandoffEligibility(goalState, input.sourceProviderId);

  if (!eligibility.handoffAvailable) {
    throw new IntentHandoffError(
      'NO_REMAINING_REQUIREMENTS',
      `Goal "${goalState.id}" has no unresolved requirements to hand off.`,
      { goalId: goalState.id },
    );
  }

  const handoff: IntentHandoffProposal = {
    handoffId: input.handoffId,
    goalId: goalState.id,
    status: 'PROPOSED',
    source: {
      providerId: input.sourceProviderId,
      mode: 'BRAND',
    },
    destination: {
      type: 'NEXUS',
      mode: 'BROKER',
    },
    remainingRequirements: eligibility.remainingRequirements.map(cloneHandoffRequirement),
    constraints: {
      city: goalState.constraints.city,
      employees: goalState.constraints.employees,
      deadline: goalState.constraints.deadline,
      remainingBudget: goalState.budgetRemaining,
      currency: goalState.constraints.currency,
    },
    authorizedByUser: false,
    authorization: {
      required: true,
      approved: false,
    },
  };

  return {
    handoff,
    goalState: appendHandoffEvent(goalState, {
      id: input.eventId,
      occurredAt: input.occurredAt,
      handoffId: input.handoffId,
      sourceProviderId: input.sourceProviderId,
      action: 'HANDOFF_PROPOSED',
      outcome: 'PROPOSED',
      details: { remainingRequirementCount: handoff.remainingRequirements.length },
    }),
  };
}

export function authorizeIntentHandoff(
  goalState: GoalState,
  proposal: IntentHandoffProposal,
  input: AuthorizeIntentHandoffInput,
): HandoffResult<AuthorizedIntentHandoff> {
  assertProposal(proposal);
  assertGoalMatch(goalState, proposal.goalId);
  assertUniqueEvent(goalState, input.eventId);

  if (input.authorizedByUser !== true) {
    throw new IntentHandoffError(
      'AUTHORIZATION_REQUIRED',
      `Handoff "${proposal.handoffId}" requires explicit user authorization.`,
      { handoffId: proposal.handoffId },
    );
  }

  const handoff: AuthorizedIntentHandoff = {
    ...copyBase(proposal),
    status: 'AUTHORIZED',
    authorizedByUser: true,
    authorization: {
      required: true,
      approved: true,
      approvedAt: input.approvedAt,
    },
  };

  return {
    handoff,
    goalState: appendHandoffEvent(goalState, {
      id: input.eventId,
      occurredAt: input.approvedAt,
      handoffId: proposal.handoffId,
      sourceProviderId: proposal.source.providerId,
      action: 'HANDOFF_AUTHORIZED',
      outcome: 'AUTHORIZED',
    }),
  };
}

export function executeIntentHandoff(
  goalState: GoalState,
  authorizedHandoff: IntentHandoffProposal | AuthorizedIntentHandoff,
  input: ExecuteIntentHandoffInput,
): HandoffResult<IntentHandoff> {
  assertGoalMatch(goalState, authorizedHandoff.goalId);
  assertUniqueEvent(goalState, input.eventId);

  if (
    authorizedHandoff.status !== 'AUTHORIZED' ||
    authorizedHandoff.authorizedByUser !== true ||
    authorizedHandoff.authorization.approved !== true
  ) {
    throw new IntentHandoffError(
      'AUTHORIZATION_REQUIRED',
      `Handoff "${authorizedHandoff.handoffId}" cannot execute without explicit authorization.`,
      { handoffId: authorizedHandoff.handoffId, status: authorizedHandoff.status },
    );
  }

  assertAuthorizedHandoff(authorizedHandoff);

  const authorizedRequirementIds = new Set(
    authorizedHandoff.remainingRequirements.map((requirement) => requirement.id),
  );
  const remainingRequirements = goalState.requirements
    .filter(
      (requirement) =>
        requirement.status !== 'FULFILLED' && authorizedRequirementIds.has(requirement.id),
    )
    .map(toHandoffRequirement);

  if (remainingRequirements.length === 0) {
    throw new IntentHandoffError(
      'NO_REMAINING_REQUIREMENTS',
      `Handoff "${authorizedHandoff.handoffId}" has no unresolved requirements to execute.`,
      { handoffId: authorizedHandoff.handoffId },
    );
  }

  const handoff: IntentHandoff = {
    ...copyBase(authorizedHandoff),
    remainingRequirements,
    constraints: {
      ...authorizedHandoff.constraints,
      remainingBudget: goalState.budgetRemaining,
    },
    status: 'EXECUTED',
    authorizedByUser: true,
    authorization: { ...authorizedHandoff.authorization },
    executedAt: input.executedAt,
  };

  validateIntentHandoff(handoff);

  return {
    handoff,
    goalState: appendHandoffEvent(goalState, {
      id: input.eventId,
      occurredAt: input.executedAt,
      handoffId: handoff.handoffId,
      sourceProviderId: handoff.source.providerId,
      action: 'HANDOFF_EXECUTED',
      outcome: 'EXECUTED',
      details: { remainingRequirementCount: handoff.remainingRequirements.length },
    }),
  };
}

export function canBeginBrokerRouting(
  handoff: IntentHandoffLifecycle,
): handoff is IntentHandoff {
  return (
    handoff.status === 'EXECUTED' &&
    handoff.authorizedByUser === true &&
    handoff.authorization.approved === true &&
    handoff.destination.type === 'NEXUS' &&
    handoff.destination.mode === 'BROKER'
  );
}

export function validateIntentHandoff(value: unknown): asserts value is IntentHandoff {
  if (!isRecord(value)) {
    throwInvalidPayload();
  }

  const source = value.source;
  const destination = value.destination;
  const authorization = value.authorization;
  const constraints = value.constraints;
  const remainingRequirements = value.remainingRequirements;

  if (
    !hasOnlyKeys(value, [
      'handoffId',
      'goalId',
      'status',
      'source',
      'destination',
      'remainingRequirements',
      'constraints',
      'authorizedByUser',
      'authorization',
      'executedAt',
    ]) ||
    value.status !== 'EXECUTED' ||
    value.authorizedByUser !== true ||
    typeof value.handoffId !== 'string' ||
    typeof value.goalId !== 'string' ||
    typeof value.executedAt !== 'string' ||
    !isRecord(source) ||
    !hasOnlyKeys(source, ['providerId', 'mode']) ||
    typeof source.providerId !== 'string' ||
    source.mode !== 'BRAND' ||
    !isRecord(destination) ||
    !hasOnlyKeys(destination, ['type', 'mode']) ||
    destination.type !== 'NEXUS' ||
    destination.mode !== 'BROKER' ||
    !isRecord(authorization) ||
    !hasOnlyKeys(authorization, ['required', 'approved', 'approvedAt']) ||
    authorization.required !== true ||
    authorization.approved !== true ||
    typeof authorization.approvedAt !== 'string' ||
    !isRecord(constraints) ||
    !hasOnlyKeys(constraints, [
      'city',
      'employees',
      'deadline',
      'remainingBudget',
      'currency',
    ]) ||
    typeof constraints.city !== 'string' ||
    typeof constraints.employees !== 'number' ||
    typeof constraints.deadline !== 'string' ||
    typeof constraints.remainingBudget !== 'number' ||
    constraints.currency !== 'MXN' ||
    !Array.isArray(remainingRequirements) ||
    remainingRequirements.length === 0 ||
    !remainingRequirements.every(isHandoffRequirement)
  ) {
    throwInvalidPayload();
  }
}

function assertProposal(proposal: IntentHandoffProposal): void {
  if (
    proposal.status !== 'PROPOSED' ||
    proposal.authorizedByUser !== false ||
    proposal.authorization.required !== true ||
    proposal.authorization.approved !== false ||
    proposal.source.mode !== 'BRAND' ||
    proposal.destination.type !== 'NEXUS' ||
    proposal.destination.mode !== 'BROKER'
  ) {
    throw new IntentHandoffError(
      'INVALID_HANDOFF_STATE',
      `Handoff "${proposal.handoffId}" is not a valid Brand Mode proposal.`,
      { handoffId: proposal.handoffId },
    );
  }
}

function assertAuthorizedHandoff(handoff: AuthorizedIntentHandoff): void {
  if (
    handoff.source.mode !== 'BRAND' ||
    handoff.destination.type !== 'NEXUS' ||
    handoff.destination.mode !== 'BROKER' ||
    handoff.remainingRequirements.length === 0
  ) {
    throw new IntentHandoffError(
      'INVALID_HANDOFF_STATE',
      `Handoff "${handoff.handoffId}" is not valid for execution.`,
      { handoffId: handoff.handoffId },
    );
  }
}

function assertGoalMatch(goalState: GoalState, goalId: string): void {
  if (goalState.id !== goalId) {
    throw new IntentHandoffError(
      'GOAL_MISMATCH',
      `Handoff for goal "${goalId}" cannot be applied to goal "${goalState.id}".`,
      { handoffGoalId: goalId, goalStateId: goalState.id },
    );
  }
}

function assertSourceProvider(sourceProviderId: string): void {
  if (sourceProviderId.trim().length === 0) {
    throw new IntentHandoffError(
      'SOURCE_PROVIDER_REQUIRED',
      'A source provider is required to propose an intent handoff.',
    );
  }
}

function assertUniqueEvent(goalState: GoalState, eventId: string): void {
  if (goalState.activity.some((event) => event.id === eventId)) {
    throw new IntentHandoffError(
      'DUPLICATE_ACTIVITY_EVENT',
      `Activity event "${eventId}" already exists.`,
      { eventId },
    );
  }
}

function appendHandoffEvent(goalState: GoalState, event: HandoffActivityEvent): GoalState {
  return {
    ...goalState,
    activity: [...goalState.activity, event],
  };
}

function toHandoffRequirement(requirement: Requirement): HandoffRequirement {
  return {
    id: requirement.id,
    type: requirement.type,
    ...(requirement.quantity !== undefined ? { quantity: requirement.quantity } : {}),
  };
}

function cloneHandoffRequirement(requirement: HandoffRequirement): HandoffRequirement {
  return { ...requirement };
}

function copyBase(handoff: IntentHandoffLifecycle) {
  return {
    handoffId: handoff.handoffId,
    goalId: handoff.goalId,
    source: { ...handoff.source },
    destination: { ...handoff.destination },
    remainingRequirements: handoff.remainingRequirements.map(cloneHandoffRequirement),
    constraints: { ...handoff.constraints },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHandoffRequirement(value: unknown): value is HandoffRequirement {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['id', 'type', 'quantity']) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    (value.quantity === undefined || typeof value.quantity === 'number')
  );
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function throwInvalidPayload(): never {
  throw new IntentHandoffError(
    'INVALID_HANDOFF_PAYLOAD',
    'Intent handoff payload is missing required consent or continuation fields.',
  );
}
