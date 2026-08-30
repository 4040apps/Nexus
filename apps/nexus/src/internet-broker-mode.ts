import { rerouteRequirement, transitionRequirement } from '@nexus/goal-state';
import type { GoalState, RequirementStatus } from '@nexus/goal-state';
import { canBeginBrokerRouting } from '@nexus/intent-handoff';
import type { IntentHandoff } from '@nexus/intent-handoff';

import type { ThinProviderMetadata } from './techsupply-broker-mode.js';

export const FIBERMX_PROVIDER_ORIGIN = 'http://localhost:4700';
export const NETBUSINESS_PROVIDER_ORIGIN = 'http://localhost:4800';
export const INTERNET_BROKER_TOOL_NAMES = [
  'check_coverage',
  'check_installation_date',
  'build_connectivity_offer',
] as const;

export type InternetBrokerToolName = (typeof INTERNET_BROKER_TOOL_NAMES)[number];
export type InternetToolInvoker = {
  invoke(toolName: InternetBrokerToolName, input: unknown): Promise<unknown>;
};

export const FIBERMX_DISCOVERY_METADATA: ThinProviderMetadata = {
  id: 'fibermx',
  name: 'FiberMX',
  origin: FIBERMX_PROVIDER_ORIGIN,
  categories: ['internet'],
  serviceAreas: ['Guadalajara'],
  capabilities: INTERNET_BROKER_TOOL_NAMES,
};

export const NETBUSINESS_DISCOVERY_METADATA: ThinProviderMetadata = {
  id: 'netbusiness',
  name: 'NetBusiness',
  origin: NETBUSINESS_PROVIDER_ORIGIN,
  categories: ['internet'],
  serviceAreas: ['Guadalajara'],
  capabilities: INTERNET_BROKER_TOOL_NAMES,
};

export type FiberMxBlockedResult = {
  goalState: GoalState;
  provider: ThinProviderMetadata;
  invokedTools: readonly InternetBrokerToolName[];
  blocker: { code: 'DELIVERY_DEADLINE'; message: string };
  availableDate: '2026-10-08';
};

export type NetBusinessRecoveryResult = {
  goalState: GoalState;
  provider: ThinProviderMetadata;
  invokedTools: readonly InternetBrokerToolName[];
  installationDate: '2026-09-25';
};

export type InternetBrokerModeErrorCode =
  | 'BROKER_MODE_REQUIRED'
  | 'INVALID_GOAL_STATE'
  | 'PROVIDER_NOT_FOUND'
  | 'PROVIDER_TOOL_FAILED'
  | 'INVALID_PROVIDER_RESULT';

export class InternetBrokerModeError extends Error {
  readonly code: InternetBrokerModeErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: InternetBrokerModeErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'InternetBrokerModeError';
    this.code = code;
    this.details = details;
  }
}

type CoverageResult = {
  city: 'Guadalajara';
  covered: true;
  serviceAvailable: true;
};

type InstallationResult = {
  status: 'BLOCKED' | 'FULFILLED';
  providerId: 'fibermx' | 'netbusiness';
  coverage: true;
  serviceAvailable: true;
  availableDate: '2026-10-08' | '2026-09-25';
  requiredBy: '2026-10-01';
  meetsDeadline: boolean;
  code?: 'DELIVERY_DEADLINE' | null;
  message?: string;
};

type ConnectivityOffer = InstallationResult & {
  offerId: string;
  price: 24_000 | 27_500;
  currency: 'MXN';
};

export function discoverInternetProvider(
  registry: readonly ThinProviderMetadata[],
  city: string,
  excludedProviderIds: readonly string[] = [],
): ThinProviderMetadata {
  const provider = registry.find(
    (candidate) =>
      !excludedProviderIds.includes(candidate.id) &&
      candidate.categories.includes('internet') &&
      candidate.serviceAreas.includes(city) &&
      INTERNET_BROKER_TOOL_NAMES.every((toolName) => candidate.capabilities.includes(toolName)),
  );
  if (!provider) {
    throw new InternetBrokerModeError(
      'PROVIDER_NOT_FOUND',
      `No thin registry entry can fulfill internet in ${city}.`,
    );
  }
  return cloneMetadata(provider);
}

