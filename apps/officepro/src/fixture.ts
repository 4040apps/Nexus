import {
  createProviderError,
  defineAgentReadyProvider,
  defineProviderTool,
  getProviderDiscoveryMetadata,
  providerSuccess,
} from '@nexus/provider-template';
import type { HumanApproval, ToolValidationResult } from '@nexus/provider-template';

type OfficeRequirementInput = { city: string; employees: number };
type OfficeAnalysisInput = OfficeRequirementInput & { requirementTypes: string[] };
type DeliveryInput = { city: string; requiredBy: string };
type QuoteInput = { packageId: string; approval?: HumanApproval };

const catalog = [
  {
    itemId: 'officepro-desk-standard',
    type: 'desk',
    name: 'Commercial work desk',
    unitPrice: 4_000,
    stock: 20,
  },
  {
    itemId: 'officepro-chair-ergonomic',
    type: 'chair',
    name: 'Ergonomic task chair',
    unitPrice: 3_750,
    stock: 20,
  },
] as const;

const deliveryDate = '2026-09-20';
const packageId = 'officepro-furniture-20';

export const officeProAnalyzeOfficeRequirement = defineProviderTool({
  name: 'analyze_office_requirement',
  title: 'Analyze office requirement',
  description: 'Identifies which office requirements OfficePro can fulfill.',
  operation: 'PLAN',
  requiresHumanApproval: false,
  inputSchema: {
    type: 'object',
    properties: {
      city: { type: 'string' },
      employees: { type: 'number', minimum: 1 },
      requirementTypes: { type: 'array', items: { type: 'string' } },
    },
    required: ['city', 'employees', 'requirementTypes'],
    additionalProperties: false,
  },
  validate: validateAnalysisInput,
  execute(input) {
    const supportedTypes = input.requirementTypes.filter((type) =>
      ['desk', 'chair'].includes(type),
    );
    return providerSuccess({
      city: input.city,
      employees: input.employees,
      supportedTypes,
      unsupportedTypes: input.requirementTypes.filter((type) => !supportedTypes.includes(type)),
    });
  },
});

export const officeProSearchFurniture = defineProviderTool({
  name: 'search_furniture',
  title: 'Search furniture',
  description: 'Searches OfficePro’s provider-owned furniture catalog and stock.',
  operation: 'READ',
  requiresHumanApproval: false,
  inputSchema: officeRequirementSchema(),
  validate: validateOfficeRequirement,
  execute(input) {
    return providerSuccess({
      city: input.city,
      items: catalog.map((item) => ({ ...item, requestedQuantity: input.employees })),
    });
  },
});

export const officeProBuildFurniturePackage = defineProviderTool({
  name: 'build_furniture_package',
  title: 'Build furniture package',
  description: 'Builds the deterministic OfficePro desk and chair package for the mission.',
  operation: 'PLAN',
  requiresHumanApproval: false,
  inputSchema: officeRequirementSchema(),
  validate: validateOfficeRequirement,
  execute(input) {
    const items = catalog.map((item) => ({
      itemId: item.itemId,
      type: item.type,
      quantity: input.employees,
      unitPrice: item.unitPrice,
      totalPrice: item.unitPrice * input.employees,
    }));
    return providerSuccess({
      packageId,
      city: input.city,
      employees: input.employees,
      items,
      totalPrice: items.reduce((total, item) => total + item.totalPrice, 0),
      currency: 'MXN' as const,
      deliveryDate,
    });
  },
});

export const officeProCheckDelivery = defineProviderTool({
  name: 'check_delivery',
  title: 'Check delivery',
  description: 'Checks OfficePro’s deterministic delivery date against a required date.',
  operation: 'READ',
  requiresHumanApproval: false,
  inputSchema: {
    type: 'object',
    properties: { city: { type: 'string' }, requiredBy: { type: 'string' } },
    required: ['city', 'requiredBy'],
    additionalProperties: false,
  },
  validate: validateDeliveryInput,
  execute(input) {
    return providerSuccess({
      city: input.city,
      availableDate: deliveryDate,
      requiredBy: input.requiredBy,
      meetsDeadline: deliveryDate <= input.requiredBy,
    });
  },
});

export const officeProRequestQuote = defineProviderTool({
  name: 'request_quote',
  title: 'Request furniture quote',
  description: 'Creates the deterministic furniture quote after explicit human approval.',
  operation: 'COMMIT',
  requiresHumanApproval: true,
  inputSchema: quoteSchema(),
  validate: validateQuoteInput,
  getApproval: (input) => input.approval,
  execute(input) {
    return providerSuccess({ quoteId: `quote-${input.packageId}`, packageId: input.packageId });
  },
});

export const officeProProvider = defineAgentReadyProvider(
  {
    id: 'officepro',
    name: 'OfficePro',
    description: 'Furniture provider for the NEXUS Guadalajara office mission.',
    origin: 'https://officepro.example',
    categories: ['furniture'],
    serviceAreas: ['Guadalajara'],
  },
  [
    officeProAnalyzeOfficeRequirement,
    officeProSearchFurniture,
    officeProBuildFurniturePackage,
    officeProCheckDelivery,
    officeProRequestQuote,
  ],
);

export const officePro = getProviderDiscoveryMetadata(officeProProvider);

function officeRequirementSchema() {
  return {
    type: 'object',
    properties: {
      city: { type: 'string' },
      employees: { type: 'number', minimum: 1, maximum: 20 },
    },
    required: ['city', 'employees'],
    additionalProperties: false,
  } as const;
}

function quoteSchema() {
  return {
    type: 'object',
    properties: { packageId: { type: 'string' }, approval: { type: 'object' } },
    required: ['packageId'],
    additionalProperties: false,
  } as const;
}

function validateOfficeRequirement(input: unknown): ToolValidationResult<OfficeRequirementInput> {
  if (!isRecord(input) || input.city !== 'Guadalajara' || input.employees !== 20) {
    return invalid('OfficePro requires Guadalajara and exactly 20 employees for this fixture.');
  }
  return { ok: true, value: { city: input.city, employees: input.employees } };
}

function validateAnalysisInput(input: unknown): ToolValidationResult<OfficeAnalysisInput> {
  const requirement = validateOfficeRequirement(input);
  if (!requirement.ok) return requirement;
  if (
    !isRecord(input) ||
    !Array.isArray(input.requirementTypes) ||
    !input.requirementTypes.every((type) => typeof type === 'string')
  ) {
    return invalid('requirementTypes must be a string array.');
  }
  return {
    ok: true,
    value: { ...requirement.value, requirementTypes: input.requirementTypes },
  };
}

function validateDeliveryInput(input: unknown): ToolValidationResult<DeliveryInput> {
  if (!isRecord(input) || input.city !== 'Guadalajara' || typeof input.requiredBy !== 'string') {
    return invalid('Delivery requires Guadalajara and a requiredBy date.');
  }
  return { ok: true, value: { city: input.city, requiredBy: input.requiredBy } };
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
