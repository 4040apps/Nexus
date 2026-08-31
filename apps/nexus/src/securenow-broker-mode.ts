import { recordRequirementApproval, transitionRequirement } from '@nexus/goal-state';
import type { GoalState, RequirementApproval, RequirementStatus } from '@nexus/goal-state';
import { canBeginBrokerRouting } from '@nexus/intent-handoff';
import type { IntentHandoff } from '@nexus/intent-handoff';

import type { ThinProviderMetadata } from './techsupply-broker-mode.js';

export const SECURENOW_PROVIDER_ORIGIN = 'http://localhost:4900';
export const SECURENOW_PLANNING_TOOL_NAMES = [
  'assess_security_requirement',
  'build_security_package',
] as const;
export const SECURENOW_COMMIT_TOOL_NAME = 'request_installation' as const;
export const SECURENOW_APPROVAL_SCOPE_ID =
  'goal-office-guadalajara:security:securenow:37500:request_installation';

export type SecureNowPlanningToolName = (typeof SECURENOW_PLANNING_TOOL_NAMES)[number];
export type SecureNowToolName = SecureNowPlanningToolName | typeof SECURENOW_COMMIT_TOOL_NAME;
export type SecureNowToolInvoker = {
  invoke(toolName: SecureNowToolName, input: unknown): Promise<unknown>;
};

export const SECURENOW_DISCOVERY_METADATA: ThinProviderMetadata = {
  id: 'securenow',
  name: 'SecureNow',
  origin: SECURENOW_PROVIDER_ORIGIN,
  categories: ['security'],
  serviceAreas: ['Guadalajara'],
  capabilities: [...SECURENOW_PLANNING_TOOL_NAMES, SECURENOW_COMMIT_TOOL_NAME],
};

export type SecureNowProposal = {
  providerHandle: string;
  providerId: 'securenow';
  requirementId: 'security';
  total: 37_500;
  currency: 'MXN';
  installationDate: '2026-09-27';
  requiredBy: '2026-10-01';
  meetsDeadline: true;
  action: 'request_installation';
  approvalScopeId: typeof SECURENOW_APPROVAL_SCOPE_ID;
};

export type BoundSecureNowApproval = RequirementApproval & {
  required: true;
  approved: true;
  approvalId: string;
  approvedAt: string;
  goalId: 'goal-office-guadalajara';
  requirementId: 'security';
  providerId: 'securenow';
  expectedTotal: 37_500;
  currency: 'MXN';
  action: 'request_installation';
  approvalScopeId: typeof SECURENOW_APPROVAL_SCOPE_ID;
};

export type SecureNowPlanningResult = {
  goalState: GoalState;
  provider: ThinProviderMetadata;
  proposal: SecureNowProposal;
  invokedTools: readonly SecureNowPlanningToolName[];
};

export type SecureNowCommitmentResult = {
  goalState: GoalState;
  invokedTools: readonly [typeof SECURENOW_COMMIT_TOOL_NAME];
  installationDate: '2026-09-27';
};

export type SecureNowBrokerModeErrorCode =
  | 'BROKER_MODE_REQUIRED'
  | 'INVALID_GOAL_STATE'
  | 'PROVIDER_NOT_FOUND'
  | 'PROVIDER_TOOL_FAILED'
  | 'INVALID_PROVIDER_RESULT'
  | 'INVALID_APPROVAL';

export class SecureNowBrokerModeError extends Error {
  readonly code: SecureNowBrokerModeErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: SecureNowBrokerModeErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'SecureNowBrokerModeError';
    this.code = code;
    this.details = details;
  }
}

export function discoverSecurityProvider(
  registry: readonly ThinProviderMetadata[],
  city: string,
): ThinProviderMetadata {
  const provider = registry.find(
    (candidate) =>
      candidate.categories.includes('security') &&
      candidate.serviceAreas.includes(city) &&
      SECURENOW_DISCOVERY_METADATA.capabilities.every((toolName) =>
        candidate.capabilities.includes(toolName),
      ),
  );
  if (!provider) {
    throw new SecureNowBrokerModeError(
      'PROVIDER_NOT_FOUND',
      `No thin registry entry can fulfill security in ${city}.`,
    );
  }
  return {
    ...provider,
    categories: [...provider.categories],
    serviceAreas: [...provider.serviceAreas],
    capabilities: [...provider.capabilities],
  };
}

