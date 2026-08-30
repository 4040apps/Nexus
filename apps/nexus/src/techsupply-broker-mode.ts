import { transitionRequirement } from '@nexus/goal-state';
import type { GoalState, RequirementStatus } from '@nexus/goal-state';
import { canBeginBrokerRouting } from '@nexus/intent-handoff';
import type { IntentHandoff } from '@nexus/intent-handoff';

export const TECHSUPPLY_PROVIDER_ORIGIN = 'http://localhost:4600';
export const TECHSUPPLY_BROKER_TOOL_NAMES = [
  'search_computers',
  'check_inventory',
  'build_computer_package',
] as const;

export type TechSupplyBrokerToolName = (typeof TECHSUPPLY_BROKER_TOOL_NAMES)[number];

export type ThinProviderMetadata = {
  id: string;
  name: string;
  origin: string;
  categories: readonly string[];
  serviceAreas: readonly string[];
  capabilities: readonly string[];
};

export const TECHSUPPLY_DISCOVERY_METADATA: ThinProviderMetadata = {
  id: 'techsupply',
  name: 'TechSupply',
  origin: TECHSUPPLY_PROVIDER_ORIGIN,
  categories: ['computer'],
  serviceAreas: ['Guadalajara'],
  capabilities: TECHSUPPLY_BROKER_TOOL_NAMES,
};

export type TechSupplyToolInvoker = {
  invoke(toolName: TechSupplyBrokerToolName, input: unknown): Promise<unknown>;
};

export type TechSupplyBrokerModeResult = {
  goalState: GoalState;
  provider: ThinProviderMetadata;
  invokedTools: readonly TechSupplyBrokerToolName[];
  fulfilledRequirementId: 'computers';
  remainingRequirementIds: readonly ['internet', 'security'];
  deliveryDate: '2026-09-22';
};

export type TechSupplyBrokerModeErrorCode =
  | 'BROKER_MODE_REQUIRED'
  | 'INVALID_GOAL_STATE'
  | 'PROVIDER_NOT_FOUND'
  | 'PROVIDER_TOOL_FAILED'
  | 'INVALID_PROVIDER_RESULT';

export class TechSupplyBrokerModeError extends Error {
  readonly code: TechSupplyBrokerModeErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: TechSupplyBrokerModeErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'TechSupplyBrokerModeError';
    this.code = code;
    this.details = details;
  }
}

type SearchResult = {
  itemId: string;
  requestedQuantity: 20;
  city: 'Guadalajara';
  unitPrice: 9_500;
  stock: 20;
};

type InventoryResult = {
  itemId: string;
  requestedQuantity: 20;
  stock: 20;
  available: true;
};

type PackageResult = {
  packageId: string;
  itemId: string;
  quantity: 20;
  unitPrice: 9_500;
  totalPrice: 190_000;
  currency: 'MXN';
  deliveryDate: '2026-09-22';
};

export function discoverComputerProvider(
  registry: readonly ThinProviderMetadata[],
  city: string,
): ThinProviderMetadata {
  const provider = registry.find(
    (candidate) =>
      candidate.categories.includes('computer') &&
      candidate.serviceAreas.includes(city) &&
      TECHSUPPLY_BROKER_TOOL_NAMES.every((toolName) =>
        candidate.capabilities.includes(toolName),
      ),
  );

  if (!provider) {
    throw new TechSupplyBrokerModeError(
      'PROVIDER_NOT_FOUND',
      `No thin registry entry can fulfill computers in ${city}.`,
    );
  }
  return {
    ...provider,
    categories: [...provider.categories],
    serviceAreas: [...provider.serviceAreas],
    capabilities: [...provider.capabilities],
  };
}

export async function runTechSupplyBrokerMode(
  initialGoalState: GoalState,
  handoff: IntentHandoff,
  invoker: TechSupplyToolInvoker,
  registry: readonly ThinProviderMetadata[] = [TECHSUPPLY_DISCOVERY_METADATA],
): Promise<TechSupplyBrokerModeResult> {
  if (!canBeginBrokerRouting(handoff)) {
    throw new TechSupplyBrokerModeError(
      'BROKER_MODE_REQUIRED',
      'TechSupply routing requires an explicitly authorized and executed Intent Handoff.',
    );
  }
  assertBrokerStartingState(initialGoalState, handoff);

  const provider = discoverComputerProvider(registry, initialGoalState.constraints.city);
  const invokedTools: TechSupplyBrokerToolName[] = [];
  const invoke = async (toolName: TechSupplyBrokerToolName): Promise<unknown> => {
    invokedTools.push(toolName);
    return unwrapProviderResult(
      toolName,
      await invoker.invoke(toolName, {
        city: initialGoalState.constraints.city,
        quantity: 20,
      }),
    );
  };

  const search = readSearch(await invoke('search_computers'));
  const inventory = readInventory(await invoke('check_inventory'), search.itemId);
  const computerPackage = readPackage(
    await invoke('build_computer_package'),
    search.itemId,
    initialGoalState.constraints.deadline,
  );
  if (inventory.stock < computerPackage.quantity) {
    throw invalidResult('check_inventory', 'TechSupply inventory cannot cover the package quantity.');
  }

  let goalState = move(initialGoalState, 'DISCOVERED', {
    details: {
      summary: 'NEXUS discovered TechSupply from thin metadata for the computer requirement.',
    },
  });
  goalState = move(goalState, 'MATCHED', {
    providerId: provider.id,
    details: {
      toolName: 'search_computers',
      summary: 'TechSupply matched 20 computers from its provider-owned catalog.',
    },
  });
  goalState = move(goalState, 'PROPOSED', {
    estimatedCost: computerPackage.totalPrice,
    details: {
      toolName: 'check_inventory',
      summary: 'TechSupply confirmed exactly 20 computers in stock and prepared the MXN 190,000 plan.',
    },
  });
  goalState = move(goalState, 'FULFILLED', {
    details: {
      toolName: 'build_computer_package',
      deliveryDate: computerPackage.deliveryDate,
      summary: `TechSupply fulfilled 20 computers for MXN 190,000; delivery ${computerPackage.deliveryDate} is before the ${initialGoalState.constraints.deadline} deadline.`,
    },
  });

  return {
    goalState,
    provider,
    invokedTools,
    fulfilledRequirementId: 'computers',
    remainingRequirementIds: ['internet', 'security'],
    deliveryDate: computerPackage.deliveryDate,
  };
}

