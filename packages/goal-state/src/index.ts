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

export type Requirement = {
  id: string;
  type: string;
  quantity?: number;
  status: RequirementStatus;
  providerId?: string;
  estimatedCost?: number;
  blocker?: {
    code: string;
    message: string;
  };
  approval?: {
    required: boolean;
    approved: boolean;
  };
};

export type ActivityEvent = {
  id: string;
  occurredAt: string;
  requirementId?: string;
  providerId?: string;
  action: string;
  outcome: string;
  details?: Readonly<Record<string, unknown>>;
};

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

export function isRequirementStatus(value: string): value is RequirementStatus {
  return REQUIREMENT_STATUSES.some((status) => status === value);
}