export async function runSecureNowPlanning(
  initialGoalState: GoalState,
  handoff: IntentHandoff,
  invoker: SecureNowToolInvoker,
  registry: readonly ThinProviderMetadata[] = [SECURENOW_DISCOVERY_METADATA],
): Promise<SecureNowPlanningResult> {
  assertBrokerRouting(handoff);
  assertPostNetBusinessState(initialGoalState, handoff);
  const provider = discoverSecurityProvider(registry, initialGoalState.constraints.city);
  const invokedTools: SecureNowPlanningToolName[] = [];
  const invoke = async (toolName: SecureNowPlanningToolName): Promise<unknown> => {
    invokedTools.push(toolName);
    return unwrapProviderResult(toolName, await invoker.invoke(toolName, {
      city: initialGoalState.constraints.city,
      employees: initialGoalState.constraints.employees,
      requiredBy: initialGoalState.constraints.deadline,
    }));
  };
  readAssessment(await invoke('assess_security_requirement'));
  const securityPackage = readPackage(await invoke('build_security_package'));
  const proposal: SecureNowProposal = {
    providerHandle: securityPackage.packageId,
    providerId: 'securenow',
    requirementId: 'security',
    total: 37_500,
    currency: 'MXN',
    installationDate: '2026-09-27',
    requiredBy: '2026-10-01',
    meetsDeadline: true,
    action: 'request_installation',
    approvalScopeId: SECURENOW_APPROVAL_SCOPE_ID,
  };

  let goalState = move(initialGoalState, 'DISCOVERED', {
    details: { summary: 'NEXUS discovered SecureNow from thin security capability metadata.' },
  });
  goalState = move(goalState, 'MATCHED', {
    providerId: provider.id,
    details: {
      toolName: 'assess_security_requirement',
      summary: 'SecureNow assessed the 20-person Guadalajara office security requirement.',
    },
  });
  goalState = move(goalState, 'PROPOSED', {
    estimatedCost: proposal.total,
    details: {
      toolName: 'build_security_package',
      installationDate: proposal.installationDate,
      summary: 'SecureNow proposed office security for MXN 37,500 with Sep 27 installation.',
    },
  });
  goalState = move(goalState, 'REQUIRES_HUMAN', {
    approval: { required: true, approved: false },
    details: {
      approvalScopeId: proposal.approvalScopeId,
      action: proposal.action,
      summary: 'Human approval required before SecureNow may request installation.',
    },
  });

  return { goalState, provider, proposal, invokedTools };
}

export function createSecureNowApproval(
  goalState: GoalState,
  proposal: SecureNowProposal,
): BoundSecureNowApproval {
  assertAwaitingApproval(goalState, proposal);
  return {
    required: true,
    approved: true,
    approvalId: 'approval-securenow-installation-hero',
    approvedAt: nextOccurredAt(goalState),
    goalId: 'goal-office-guadalajara',
    requirementId: 'security',
    providerId: 'securenow',
    expectedTotal: 37_500,
    currency: 'MXN',
    action: 'request_installation',
    approvalScopeId: SECURENOW_APPROVAL_SCOPE_ID,
  };
}

export function recordSecureNowApproval(
  goalState: GoalState,
  proposal: SecureNowProposal,
  approval: BoundSecureNowApproval = createSecureNowApproval(goalState, proposal),
): GoalState {
  assertAwaitingApproval(goalState, proposal);
  assertBoundApproval(goalState, proposal, approval);
  return recordRequirementApproval(goalState, {
    requirementId: 'security',
    approval,
    eventId: nextEventId(goalState),
    occurredAt: approval.approvedAt,
    details: {
      summary: 'Human approved SecureNow installation for the bound MXN 37,500 proposal.',
    },
  });
}

export function declineSecureNowApproval(goalState: GoalState, proposal: SecureNowProposal): GoalState {
  assertAwaitingApproval(goalState, proposal);
  return goalState;
}

