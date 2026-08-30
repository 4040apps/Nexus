import {
  createProviderError,
  defineAgentReadyProvider,
  defineProviderTool,
  getProviderDiscoveryMetadata,
  providerSuccess,
} from '@nexus/provider-template';
import type { HumanApproval, ToolValidationResult } from '@nexus/provider-template';

type ComputerInput = { city: string; quantity: number };
type QuoteInput = { packageId: string; approval?: HumanApproval };

const computer = {
  itemId: 'techsupply-business-laptop',
  name: 'Business laptop 14-inch',
  unitPrice: 9_500,
  stock: 20,
} as const;
const packageId = 'techsupply-computers-20';
const deliveryDate = '2026-09-22';

export const techSupplySearchComputers = defineProviderTool({
  name: 'search_computers',
  title: 'Search business computers',
  description: 'Searches TechSupply’s provider-owned computer catalog.',
  operation: 'READ',
  requiresHumanApproval: false,
  inputSchema: computerSchema(),
  validate: validateComputerInput,
  execute(input) {
    return providerSuccess({ ...computer, requestedQuantity: input.quantity, city: input.city });
  },
});

export const techSupplyCheckInventory = defineProviderTool({
  name: 'check_inventory',
  title: 'Check computer inventory',
  description: 'Checks TechSupply’s own stock for the deterministic computer package.',
  operation: 'READ',
  requiresHumanApproval: false,
  inputSchema: computerSchema(),
  validate: validateComputerInput,
  execute(input) {
    return providerSuccess({
      itemId: computer.itemId,
      requestedQuantity: input.quantity,
      stock: computer.stock,
      available: computer.stock >= input.quantity,
    });
  },
});

export const techSupplyBuildComputerPackage = defineProviderTool({
  name: 'build_computer_package',
  title: 'Build computer package',
  description: 'Builds the deterministic 20-computer TechSupply package.',
  operation: 'PLAN',
  requiresHumanApproval: false,
  inputSchema: computerSchema(),
  validate: validateComputerInput,
  execute(input) {
    return providerSuccess({
      packageId,
      itemId: computer.itemId,
      quantity: input.quantity,
      unitPrice: computer.unitPrice,
      totalPrice: computer.unitPrice * input.quantity,
      currency: 'MXN' as const,
      deliveryDate,
    });
  },
});

export const techSupplyRequestQuote = defineProviderTool({
  name: 'request_quote',
  title: 'Request computer quote',
  description: 'Creates the deterministic computer quote after explicit human approval.',
  operation: 'COMMIT',
  requiresHumanApproval: true,
  inputSchema: {
    type: 'object',
    properties: { packageId: { type: 'string' }, approval: { type: 'object' } },
    required: ['packageId'],
    additionalProperties: false,
  },
  validate: validateQuoteInput,
  getApproval: (input) => input.approval,
  execute(input) {
    return providerSuccess({ quoteId: `quote-${input.packageId}`, packageId: input.packageId });
  },
});

export const techSupplyProvider = defineAgentReadyProvider(
  {
    id: 'techsupply',
    name: 'TechSupply',
    description: 'Computer provider for the NEXUS Guadalajara office mission.',
    origin: 'https://techsupply.example',
    categories: ['computers'],
    serviceAreas: ['Guadalajara'],
  },
  [
    techSupplySearchComputers,
    techSupplyCheckInventory,
    techSupplyBuildComputerPackage,
    techSupplyRequestQuote,
  ],
);

export const techSupply = getProviderDiscoveryMetadata(techSupplyProvider);

function computerSchema() {
  return {
    type: 'object',
    properties: {
      city: { type: 'string' },
      quantity: { type: 'number', minimum: 1, maximum: 20 },
    },
    required: ['city', 'quantity'],
    additionalProperties: false,
  } as const;
}

function validateComputerInput(input: unknown): ToolValidationResult<ComputerInput> {
  if (!isRecord(input) || input.city !== 'Guadalajara' || input.quantity !== 20) {
    return invalid('TechSupply requires Guadalajara and exactly 20 computers for this fixture.');
  }
  return { ok: true, value: { city: input.city, quantity: input.quantity } };
}

function validateQuoteInput(input: unknown): ToolValidationResult<QuoteInput> {
  if (!isRecord(input) || input.packageId !== packageId) {
    return invalid(`Quote requires packageId ${packageId}.`);
  }
  const approval = readApproval(input.approval);
  return { ok: true, value: { packageId: input.packageId, ...(approval ? { approval } : {}) } };
}

function readApproval(value: unknown): HumanApproval | undefined {
  if (
    isRecord(value) &&
    value.approved === true &&
    typeof value.approvalId === 'string' &&
    typeof value.approvedAt === 'string'
  ) {
    return { approved: true, approvalId: value.approvalId, approvedAt: value.approvedAt };
  }
  return undefined;
}

function invalid<T>(message: string): ToolValidationResult<T> {
  return { ok: false, error: createProviderError('INVALID_INPUT', message) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