export async function runFiberMxInternetRoute(
  initialGoalState: GoalState,
  handoff: IntentHandoff,
  invoker: InternetToolInvoker,
  registry: readonly ThinProviderMetadata[] = [FIBERMX_DISCOVERY_METADATA],
): Promise<FiberMxBlockedResult> {
  assertBrokerRouting(handoff);
  assertPostTechSupplyState(initialGoalState, handoff);
  const provider = discoverInternetProvider(registry, initialGoalState.constraints.city);
  if (provider.id !== 'fibermx') {
    throw new InternetBrokerModeError('PROVIDER_NOT_FOUND', 'The first internet route must select FiberMX.');
  }

  const invokedTools: InternetBrokerToolName[] = [];
  const invoke = createInvoker(invoker, invokedTools, initialGoalState);
  readCoverage(await invoke('check_coverage'), 'fibermx');
  const installation = readInstallation(
    await invoke('check_installation_date'),
    'fibermx',
    '2026-10-08',
    false,
  );
  const offer = readOffer(
    await invoke('build_connectivity_offer'),
    'fibermx',
    '2026-10-08',
    24_000,
    false,
  );
  const blocker = {
    code: 'DELIVERY_DEADLINE' as const,
    message: `FiberMX coverage is valid, but installation ${installation.availableDate} is after the mission deadline ${installation.requiredBy}.`,
  };

  let goalState = move(initialGoalState, 'DISCOVERED', 'fibermx', {
    summary: 'NEXUS discovered FiberMX from thin internet capability metadata.',
  });
  goalState = move(goalState, 'MATCHED', 'fibermx', {
    toolName: 'check_coverage',
    summary: 'FiberMX confirmed provider-owned Guadalajara coverage.',
  });
  goalState = move(goalState, 'PROPOSED', 'fibermx', {
    toolName: 'build_connectivity_offer',
    summary: 'FiberMX proposed connectivity; its MXN 24,000 offer is not committed.',
  }, offer.price);
  goalState = transitionRequirement(goalState, {
    requirementId: 'internet',
    toStatus: 'BLOCKED',
    eventId: nextEventId(goalState, 'fibermx'),
    occurredAt: nextOccurredAt(goalState),
    blocker,
    details: {
      toolName: 'check_installation_date',
      availableDate: installation.availableDate,
      requiredBy: installation.requiredBy,
      summary: blocker.message,
    },
  });

  return { goalState, provider, invokedTools, blocker, availableDate: '2026-10-08' };
}

export async function runNetBusinessInternetRecovery(
  blockedGoalState: GoalState,
  handoff: IntentHandoff,
  invoker: InternetToolInvoker,
  registry: readonly ThinProviderMetadata[] = [NETBUSINESS_DISCOVERY_METADATA],
): Promise<NetBusinessRecoveryResult> {
  assertBrokerRouting(handoff);
  assertFiberMxBlockedState(blockedGoalState);
  const provider = discoverInternetProvider(
    registry,
    blockedGoalState.constraints.city,
    ['fibermx'],
  );
  if (provider.id !== 'netbusiness') {
    throw new InternetBrokerModeError('PROVIDER_NOT_FOUND', 'Recovery must select NetBusiness.');
  }

  const invokedTools: InternetBrokerToolName[] = [];
  const invoke = createInvoker(invoker, invokedTools, blockedGoalState);
  readCoverage(await invoke('check_coverage'), 'netbusiness');
  const installation = readInstallation(
    await invoke('check_installation_date'),
    'netbusiness',
    '2026-09-25',
    true,
  );
  const offer = readOffer(
    await invoke('build_connectivity_offer'),
    'netbusiness',
    '2026-09-25',
    27_500,
    true,
  );

  let goalState = rerouteRequirement(blockedGoalState, {
    requirementId: 'internet',
    providerId: provider.id,
    eventId: nextEventId(blockedGoalState, 'netbusiness'),
    occurredAt: nextOccurredAt(blockedGoalState),
    details: {
      toolName: 'check_coverage',
      summary: 'NEXUS preserved the FiberMX failure and rerouted only internet to NetBusiness.',
    },
  });
  goalState = move(goalState, 'PROPOSED', 'netbusiness', {
    toolName: 'build_connectivity_offer',
    summary: 'NetBusiness proposed connectivity for MXN 27,500 with a pre-deadline installation.',
  }, offer.price);
  goalState = move(goalState, 'FULFILLED', 'netbusiness', {
    toolName: 'check_installation_date',
    availableDate: installation.availableDate,
    summary: `NetBusiness fulfilled internet for MXN 27,500; installation ${installation.availableDate} is before the ${installation.requiredBy} deadline.`,
  });

  return { goalState, provider, invokedTools, installationDate: '2026-09-25' };
}

