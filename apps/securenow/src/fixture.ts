import {
  createProviderError,
  defineAgentReadyProvider,
  defineProviderTool,
  getProviderDiscoveryMetadata,
  providerSuccess,
} from '@nexus/provider-template';
import type { HumanApproval, ToolValidationResult } from '@nexus/provider-template';

type SecurityInput = { city: string; employees: number; requiredBy: string };
type InstallationInput = { packageId: string; approval?: HumanApproval };

const packageId = 'securenow-office-20';
const installationDate = '2026-09-27';
const packagePrice = 37_500;

export const secureNowAssessSecurityRequirement = defineProviderTool({
  name: 'assess_security_requirement',
  title: 'Assess security requirement',
  description: 'Assesses the deterministic security requirement without making a commitment.',
  operation: 'READ',
  requiresHumanApproval: false,
  inputSchema: securitySchema(),
  validate: validateSecurityInput,
  execute(input) {
    return providerSuccess({
      city: input.city,
      employees: input.employees,
      supported: true,
      recommendedCameras: 4,
      accessPoints: 2,
      requiredBy: input.requiredBy,
    });
  },
});

export const secureNowBuildSecurityPackage = defineProviderTool({
  name: 'build_security_package',
  title: 'Build security package',
  description: 'Builds the deterministic SecureNow package without committing installation.',
  operation: 'PLAN',
  requiresHumanApproval: false,
  inputSchema: securitySchema(),
  validate: validateSecurityInput,
  execute(input) {
    return providerSuccess({
      packageId,
      city: input.city,
      components: [
        { type: 'camera', quantity: 4 },
        { type: 'access-control', quantity: 2 },
      ],
      price: packagePrice,
      currency: 'MXN' as const,
      installationDate,
      requiredBy: input.requiredBy,
      meetsDeadline: installationDate <= input.requiredBy,
    });
  },
});

export const secureNowRequestInstallation = defineProviderTool({
  name: 'request_installation',
  title: 'Request security installation',
  description: 'Commits the SecureNow installation only after explicit human approval.',
  operation: 'COMMIT',
  requiresHumanApproval: true,
  inputSchema: {
    type: 'object',
    properties: { packageId: { type: 'string' }, approval: { type: 'object' } },
    required: ['packageId'],
    additionalProperties: false,
  },
  validate: validateInstallationInput,
  getApproval: (input) => input.approval,
  execute(input) {
    return providerSuccess({
      status: 'FULFILLED' as const,
      confirmationId: `installation-${input.packageId}`,
      packageId: input.packageId,
      price: packagePrice,
      currency: 'MXN' as const,
      installationDate,
    });
  },
});

export const secureNowProvider = defineAgentReadyProvider(
  {
    id: 'securenow',
    name: 'SecureNow',
    description: 'Security provider with an explicit human approval commitment boundary.',
    origin: 'https://securenow.example',
    categories: ['security'],
    serviceAreas: ['Guadalajara'],
  },
  [
    secureNowAssessSecurityRequirement,
    secureNowBuildSecurityPackage,
    secureNowRequestInstallation,
  ],
);

export const secureNow = getProviderDiscoveryMetadata(secureNowProvider);

function securitySchema() {
  return {
    type: 'object',
    properties: {
      city: { type: 'string' },
      employees: { type: 'number', minimum: 1, maximum: 20 },
      requiredBy: { type: 'string' },
    },
    required: ['city', 'employees', 'requiredBy'],
    additionalProperties: false,
  } as const;
}

function validateSecurityInput(input: unknown): ToolValidationResult<SecurityInput> {
  if (
    !isRecord(input) ||
    input.city !== 'Guadalajara' ||
    input.employees !== 20 ||
    typeof input.requiredBy !== 'string'
  ) {
    return invalid('SecureNow requires the 20-person Guadalajara mission and requiredBy date.');
  }
  return {
    ok: true,
    value: { city: input.city, employees: input.employees, requiredBy: input.requiredBy },
  };
}

function validateInstallationInput(input: unknown): ToolValidationResult<InstallationInput> {
  if (!isRecord(input) || input.packageId !== packageId) {
    return invalid(`Installation requires packageId ${packageId}.`);
  }
  const approval = readApproval(input.approval);
  return { ok: true, value: { packageId: input.packageId, ...(approval ? { approval } : {}) } };
}

function readApproval(value: unknown): HumanApproval | undefined {
  if (
    isRecord(value) &&
    value.approved === true &&
    typeof value.approvalId === 'string' &&
    typeof value.approvedAt === 'string' &&
    value.goalId === 'goal-office-guadalajara' &&
    value.requirementId === 'security' &&
    value.providerId === 'securenow' &&
    value.expectedTotal === packagePrice &&
    value.currency === 'MXN' &&
    value.action === 'request_installation' &&
    value.approvalScopeId === 'goal-office-guadalajara:security:securenow:37500:request_installation'
  ) {
    return {
      approved: true,
      approvalId: value.approvalId,
      approvedAt: value.approvedAt,
      goalId: value.goalId,
      requirementId: value.requirementId,
      providerId: value.providerId,
      expectedTotal: value.expectedTotal,
      currency: value.currency,
      action: value.action,
      approvalScopeId: value.approvalScopeId,
    };
  }
  return undefined;
}

function invalid<T>(message: string): ToolValidationResult<T> {
  return { ok: false, error: createProviderError('INVALID_INPUT', message) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
