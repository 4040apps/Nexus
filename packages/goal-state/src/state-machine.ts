import { GoalStateError } from './errors.js';
import type {
  ActivityEvent,
  CreateGoalStateInput,
  GoalMetrics,
  GoalState,
  Requirement,
  RequirementStatus,
  RequirementTransitionInput,
  RecordRequirementApprovalInput,
  RerouteRequirementInput,
} from './types.js';

const ALLOWED_TRANSITIONS: Readonly<
  Record<RequirementStatus, readonly RequirementStatus[]>
> = {
  PENDING: ['DISCOVERED'],
  DISCOVERED: ['MATCHED'],
  MATCHED: ['PROPOSED'],
  PROPOSED: ['BLOCKED', 'REQUIRES_HUMAN', 'FULFILLED'],
  BLOCKED: ['MATCHED'],
  REQUIRES_HUMAN: ['FULFILLED'],
  FULFILLED: [],
};

export function isRequirementStatus(value: string): value is RequirementStatus {
  return Object.hasOwn(ALLOWED_TRANSITIONS, value);
}

export function canTransitionRequirement(
  fromStatus: RequirementStatus,
  toStatus: RequirementStatus,
): boolean {
  return ALLOWED_TRANSITIONS[fromStatus].some((status) => status === toStatus);
}

export function deriveGoalMetrics(
  requirements: readonly Requirement[],
  budget: number,
): GoalMetrics {
  const fulfilled = requirements.filter((requirement) => requirement.status === 'FULFILLED');
  const budgetUsed = fulfilled.reduce(
    (total, requirement) => total + (requirement.estimatedCost ?? 0),
    0,
  );
  const progress =
    requirements.length === 0 ? 0 : Math.round((fulfilled.length / requirements.length) * 100);

  return {
    budgetUsed,
    budgetRemaining: budget - budgetUsed,
    progress,
  };
}

export function createGoalState(input: CreateGoalStateInput): GoalState {
  assertUniqueRequirements(input.requirements);

  for (const requirement of input.requirements) {
    assertEstimatedCost(requirement.estimatedCost, requirement.id);
  }

  const requirements = input.requirements.map(cloneRequirement);
  const activity = input.activity.map(cloneActivityEvent);

  return {
    ...input,
    requirements,
    activity,
    ...deriveGoalMetrics(requirements, input.constraints.budget),
  };
}

export function transitionRequirement(
  goalState: GoalState,
  input: RequirementTransitionInput,
): GoalState {
  assertUniqueEvent(goalState, input.eventId);

  const requirementIndex = goalState.requirements.findIndex(
    (requirement) => requirement.id === input.requirementId,
  );
  const current = goalState.requirements[requirementIndex];

  if (!current) {
    throw new GoalStateError(
      'REQUIREMENT_NOT_FOUND',
      `Requirement "${input.requirementId}" does not exist.`,
      { requirementId: input.requirementId },
    );
  }

  if (!canTransitionRequirement(current.status, input.toStatus)) {
    throw new GoalStateError(
      'INVALID_TRANSITION',
      `Cannot transition requirement "${current.id}" from ${current.status} to ${input.toStatus}.`,
      { requirementId: current.id, fromStatus: current.status, toStatus: input.toStatus },
    );
  }

  assertEstimatedCost(input.estimatedCost, current.id);

  const isReroute = current.status === 'BLOCKED' && input.toStatus === 'MATCHED';
  const next = buildNextRequirement(current, input, isReroute);
  const event = buildActivityEvent(current, next, input, isReroute);
  const requirements = goalState.requirements.map((requirement, index) =>
    index === requirementIndex ? next : requirement,
  );

  return {
    ...goalState,
    requirements,
    activity: [...goalState.activity, event],
    ...deriveGoalMetrics(requirements, goalState.constraints.budget),
  };
}

export function rerouteRequirement(
  goalState: GoalState,
  input: RerouteRequirementInput,
): GoalState {
  return transitionRequirement(goalState, {
    ...input,
    toStatus: 'MATCHED',
  });
}

