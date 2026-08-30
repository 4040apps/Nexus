import {
  createGoalState,
  rerouteRequirement,
  transitionRequirement,
} from '@nexus/goal-state';
import type {
  GoalState,
  RequirementApproval,
  RequirementBlocker,
  RequirementStatus,
} from '@nexus/goal-state';
import {
  authorizeIntentHandoff,
  executeIntentHandoff,
  proposeIntentHandoff,
} from '@nexus/intent-handoff';

export const HERO_MISSION = {
  id: 'goal-office-guadalajara',
  title: 'Open an office for 20 people in Guadalajara',
  city: 'Guadalajara',
  employees: 20,
  deadline: '2026-10-01',
  budget: 500_000,
  currency: 'MXN' as const,
} as const;

export const HERO_DASHBOARD_STATE_NAMES = [
  'initial',
  'officepro-partial',
  'fibermx-blocked',
  'internet-rerouted',
  'approval-required',
  'complete',
] as const;

export type HeroDashboardStateName = (typeof HERO_DASHBOARD_STATE_NAMES)[number];

export type HeroDashboardStates = Readonly<Record<HeroDashboardStateName, GoalState>>;

type TransitionOptions = {
  providerId?: string;
  estimatedCost?: number;
  blocker?: RequirementBlocker;
  approval?: RequirementApproval;
  details?: Readonly<Record<string, unknown>>;
};

export function createInitialHeroGoalState(): GoalState {
  return createGoalState({
    id: HERO_MISSION.id,
    goal: HERO_MISSION.title,
    constraints: {
      city: HERO_MISSION.city,
      employees: HERO_MISSION.employees,
      budget: HERO_MISSION.budget,
      currency: HERO_MISSION.currency,
      deadline: HERO_MISSION.deadline,
    },
    requirements: [
      { id: 'desks', type: 'desk', quantity: 20, status: 'PENDING' },
      { id: 'chairs', type: 'chair', quantity: 20, status: 'PENDING' },
      { id: 'computers', type: 'computer', quantity: 20, status: 'PENDING' },
      { id: 'internet', type: 'internet', status: 'PENDING' },
      { id: 'security', type: 'security', status: 'PENDING' },
    ],
    activity: [],
  });
}