function assertBrokerRouting(handoff: IntentHandoff): void {
  if (!canBeginBrokerRouting(handoff)) {
    throw new InternetBrokerModeError(
      'BROKER_MODE_REQUIRED',
      'Internet routing requires an explicitly authorized and executed Intent Handoff.',
    );
  }
}

function assertPostTechSupplyState(goalState: GoalState, handoff: IntentHandoff): void {
  const expected = new Map([
    ['desks', { status: 'FULFILLED', providerId: 'officepro', estimatedCost: 80_000 }],
    ['chairs', { status: 'FULFILLED', providerId: 'officepro', estimatedCost: 75_000 }],
    ['computers', { status: 'FULFILLED', providerId: 'techsupply', estimatedCost: 190_000 }],
    ['internet', { status: 'PENDING' }],
    ['security', { status: 'PENDING' }],
  ]);
  const internet = goalState.requirements.find(({ id }) => id === 'internet');
  const security = goalState.requirements.find(({ id }) => id === 'security');
  const computers = goalState.requirements.find(({ id }) => id === 'computers');
  const handedOffRequirementIds = handoff.remainingRequirements.map(({ id }) => id).join(',');
  const canonicalRequirements =
    goalState.requirements.length === expected.size &&
    goalState.requirements.every((requirement) => {
      const candidate = expected.get(requirement.id);
      return candidate !== undefined &&
        requirement.status === candidate.status &&
        requirement.providerId === candidate.providerId &&
        requirement.estimatedCost === candidate.estimatedCost;
    });
  if (
    !canonicalRequirements ||
    handoff.goalId !== goalState.id ||
    handedOffRequirementIds !== 'computers,internet,security' ||
    goalState.progress !== 60 ||
    goalState.budgetUsed !== 345_000 ||
    goalState.budgetRemaining !== 155_000 ||
    internet?.status !== 'PENDING' ||
    internet.providerId !== undefined ||
    security?.status !== 'PENDING' ||
    security.providerId !== undefined ||
    computers?.status !== 'FULFILLED' ||
    computers.providerId !== 'techsupply' ||
    !goalState.activity.some((event) => event.action === 'HANDOFF_EXECUTED')
  ) {
    throw new InternetBrokerModeError(
      'INVALID_GOAL_STATE',
      'FiberMX requires the canonical 60% post-TechSupply Broker Mode Goal State.',
    );
  }
}

function assertFiberMxBlockedState(goalState: GoalState): void {
  const internet = goalState.requirements.find(({ id }) => id === 'internet');
  if (
    goalState.progress !== 60 ||
    goalState.budgetUsed !== 345_000 ||
    goalState.budgetRemaining !== 155_000 ||
    internet?.status !== 'BLOCKED' ||
    internet.providerId !== 'fibermx' ||
    internet.blocker?.code !== 'DELIVERY_DEADLINE' ||
    internet.failureHistory?.at(-1)?.providerId !== 'fibermx'
  ) {
    throw new InternetBrokerModeError(
      'INVALID_GOAL_STATE',
      'NetBusiness recovery requires the canonical FiberMX deadline-blocked Goal State.',
    );
  }
}