export function recordRequirementApproval(
  goalState: GoalState,
  input: RecordRequirementApprovalInput,
): GoalState {
  assertUniqueEvent(goalState, input.eventId);
  const requirementIndex = goalState.requirements.findIndex(
    (requirement) => requirement.id === input.requirementId,
  );
  const current = goalState.requirements[requirementIndex];
  if (!current) {
    throw new GoalStateError('REQUIREMENT_NOT_FOUND', `Requirement "${input.requirementId}" does not exist.`);
  }
  if (
    current.status !== 'REQUIRES_HUMAN' ||
    current.approval?.required !== true ||
    current.approval.approved ||
    !current.providerId
  ) {
    throw new GoalStateError(
      'APPROVAL_REQUIRED',
      `Requirement "${current.id}" is not waiting for human approval.`,
      { requirementId: current.id },
    );
  }
  assertApprovalBinding(goalState, current, input);
  const next: Requirement = { ...current, approval: { ...input.approval } };
  const requirements = goalState.requirements.map((requirement, index) =>
    index === requirementIndex ? next : requirement,
  );
  return {
    ...goalState,
    requirements,
    activity: [
      ...goalState.activity,
      {
        id: input.eventId,
        occurredAt: input.occurredAt,
        requirementId: current.id,
        providerId: current.providerId,
        action: 'REQUIREMENT_APPROVAL_RECORDED',
        fromStatus: 'REQUIRES_HUMAN',
        toStatus: 'REQUIRES_HUMAN',
        outcome: 'APPROVED',
        details: {
          ...input.details,
          approvalId: input.approval.approvalId,
          approvalScopeId: input.approval.approvalScopeId,
          action: input.approval.action,
          expectedTotal: input.approval.expectedTotal,
          currency: input.approval.currency,
        },
      },
    ],
    ...deriveGoalMetrics(requirements, goalState.constraints.budget),
  };
}

function assertApprovalBinding(
  goalState: GoalState,
  requirement: Requirement,
  input: RecordRequirementApprovalInput,
): void {
  const approval = input.approval;
  if (
    approval.goalId !== goalState.id ||
    approval.requirementId !== requirement.id ||
    approval.providerId !== requirement.providerId ||
    approval.expectedTotal !== requirement.estimatedCost ||
    approval.currency !== goalState.constraints.currency ||
    approval.action.trim().length === 0 ||
    approval.approvalScopeId.trim().length === 0 ||
    approval.approvalId.trim().length === 0 ||
    approval.approvedAt.trim().length === 0
  ) {
    throw new GoalStateError(
      'APPROVAL_REQUIRED',
      `Approval is not bound to the current ${requirement.id} proposal.`,
      { requirementId: requirement.id, providerId: requirement.providerId },
    );
  }
}