export async function executeSecureNowInstallation(
  approvedGoalState: GoalState,
  proposal: SecureNowProposal,
  invoker: SecureNowToolInvoker,
): Promise<SecureNowCommitmentResult> {
  const approval = readApprovedRequirement(approvedGoalState, proposal);
  const raw = await invoker.invoke(SECURENOW_COMMIT_TOOL_NAME, {
    packageId: proposal.providerHandle,
    approval: toProviderApproval(approval),
  });
  const result = readCommitment(unwrapProviderResult(SECURENOW_COMMIT_TOOL_NAME, raw), proposal);
  const goalState = move(approvedGoalState, 'FULFILLED', {
    approval,
    details: {
      toolName: SECURENOW_COMMIT_TOOL_NAME,
      installationDate: result.installationDate,
      summary: 'SecureNow accepted the approved installation request. Security fulfilled; mission complete.',
    },
  });
  return {
    goalState,
    invokedTools: [SECURENOW_COMMIT_TOOL_NAME],
    installationDate: '2026-09-27',
  };
}

function assertBrokerRouting(handoff: IntentHandoff): void {
  if (!canBeginBrokerRouting(handoff)) {
    throw new SecureNowBrokerModeError(
      'BROKER_MODE_REQUIRED',
      'SecureNow routing requires an explicitly authorized and executed Intent Handoff.',
    );
  }
}

function assertPostNetBusinessState(goalState: GoalState, handoff: IntentHandoff): void {
  const expected = new Map([
    ['desks', { status: 'FULFILLED', providerId: 'officepro', estimatedCost: 80_000 }],
    ['chairs', { status: 'FULFILLED', providerId: 'officepro', estimatedCost: 75_000 }],
    ['computers', { status: 'FULFILLED', providerId: 'techsupply', estimatedCost: 190_000 }],
    ['internet', { status: 'FULFILLED', providerId: 'netbusiness', estimatedCost: 27_500 }],
    ['security', { status: 'PENDING' }],
  ]);
  const validRequirements = goalState.requirements.length === expected.size &&
    goalState.requirements.every((requirement) => {
      const candidate = expected.get(requirement.id);
      return candidate !== undefined && requirement.status === candidate.status &&
        requirement.providerId === candidate.providerId &&
        requirement.estimatedCost === candidate.estimatedCost;
    });
  const internet = goalState.requirements.find(({ id }) => id === 'internet');
  if (
    !validRequirements ||
    handoff.goalId !== goalState.id ||
    handoff.remainingRequirements.map(({ id }) => id).join(',') !== 'computers,internet,security' ||
    goalState.progress !== 80 ||
    goalState.budgetUsed !== 372_500 ||
    goalState.budgetRemaining !== 127_500 ||
    internet?.failureHistory?.at(-1)?.providerId !== 'fibermx' ||
    internet.failureHistory.at(-1)?.blocker.code !== 'DELIVERY_DEADLINE' ||
    !goalState.activity.some((event) => event.action === 'HANDOFF_EXECUTED')
  ) {
    throw new SecureNowBrokerModeError(
      'INVALID_GOAL_STATE',
      'SecureNow requires the canonical 80% post-NetBusiness Broker Mode Goal State.',
    );
  }
}

function assertAwaitingApproval(goalState: GoalState, proposal: SecureNowProposal): void {
  const security = goalState.requirements.find(({ id }) => id === 'security');
  if (
    security?.status !== 'REQUIRES_HUMAN' ||
    security.providerId !== proposal.providerId ||
    security.estimatedCost !== proposal.total ||
    security.approval?.required !== true ||
    security.approval.approved ||
    goalState.progress !== 80 ||
    goalState.budgetUsed !== 372_500
  ) {
    throw new SecureNowBrokerModeError(
      'INVALID_GOAL_STATE',
      'SecureNow approval requires the current pending human-gated proposal.',
    );
  }
}

function assertBoundApproval(
  goalState: GoalState,
  proposal: SecureNowProposal,
  approval: BoundSecureNowApproval,
): void {
  if (
    approval.required !== true ||
    approval.approved !== true ||
    approval.goalId !== goalState.id ||
    approval.requirementId !== proposal.requirementId ||
    approval.providerId !== proposal.providerId ||
    approval.expectedTotal !== proposal.total ||
    approval.currency !== proposal.currency ||
    approval.action !== proposal.action ||
    approval.approvalScopeId !== proposal.approvalScopeId ||
    approval.approvalId.trim().length === 0 ||
    approval.approvedAt.trim().length === 0
  ) {
    throw new SecureNowBrokerModeError(
      'INVALID_APPROVAL',
      'Human approval is stale, malformed, or bound to a different commitment.',
    );
  }
}

