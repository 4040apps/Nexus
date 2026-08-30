import { transitionRequirement } from '@nexus/goal-state';
import type { GoalState, RequirementStatus } from '@nexus/goal-state';

export const OFFICEPRO_BRAND_TOOL_NAMES = [
  'analyze_office_requirement',
  'search_furniture',
  'build_furniture_package',
  'check_delivery',
] as const;

export type OfficeProBrandToolName = (typeof OFFICEPRO_BRAND_TOOL_NAMES)[number];

export type OfficeProToolInvoker = {
  invoke(toolName: OfficeProBrandToolName, input: unknown): Promise<unknown>;
};

export type OfficeProBrandModeOptions = {
  onGoalStateChange?: (goalState: GoalState) => void;
};

export type OfficeProBrandModeResult = {
  goalState: GoalState;
  mode: 'BRAND';
  brokerModeStarted: false;
  invokedTools: readonly OfficeProBrandToolName[];
  fulfilledRequirementIds: readonly ['desks', 'chairs'];
  remainingRequirementIds: readonly ['computers', 'internet', 'security'];
  continuation: {
    status: 'OFFERED_NOT_AUTHORIZED';
    message: 'OfficePro completed what it could. 3 requirements remain. Continue through NEXUS?';
  };
};

export type OfficeProBrandModeErrorCode =
  | 'INVALID_GOAL_STATE'
  | 'PROVIDER_TOOL_FAILED'
  | 'INVALID_PROVIDER_RESULT';

export class OfficeProBrandModeError extends Error {
  readonly code: OfficeProBrandModeErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: OfficeProBrandModeErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'OfficeProBrandModeError';
    this.code = code;
    this.details = details;
  }
}

type ProviderItem = {
  type: 'desk' | 'chair';
  quantity: number;
  totalPrice: number;
};

