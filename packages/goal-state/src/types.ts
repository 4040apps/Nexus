export const REQUIREMENT_STATUSES = [
  'PENDING',
  'DISCOVERED',
  'MATCHED',
  'PROPOSED',
  'BLOCKED',
  'REQUIRES_HUMAN',
  'FULFILLED',
] as const;

export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const PROVIDER_OUTCOME_STATUSES = [
  'FULFILLED',
  'PARTIAL',
  'UNFULFILLED',
  'BLOCKED',
  'REQUIRES_HUMAN',
] as const;

export type ProviderOutcomeStatus = (typeof PROVIDER_OUTCOME_STATUSES)[number];
export type Currency = 'MXN';

export type GoalConstraints = {
  city: string;
  employees: number;
  budget: number;
  currency: Currency;
  deadline: string;
};

export type RequirementBlocker = {
  code: string;
  message: string;
};

export type RequirementApproval = {
  required: boolean;
  approved: boolean;
};

export type RequirementFailure = {
  providerId?: string;
  blocker: RequirementBlocker;
  activityEventId: string;
  occurredAt: string;
};

export type Requirement = {
  id: string;
  type: string;
  quantity?: number;
  status: RequirementStatus;
  providerId?: string;
  estimatedCost?: number;
  blocker?: RequirementBlocker;
  approval?: RequirementApproval;
  failureHistory?: RequirementFailure[];
};

export type RequirementActivityAction =
  | 'REQUIREMENT_STATUS_CHANGED'
  | 'REQUIREMENT_REROUTED';

export type HandoffActivityAction =
  | 'HANDOFF_PROPOSED'
  | 'HANDOFF_AUTHORIZED'
  | 'HANDOFF_EXECUTED';

export type ActivityAction = RequirementActivityAction | HandoffActivityAction;

export type RequirementActivityEvent = {
  id: string;
  occurredAt: string;
  requirementId: string;
  providerId?: string;
  action: RequirementActivityAction;
  fromStatus: RequirementStatus;
  toStatus: RequirementStatus;
  outcome: RequirementStatus;
  details?: Readonly<Record<string, unknown>>;
};

export type HandoffActivityEvent = {
  id: string;
  occurredAt: string;
  handoffId: string;
  sourceProviderId: string;
  action: HandoffActivityAction;
  outcome: 'PROPOSED' | 'AUTHORIZED' | 'EXECUTED';
  details?: Readonly<Record<string, unknown>>;
};

export type ActivityEvent = RequirementActivityEvent | HandoffActivityEvent;

export type GoalState = {
  id: string;
  goal: string;
  constraints: GoalConstraints;
  requirements: Requirement[];
  budgetUsed: number;
  budgetRemaining: number;
  progress: number;
  activity: ActivityEvent[];
};

export type CreateGoalStateInput = Omit<
  GoalState,
  'budgetUsed' | 'budgetRemaining' | 'progress'
>;

export type RequirementTransitionInput = {
  requirementId: string;
  toStatus: RequirementStatus;
  eventId: string;
  occurredAt: string;
  providerId?: string;
  estimatedCost?: number;
  blocker?: RequirementBlocker;
  approval?: RequirementApproval;
  details?: Readonly<Record<string, unknown>>;
};

export type RerouteRequirementInput = {
  requirementId: string;
  providerId: string;
  eventId: string;
  occurredAt: string;
  details?: Readonly<Record<string, unknown>>;
};

export type GoalMetrics = Pick<GoalState, 'budgetUsed' | 'budgetRemaining' | 'progress'>;