function readApprovedRequirement(
  goalState: GoalState,
  proposal: SecureNowProposal,
): BoundSecureNowApproval {
  const security = goalState.requirements.find(({ id }) => id === 'security');
  const approval = security?.approval as BoundSecureNowApproval | undefined;
  if (
    security?.status !== 'REQUIRES_HUMAN' ||
    !approval ||
    !goalState.activity.some((event) =>
      event.action === 'REQUIREMENT_APPROVAL_RECORDED' &&
      event.requirementId === 'security' &&
      event.outcome === 'APPROVED'
    )
  ) {
    throw new SecureNowBrokerModeError('INVALID_APPROVAL', 'SecureNow commitment has no recorded human approval.');
  }
  assertBoundApproval(goalState, proposal, approval);
  return approval;
}

function readAssessment(value: unknown): void {
  if (
    !isRecord(value) ||
    value.city !== 'Guadalajara' ||
    value.employees !== 20 ||
    value.supported !== true ||
    value.requiredBy !== '2026-10-01'
  ) {
    throw invalidResult('assess_security_requirement', 'SecureNow returned an invalid assessment.');
  }
}

function readPackage(value: unknown): { packageId: string } {
  if (
    !isRecord(value) ||
    typeof value.packageId !== 'string' ||
    value.packageId.length === 0 ||
    value.city !== 'Guadalajara' ||
    value.price !== 37_500 ||
    value.currency !== 'MXN' ||
    value.installationDate !== '2026-09-27' ||
    value.requiredBy !== '2026-10-01' ||
    value.meetsDeadline !== true
  ) {
    throw invalidResult('build_security_package', 'SecureNow package facts violate mission constraints.');
  }
  return { packageId: value.packageId };
}

function readCommitment(value: unknown, proposal: SecureNowProposal): { installationDate: '2026-09-27' } {
  if (
    !isRecord(value) ||
    value.status !== 'FULFILLED' ||
    typeof value.confirmationId !== 'string' ||
    value.confirmationId.length === 0 ||
    value.packageId !== proposal.providerHandle ||
    value.price !== proposal.total ||
    value.currency !== proposal.currency ||
    value.installationDate !== proposal.installationDate
  ) {
    throw invalidResult(SECURENOW_COMMIT_TOOL_NAME, 'SecureNow returned an invalid commitment result.');
  }
  return { installationDate: '2026-09-27' };
}

function unwrapProviderResult(toolName: SecureNowToolName, value: unknown): unknown {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw invalidResult(toolName, 'The provider returned non-JSON text.');
    }
  }
  if (!isRecord(parsed) || typeof parsed.ok !== 'boolean') {
    throw invalidResult(toolName, 'The provider result must use the typed ToolResult contract.');
  }
  if (!parsed.ok) {
    throw new SecureNowBrokerModeError(
      'PROVIDER_TOOL_FAILED',
      typeof parsed.message === 'string' ? parsed.message : `${toolName} failed.`,
      { toolName, providerCode: parsed.code },
    );
  }
  return parsed.data;
}

function toProviderApproval(approval: BoundSecureNowApproval) {
  return {
    approved: true as const,
    approvalId: approval.approvalId,
    approvedAt: approval.approvedAt,
    goalId: approval.goalId,
    requirementId: approval.requirementId,
    providerId: approval.providerId,
    expectedTotal: approval.expectedTotal,
    currency: approval.currency,
    action: approval.action,
    approvalScopeId: approval.approvalScopeId,
  };
}

function move(
  state: GoalState,
  toStatus: RequirementStatus,
  options: {
    providerId?: string;
    estimatedCost?: number;
    approval?: RequirementApproval;
    details?: Readonly<Record<string, unknown>>;
  },
): GoalState {
  return transitionRequirement(state, {
    requirementId: 'security',
    toStatus,
    eventId: nextEventId(state),
    occurredAt: nextOccurredAt(state),
    ...options,
  });
}

function nextEventId(state: GoalState): string {
  return `securenow-security-${state.activity.length + 1}`;
}

function nextOccurredAt(state: GoalState): string {
  const sequence = state.activity.length + 1;
  return new Date(Date.UTC(2026, 7, 30, 18, sequence)).toISOString();
}

function invalidResult(toolName: SecureNowToolName, message: string): SecureNowBrokerModeError {
  return new SecureNowBrokerModeError('INVALID_PROVIDER_RESULT', message, { toolName });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