export async function runOfficeProBrandMode(
  initialGoalState: GoalState,
  invoker: OfficeProToolInvoker,
  options: OfficeProBrandModeOptions = {},
): Promise<OfficeProBrandModeResult> {
  assertBrandModeStartingState(initialGoalState);

  const invokedTools: OfficeProBrandToolName[] = [];
  const invoke = async (toolName: OfficeProBrandToolName, input: unknown): Promise<unknown> => {
    invokedTools.push(toolName);
    return unwrapProviderResult(toolName, await invoker.invoke(toolName, input));
  };

  const requirementTypes = initialGoalState.requirements.map((requirement) => requirement.type);
  let goalState = initialGoalState;
  const analysis = readAnalysis(
    await invoke('analyze_office_requirement', {
      city: initialGoalState.constraints.city,
      employees: initialGoalState.constraints.employees,
      requirementTypes,
    }),
  );
  assertSupportedScope(analysis.supportedTypes, analysis.unsupportedTypes);
  goalState = move(goalState, 'desks', 'DISCOVERED', {
    details: {
      providerId: 'officepro',
      toolName: 'analyze_office_requirement',
      summary: 'OfficePro confirmed it can fulfill desks and chairs; three requirements remain outside Brand Mode.',
    },
  });
  goalState = move(goalState, 'chairs', 'DISCOVERED', {
    details: {
      providerId: 'officepro',
      summary: 'Chairs are within the OfficePro Brand Mode scope.',
    },
  });
  options.onGoalStateChange?.(goalState);

  const search = readSearch(
    await invoke('search_furniture', {
      city: initialGoalState.constraints.city,
      employees: initialGoalState.constraints.employees,
    }),
  );
  assertStock(search.items, initialGoalState.constraints.employees);
  goalState = move(goalState, 'desks', 'MATCHED', {
    providerId: 'officepro',
    details: {
      toolName: 'search_furniture',
      summary: 'OfficePro checked provider-owned catalog and confirmed stock for 20 desks and 20 chairs.',
    },
  });
  goalState = move(goalState, 'chairs', 'MATCHED', {
    providerId: 'officepro',
    details: { summary: 'OfficePro matched its in-stock chair option to the mission.' },
  });
  options.onGoalStateChange?.(goalState);

  const furniturePackage = readFurniturePackage(
    await invoke('build_furniture_package', {
      city: initialGoalState.constraints.city,
      employees: initialGoalState.constraints.employees,
    }),
  );
  const validatedPackage = assertPackage(
    furniturePackage,
    initialGoalState.constraints.employees,
  );

  const desk = validatedPackage.items.find((item) => item.type === 'desk');
  const chair = validatedPackage.items.find((item) => item.type === 'chair');
  if (!desk || !chair) {
    throw invalidResult('build_furniture_package', 'The furniture package must include desks and chairs.');
  }
  goalState = move(goalState, 'desks', 'PROPOSED', {
    estimatedCost: desk.totalPrice,
    details: {
      toolName: 'build_furniture_package',
      summary: `OfficePro built the MXN 155,000 package; 20 desks account for ${formatMoney(desk.totalPrice)}.`,
    },
  });
  goalState = move(goalState, 'chairs', 'PROPOSED', {
    estimatedCost: chair.totalPrice,
    details: { summary: `20 chairs proposed for ${formatMoney(chair.totalPrice)}.` },
  });
  options.onGoalStateChange?.(goalState);

  const delivery = readDelivery(
    await invoke('check_delivery', {
      city: initialGoalState.constraints.city,
      requiredBy: initialGoalState.constraints.deadline,
    }),
  );
  if (!delivery.meetsDeadline || delivery.availableDate > initialGoalState.constraints.deadline) {
    throw invalidResult('check_delivery', 'OfficePro delivery does not meet the mission deadline.');
  }

  goalState = move(goalState, 'desks', 'FULFILLED', {
    details: {
      toolName: 'check_delivery',
      summary: `Delivery on ${delivery.availableDate} meets the ${delivery.requiredBy} deadline; OfficePro fulfilled 20 desks.`,
    },
  });
  goalState = move(goalState, 'chairs', 'FULFILLED', {
    details: { summary: 'OfficePro fulfilled 20 chairs in Brand Mode.' },
  });
  options.onGoalStateChange?.(goalState);

  return {
    goalState,
    mode: 'BRAND',
    brokerModeStarted: false,
    invokedTools,
    fulfilledRequirementIds: ['desks', 'chairs'],
    remainingRequirementIds: ['computers', 'internet', 'security'],
    continuation: {
      status: 'OFFERED_NOT_AUTHORIZED',
      message: 'OfficePro completed what it could. 3 requirements remain. Continue through NEXUS?',
    },
  };
}

function assertBrandModeStartingState(goalState: GoalState): void {
  const expected = new Map([
    ['desks', 'desk'],
    ['chairs', 'chair'],
    ['computers', 'computer'],
    ['internet', 'internet'],
    ['security', 'security'],
  ]);

  if (
    goalState.activity.length !== 0 ||
    goalState.requirements.length !== expected.size ||
    goalState.requirements.some(
      (requirement) =>
        expected.get(requirement.id) !== requirement.type ||
        requirement.status !== 'PENDING' ||
        requirement.providerId !== undefined,
    )
  ) {
    throw new OfficeProBrandModeError(
      'INVALID_GOAL_STATE',
      'OfficePro Brand Mode must start from the untouched five-requirement hero Goal State.',
    );
  }
}

function unwrapProviderResult(toolName: OfficeProBrandToolName, value: unknown): unknown {
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
    throw new OfficeProBrandModeError(
      'PROVIDER_TOOL_FAILED',
      typeof parsed.message === 'string' ? parsed.message : `${toolName} failed.`,
      { toolName, providerCode: parsed.code },
    );
  }
  return parsed.data;
}

function readAnalysis(value: unknown): { supportedTypes: string[]; unsupportedTypes: string[] } {
  if (!isRecord(value)) throw invalidResult('analyze_office_requirement', 'Missing analysis data.');
  return {
    supportedTypes: readStringArray(value.supportedTypes, 'analyze_office_requirement'),
    unsupportedTypes: readStringArray(value.unsupportedTypes, 'analyze_office_requirement'),
  };
}