function assertBrokerStartingState(goalState: GoalState, handoff: IntentHandoff): void {
  const expected = new Map([
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
      return (
        expectedRequirement !== undefined &&
        requirement.status === expectedRequirement.status &&
        requirement.providerId === expectedRequirement.providerId &&
        requirement.estimatedCost === expectedRequirement.estimatedCost
      );
    });
  const handoffRequirements = handoff.remainingRequirements.map(({ id }) => id);

  if (
    handoff.goalId !== goalState.id ||
    !validRequirements ||
    goalState.progress !== 40 ||
    goalState.budgetUsed !== 155_000 ||
    goalState.budgetRemaining !== 345_000 ||
    handoffRequirements.join(',') !== 'computers,internet,security' ||
    !goalState.activity.some((event) => event.action === 'HANDOFF_EXECUTED')
  ) {
    throw new TechSupplyBrokerModeError(
      'INVALID_GOAL_STATE',
      'TechSupply requires the canonical 40% post-handoff Broker Mode Goal State.',
      { goalId: goalState.id, handoffId: handoff.handoffId },
    );
  }
}

function unwrapProviderResult(toolName: TechSupplyBrokerToolName, value: unknown): unknown {
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
    throw new TechSupplyBrokerModeError(
      'PROVIDER_TOOL_FAILED',
      typeof parsed.message === 'string' ? parsed.message : `${toolName} failed.`,
      { toolName, providerCode: parsed.code },
    );
  }
  return parsed.data;
}

function readSearch(value: unknown): SearchResult {
  if (
    !isRecord(value) ||
    typeof value.itemId !== 'string' ||
    value.itemId.length === 0 ||
    value.requestedQuantity !== 20 ||
    value.city !== 'Guadalajara' ||
    value.unitPrice !== 9_500 ||
    value.stock !== 20
  ) {
    throw invalidResult('search_computers', 'TechSupply search facts are invalid for the hero mission.');
  }
  return value as SearchResult;
}

function readInventory(value: unknown, itemId: string): InventoryResult {
  if (
    !isRecord(value) ||
    value.itemId !== itemId ||
    value.requestedQuantity !== 20 ||
    value.stock !== 20 ||
    value.available !== true
  ) {
    throw invalidResult('check_inventory', 'TechSupply must confirm exactly 20 available computers.');
  }
  return value as InventoryResult;
}

function readPackage(value: unknown, itemId: string, deadline: string): PackageResult {
  if (
    !isRecord(value) ||
    typeof value.packageId !== 'string' ||
    value.packageId.length === 0 ||
    value.itemId !== itemId ||
    value.quantity !== 20 ||
    value.unitPrice !== 9_500 ||
    value.totalPrice !== 190_000 ||
    value.currency !== 'MXN' ||
    value.deliveryDate !== '2026-09-22' ||
    value.deliveryDate > deadline
  ) {
    throw invalidResult('build_computer_package', 'TechSupply package facts violate mission constraints.');
  }
  return value as PackageResult;
}

function move(
  state: GoalState,
  toStatus: RequirementStatus,
  options: {
    providerId?: string;
    estimatedCost?: number;
    details?: Readonly<Record<string, unknown>>;
  } = {},
): GoalState {
  const sequence = state.activity.length + 1;
  return transitionRequirement(state, {
    requirementId: 'computers',
    toStatus,
    eventId: `techsupply-broker-${sequence}`,
    occurredAt: new Date(Date.UTC(2026, 7, 30, 16, sequence)).toISOString(),
    ...(options.providerId ? { providerId: options.providerId } : {}),
    ...(options.estimatedCost !== undefined ? { estimatedCost: options.estimatedCost } : {}),
    ...(options.details ? { details: options.details } : {}),
  });
}

function invalidResult(
  toolName: TechSupplyBrokerToolName,
  message: string,
): TechSupplyBrokerModeError {
  return new TechSupplyBrokerModeError('INVALID_PROVIDER_RESULT', message, { toolName });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