function buildNextRequirement(
  current: Requirement,
  input: RequirementTransitionInput,
  isReroute: boolean,
): Requirement {
  const providerId = input.providerId ?? current.providerId;

  if (input.toStatus === 'MATCHED' && !providerId) {
    throw new GoalStateError(
      'PROVIDER_REQUIRED',
      `Requirement "${current.id}" must have a provider before it can be matched.`,
      { requirementId: current.id },
    );
  }

  if (isReroute && providerId === current.providerId) {
    throw new GoalStateError(
      'PROVIDER_REQUIRED',
      `Rerouting requirement "${current.id}" requires a different provider.`,
      { requirementId: current.id, providerId },
    );
  }

  if (input.toStatus === 'BLOCKED' && !input.blocker) {
    throw new GoalStateError(
      'BLOCKER_REQUIRED',
      `Requirement "${current.id}" needs a structured blocker when it becomes blocked.`,
      { requirementId: current.id },
    );
  }

  if (
    input.toStatus === 'REQUIRES_HUMAN' &&
    (!input.approval?.required || input.approval.approved)
  ) {
    throw new GoalStateError(
      'APPROVAL_REQUIRED',
      `Requirement "${current.id}" must record a pending human approval.`,
      { requirementId: current.id },
    );
  }

  if (
    current.status === 'REQUIRES_HUMAN' &&
    input.toStatus === 'FULFILLED' &&
    (!input.approval?.required || !input.approval.approved)
  ) {
    throw new GoalStateError(
      'APPROVAL_REQUIRED',
      `Requirement "${current.id}" cannot be fulfilled until human approval is recorded.`,
      { requirementId: current.id },
    );
  }

  const next: Requirement = {
    ...current,
    status: input.toStatus,
  };

  if (providerId) {
    next.providerId = providerId;
  }

  if (input.estimatedCost !== undefined) {
    next.estimatedCost = input.estimatedCost;
  }

  if (input.approval) {
    next.approval = { ...input.approval };
  }

  if (input.toStatus === 'BLOCKED' && input.blocker) {
    next.blocker = { ...input.blocker };
    next.failureHistory = [
      ...(current.failureHistory?.map((failure) => ({
        ...failure,
        blocker: { ...failure.blocker },
      })) ?? []),
      {
        ...(current.providerId ? { providerId: current.providerId } : {}),
        blocker: { ...input.blocker },
        activityEventId: input.eventId,
        occurredAt: input.occurredAt,
      },
    ];
  }

  if (isReroute) {
    delete next.blocker;
  }

  return next;
}

function buildActivityEvent(
  current: Requirement,
  next: Requirement,
  input: RequirementTransitionInput,
  isReroute: boolean,
): ActivityEvent {
  const details: Readonly<Record<string, unknown>> | undefined = isReroute
    ? {
        ...input.details,
        previousProviderId: current.providerId,
        blocker: current.blocker,
      }
    : input.toStatus === 'BLOCKED'
      ? { ...input.details, blocker: input.blocker }
      : input.details;

  return {
    id: input.eventId,
    occurredAt: input.occurredAt,
    requirementId: current.id,
    ...(next.providerId ? { providerId: next.providerId } : {}),
    action: isReroute ? 'REQUIREMENT_REROUTED' : 'REQUIREMENT_STATUS_CHANGED',
    fromStatus: current.status,
    toStatus: next.status,
    outcome: next.status,
    ...(details ? { details } : {}),
  };
}

function assertUniqueEvent(goalState: GoalState, eventId: string): void {
  if (goalState.activity.some((event) => event.id === eventId)) {
    throw new GoalStateError(
      'DUPLICATE_ACTIVITY_EVENT',
      `Activity event "${eventId}" already exists.`,
      { eventId },
    );
  }
}

function assertUniqueRequirements(requirements: readonly Requirement[]): void {
  const ids = new Set<string>();

  for (const requirement of requirements) {
    if (ids.has(requirement.id)) {
      throw new GoalStateError(
        'DUPLICATE_REQUIREMENT',
        `Requirement "${requirement.id}" appears more than once.`,
        { requirementId: requirement.id },
      );
    }

    ids.add(requirement.id);
  }
}

function assertEstimatedCost(estimatedCost: number | undefined, requirementId: string): void {
  if (estimatedCost !== undefined && (!Number.isFinite(estimatedCost) || estimatedCost < 0)) {
    throw new GoalStateError(
      'INVALID_ESTIMATED_COST',
      `Requirement "${requirementId}" has an invalid estimated cost.`,
      { requirementId, estimatedCost },
    );
  }
}

function cloneRequirement(requirement: Requirement): Requirement {
  return {
    ...requirement,
    ...(requirement.blocker ? { blocker: { ...requirement.blocker } } : {}),
    ...(requirement.approval ? { approval: { ...requirement.approval } } : {}),
    ...(requirement.failureHistory
      ? {
          failureHistory: requirement.failureHistory.map((failure) => ({
            ...failure,
            blocker: { ...failure.blocker },
          })),
        }
      : {}),
  };
}

function cloneActivityEvent(event: ActivityEvent): ActivityEvent {
  return {
    ...event,
    ...(event.details ? { details: { ...event.details } } : {}),
  };
}