function assertSupportedScope(supported: readonly string[], unsupported: readonly string[]): void {
  if (
    !sameMembers(supported, ['desk', 'chair']) ||
    !sameMembers(unsupported, ['computer', 'internet', 'security'])
  ) {
    throw invalidResult(
      'analyze_office_requirement',
      'OfficePro must support only desks and chairs in this deterministic Brand Mode segment.',
    );
  }
}

function readSearch(value: unknown): { items: Record<string, unknown>[] } {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isRecord)) {
    throw invalidResult('search_furniture', 'Search results must contain provider items.');
  }
  return { items: value.items };
}

function assertStock(items: readonly Record<string, unknown>[], quantity: number): void {
  for (const type of ['desk', 'chair'] as const) {
    const item = items.find((candidate) => candidate.type === type);
    if (!item || item.stock !== quantity || item.requestedQuantity !== quantity) {
      throw invalidResult('search_furniture', `OfficePro must confirm stock for ${quantity} ${type}s.`);
    }
  }
}

function readFurniturePackage(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidResult('build_furniture_package', 'Missing furniture package data.');
  }
  return value;
}

function assertPackage(
  value: Record<string, unknown>,
  quantity: number,
): { items: ProviderItem[]; totalPrice: number } {
  if (
    value.currency !== 'MXN' ||
    typeof value.totalPrice !== 'number' ||
    !Number.isFinite(value.totalPrice) ||
    !Array.isArray(value.items)
  ) {
    throw invalidResult('build_furniture_package', 'The package total and currency are invalid.');
  }
  const items = value.items.map((candidate) => readPackageItem(candidate, quantity));
  const calculatedTotal = items.reduce((total, item) => total + item.totalPrice, 0);
  if (items.length !== 2 || calculatedTotal !== value.totalPrice) {
    throw invalidResult('build_furniture_package', 'The provider package total does not match its items.');
  }
  return { items, totalPrice: value.totalPrice };
}

function readPackageItem(value: unknown, quantity: number): ProviderItem {
  if (
    !isRecord(value) ||
    (value.type !== 'desk' && value.type !== 'chair') ||
    value.quantity !== quantity ||
    typeof value.totalPrice !== 'number' ||
    !Number.isFinite(value.totalPrice) ||
    value.totalPrice < 0
  ) {
    throw invalidResult('build_furniture_package', 'The package contains an invalid item.');
  }
  return { type: value.type, quantity: value.quantity, totalPrice: value.totalPrice };
}

function readDelivery(value: unknown): {
  availableDate: string;
  requiredBy: string;
  meetsDeadline: boolean;
} {
  if (
    !isRecord(value) ||
    typeof value.availableDate !== 'string' ||
    typeof value.requiredBy !== 'string' ||
    typeof value.meetsDeadline !== 'boolean'
  ) {
    throw invalidResult('check_delivery', 'The delivery result is invalid.');
  }
  return {
    availableDate: value.availableDate,
    requiredBy: value.requiredBy,
    meetsDeadline: value.meetsDeadline,
  };
}

function move(
  state: GoalState,
  requirementId: string,
  toStatus: RequirementStatus,
  options: {
    providerId?: string;
    estimatedCost?: number;
    details?: Readonly<Record<string, unknown>>;
  } = {},
): GoalState {
  const sequence = state.activity.length + 1;
  const occurredAt = new Date(Date.UTC(2026, 7, 30, 16, sequence)).toISOString();

  return transitionRequirement(state, {
    requirementId,
    toStatus,
    eventId: `officepro-brand-${sequence}`,
    occurredAt,
    ...(options.providerId ? { providerId: options.providerId } : {}),
    ...(options.estimatedCost !== undefined ? { estimatedCost: options.estimatedCost } : {}),
    ...(options.details ? { details: options.details } : {}),
  });
}

function invalidResult(toolName: OfficeProBrandToolName, message: string): OfficeProBrandModeError {
  return new OfficeProBrandModeError('INVALID_PROVIDER_RESULT', message, { toolName });
}

function readStringArray(value: unknown, toolName: OfficeProBrandToolName): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw invalidResult(toolName, 'Expected a string array.');
  }
  return value;
}

function sameMembers(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every((value) => actual.includes(value));
}

function formatMoney(value: number): string {
  return `MXN ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