export function createHeroDashboardStates(): HeroDashboardStates {
  const initial = createInitialHeroGoalState();

  let officeProPartial = fulfillDirectly(initial, 'desks', 'officepro', 80_000, {
    discoveryTool: 'search_furniture',
    proposalTool: 'build_furniture_package',
    fulfilledSummary: '20 commercial desks secured for the mission.',
  });
  officeProPartial = fulfillDirectly(officeProPartial, 'chairs', 'officepro', 75_000, {
    discoveryTool: 'search_furniture',
    proposalTool: 'build_furniture_package',
    fulfilledSummary: '20 ergonomic chairs secured for the mission.',
  });

  const proposedHandoff = proposeIntentHandoff(officeProPartial, {
    handoffId: 'handoff-officepro-hero',
    sourceProviderId: 'officepro',
    eventId: nextEventId(officeProPartial),
    occurredAt: nextOccurredAt(officeProPartial),
  });
  const authorizedHandoff = authorizeIntentHandoff(
    proposedHandoff.goalState,
    proposedHandoff.handoff,
    {
      authorizedByUser: true,
      approvedAt: nextOccurredAt(proposedHandoff.goalState),
      eventId: nextEventId(proposedHandoff.goalState),
    },
  );
  const executedHandoff = executeIntentHandoff(
    authorizedHandoff.goalState,
    authorizedHandoff.handoff,
    {
      executedAt: nextOccurredAt(authorizedHandoff.goalState),
      eventId: nextEventId(authorizedHandoff.goalState),
    },
  );

  let fiberMxBlocked = fulfillDirectly(
    executedHandoff.goalState,
    'computers',
    'techsupply',
    190_000,
    {
      discoveryTool: 'check_inventory',
      proposalTool: 'build_computer_package',
      fulfilledSummary: '20 business computers available and assigned.',
    },
  );
  fiberMxBlocked = move(fiberMxBlocked, 'internet', 'DISCOVERED', {
    details: {
      toolName: 'check_coverage',
      summary: 'FiberMX coverage discovered for Guadalajara.',
    },
  });
  fiberMxBlocked = move(fiberMxBlocked, 'internet', 'MATCHED', {
    providerId: 'fibermx',
    details: { summary: 'FiberMX assigned to the internet requirement.' },
  });
  fiberMxBlocked = move(fiberMxBlocked, 'internet', 'PROPOSED', {
    estimatedCost: 24_000,
    details: {
      toolName: 'build_connectivity_offer',
      summary: 'FiberMX checked its earliest installation date.',
    },
  });
  fiberMxBlocked = move(fiberMxBlocked, 'internet', 'BLOCKED', {
    blocker: {
      code: 'DELIVERY_DEADLINE',
      message: 'FiberMX can install on Oct 8, after the Oct 1 mission deadline.',
    },
    details: {
      toolName: 'check_installation_date',
      availableDate: '2026-10-08',
      requiredBy: HERO_MISSION.deadline,
      summary: 'Deadline conflict: FiberMX installation is seven days late.',
    },
  });

  const internetRerouted = rerouteRequirement(fiberMxBlocked, {
    requirementId: 'internet',
    providerId: 'netbusiness',
    eventId: nextEventId(fiberMxBlocked),
    occurredAt: nextOccurredAt(fiberMxBlocked),
    details: {
      summary: 'Internet rerouted from FiberMX to NetBusiness.',
      reason: 'FiberMX misses the mission deadline.',
    },
  });

  let approvalRequired = move(internetRerouted, 'internet', 'PROPOSED', {
    estimatedCost: 27_500,
    details: {
      toolName: 'build_connectivity_offer',
      summary: 'NetBusiness can install by Sep 25.',
    },
  });
  approvalRequired = move(approvalRequired, 'internet', 'FULFILLED', {
    details: { summary: 'Internet installation secured before the deadline.' },
  });
  approvalRequired = move(approvalRequired, 'security', 'DISCOVERED', {
    details: {
      toolName: 'assess_security_requirement',
      summary: 'Security provider discovered for the office.',
    },
  });
  approvalRequired = move(approvalRequired, 'security', 'MATCHED', {
    providerId: 'securenow',
    details: { summary: 'SecureNow assigned to the security requirement.' },
  });
  approvalRequired = move(approvalRequired, 'security', 'PROPOSED', {
    estimatedCost: 37_500,
    details: {
      toolName: 'build_security_package',
      summary: 'SecureNow prepared a security package for the office.',
    },
  });
  approvalRequired = move(approvalRequired, 'security', 'REQUIRES_HUMAN', {
    approval: { required: true, approved: false },
    details: {
      toolName: 'request_installation',
      summary: 'Installation is ready and waiting for explicit human approval.',
    },
  });

  const complete = move(approvalRequired, 'security', 'FULFILLED', {
    approval: { required: true, approved: true },
    details: {
      approvalId: 'approval-securenow-hero',
      summary: 'Human approval granted. Mission complete within budget and deadline.',
    },
  });

  return {
    initial,
    'officepro-partial': officeProPartial,
    'fibermx-blocked': fiberMxBlocked,
    'internet-rerouted': internetRerouted,
    'approval-required': approvalRequired,
    complete,
  };
}

function fulfillDirectly(
  state: GoalState,
  requirementId: string,
  providerId: string,
  estimatedCost: number,
  copy: {
    discoveryTool: string;
    proposalTool: string;
    fulfilledSummary: string;
  },
): GoalState {
  let next = move(state, requirementId, 'DISCOVERED', {
    details: {
      toolName: copy.discoveryTool,
      summary: `Provider discovery completed for ${requirementId}.`,
    },
  });
  next = move(next, requirementId, 'MATCHED', {
    providerId,
    details: { summary: `${providerId} assigned to ${requirementId}.` },
  });
  next = move(next, requirementId, 'PROPOSED', {
    estimatedCost,
    details: {
      toolName: copy.proposalTool,
      summary: `Provider offer prepared for ${requirementId}.`,
    },
  });
  return move(next, requirementId, 'FULFILLED', {
    details: { summary: copy.fulfilledSummary },
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

function nextEventId(state: GoalState): string {
  return `dashboard-event-${String(state.activity.length + 1).padStart(2, '0')}`;
}

function nextOccurredAt(state: GoalState): string {
  const start = Date.UTC(2026, 8, 1, 11, 41);
  return new Date(start + (state.activity.length + 1) * 60_000).toISOString();
}