function createInvoker(
  invoker: InternetToolInvoker,
  invokedTools: InternetBrokerToolName[],
  goalState: GoalState,
) {
  return async (toolName: InternetBrokerToolName): Promise<unknown> => {
    invokedTools.push(toolName);
    return unwrapProviderResult(
      toolName,
      await invoker.invoke(toolName, {
        city: goalState.constraints.city,
        requiredBy: goalState.constraints.deadline,
      }),
    );
  };
}

function readCoverage(value: unknown, providerId: string): CoverageResult {
  if (
    !isRecord(value) ||
    value.city !== 'Guadalajara' ||
    value.covered !== true ||
    value.serviceAvailable !== true
  ) {
    throw invalidResult('check_coverage', `${providerId} returned invalid coverage facts.`);
  }
  return value as CoverageResult;
}

function readInstallation(
  value: unknown,
  providerId: 'fibermx' | 'netbusiness',
  availableDate: '2026-10-08' | '2026-09-25',
  meetsDeadline: boolean,
): InstallationResult {
  if (
    !isRecord(value) ||
    value.providerId !== providerId ||
    value.coverage !== true ||
    value.serviceAvailable !== true ||
    value.availableDate !== availableDate ||
    value.requiredBy !== '2026-10-01' ||
    value.meetsDeadline !== meetsDeadline ||
    value.status !== (meetsDeadline ? 'FULFILLED' : 'BLOCKED') ||
    (!meetsDeadline && value.code !== 'DELIVERY_DEADLINE')
  ) {
    throw invalidResult('check_installation_date', `${providerId} returned invalid installation facts.`);
  }
  return value as InstallationResult;
}

function readOffer(
  value: unknown,
  providerId: 'fibermx' | 'netbusiness',
  availableDate: '2026-10-08' | '2026-09-25',
  price: 24_000 | 27_500,
  meetsDeadline: boolean,
): ConnectivityOffer {
  const installation = readInstallation(value, providerId, availableDate, meetsDeadline);
  if (
    !isRecord(value) ||
    typeof value.offerId !== 'string' ||
    value.offerId.length === 0 ||
    value.price !== price ||
    value.currency !== 'MXN'
  ) {
    throw invalidResult('build_connectivity_offer', `${providerId} returned invalid offer facts.`);
  }
  return { ...installation, offerId: value.offerId, price, currency: 'MXN' };
}

function unwrapProviderResult(toolName: InternetBrokerToolName, value: unknown): unknown {
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
    throw new InternetBrokerModeError(
      'PROVIDER_TOOL_FAILED',
      typeof parsed.message === 'string' ? parsed.message : `${toolName} failed.`,
      { toolName, providerCode: parsed.code },
    );
  }
  return parsed.data;
}

function move(
  state: GoalState,
  toStatus: RequirementStatus,
  providerId: string,
  details: Readonly<Record<string, unknown>>,
  estimatedCost?: number,
): GoalState {
  return transitionRequirement(state, {
    requirementId: 'internet',
    toStatus,
    providerId,
    eventId: nextEventId(state, providerId),
    occurredAt: nextOccurredAt(state),
    ...(estimatedCost === undefined ? {} : { estimatedCost }),
    details,
  });
}

function nextEventId(state: GoalState, providerId: string): string {
  return `${providerId}-internet-${state.activity.length + 1}`;
}

function nextOccurredAt(state: GoalState): string {
  const sequence = state.activity.length + 1;
  return new Date(Date.UTC(2026, 7, 30, 17, sequence)).toISOString();
}

function cloneMetadata(provider: ThinProviderMetadata): ThinProviderMetadata {
  return {
    ...provider,
    categories: [...provider.categories],
    serviceAreas: [...provider.serviceAreas],
    capabilities: [...provider.capabilities],
  };
}

function invalidResult(toolName: InternetBrokerToolName, message: string): InternetBrokerModeError {
  return new InternetBrokerModeError('INVALID_PROVIDER_RESULT', message, { toolName });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
