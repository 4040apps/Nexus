import type { GoalState } from '@nexus/goal-state';

export type ProviderMode = 'BRAND';
export type NexusMode = 'BROKER';
export type HandoffStatus = 'PROPOSED' | 'AUTHORIZED' | 'EXECUTED';

export type HandoffRequirement = {
  id: string;
  type: string;
  quantity?: number;
};

export type HandoffConstraints = {
  city: string;
  deadline: string;
  remainingBudget: number;
  currency: 'MXN';
};

type HandoffBase = {
  handoffId: string;
  goalId: string;
  source: {
    providerId: string;
    mode: ProviderMode;
  };
  destination: {
    type: 'NEXUS';
    mode: NexusMode;
  };
  remainingRequirements: HandoffRequirement[];
  constraints: HandoffConstraints;
};

export type IntentHandoffProposal = HandoffBase & {
  status: 'PROPOSED';
  authorizedByUser: false;
  authorization: {
    required: true;
    approved: false;
  };
};

export type AuthorizedIntentHandoff = HandoffBase & {
  status: 'AUTHORIZED';
  authorizedByUser: true;
  authorization: {
    required: true;
    approved: true;
    approvedAt: string;
  };
};

export type IntentHandoff = HandoffBase & {
  status: 'EXECUTED';
  authorizedByUser: true;
  authorization: {
    required: true;
    approved: true;
    approvedAt: string;
  };
  executedAt: string;
};

export type IntentHandoffLifecycle =
  | IntentHandoffProposal
  | AuthorizedIntentHandoff
  | IntentHandoff;

export type HandoffEligibility = {
  status: 'FULFILLED' | 'PARTIAL' | 'UNFULFILLED';
  sourceProviderId: string;
  fulfilledRequirementIds: string[];
  remainingRequirements: HandoffRequirement[];
  handoffAvailable: boolean;
  handoffAuthorized: false;
};

export type ProposeIntentHandoffInput = {
  handoffId: string;
  sourceProviderId: string;
  eventId: string;
  occurredAt: string;
};

export type AuthorizeIntentHandoffInput = {
  authorizedByUser: true;
  approvedAt: string;
  eventId: string;
};

export type ExecuteIntentHandoffInput = {
  executedAt: string;
  eventId: string;
};

export type HandoffResult<THandoff extends IntentHandoffLifecycle> = {
  goalState: GoalState;
  handoff: THandoff;
};
