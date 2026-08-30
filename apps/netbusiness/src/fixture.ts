import {
  createProviderError,
  defineAgentReadyProvider,
  defineProviderTool,
  getProviderDiscoveryMetadata,
  providerSuccess,
} from '@nexus/provider-template';
import type { ToolValidationResult } from '@nexus/provider-template';

type CoverageInput = { city: string };
type InstallationInput = { city: string; requiredBy: string };

const installationDate = '2026-09-25';
const offerPrice = 27_500;

export const netBusinessCheckCoverage = defineProviderTool({
  name: 'check_coverage',
  title: 'Check NetBusiness coverage',
  description: 'Checks NetBusiness’s provider-owned Guadalajara coverage.',
  operation: 'READ',
  requiresHumanApproval: false,
  inputSchema: coverageSchema(),
  validate: validateCoverageInput,
  execute(input) {
    return providerSuccess({ city: input.city, covered: true, serviceAvailable: true });
  },
});

export const netBusinessCheckInstallationDate = defineProviderTool({
  name: 'check_installation_date',
  title: 'Check NetBusiness installation date',
  description: 'Checks the deterministic NetBusiness installation date.',
  operation: 'READ',
  requiresHumanApproval: false,
  inputSchema: installationSchema(),
  validate: validateInstallationInput,
  execute(input) {
    return providerSuccess(installationAssessment(input.requiredBy));
  },
});

export const netBusinessBuildConnectivityOffer = defineProviderTool({
  name: 'build_connectivity_offer',
  title: 'Build NetBusiness connectivity offer',
  description: 'Builds the deterministic connectivity offer used after the FiberMX reroute.',
  operation: 'PLAN',
  requiresHumanApproval: false,
  inputSchema: installationSchema(),
  validate: validateInstallationInput,
  execute(input) {
    return providerSuccess({
      offerId: 'netbusiness-connectivity-guadalajara',
      price: offerPrice,
      currency: 'MXN' as const,
      ...installationAssessment(input.requiredBy),
    });
  },
});

export const netBusinessProvider = defineAgentReadyProvider(
  {
    id: 'netbusiness',
    name: 'NetBusiness',
    description: 'Connectivity fallback that meets the NEXUS mission deadline.',
    origin: 'https://netbusiness.example',
    categories: ['internet'],
    serviceAreas: ['Guadalajara'],
  },
  [
    netBusinessCheckCoverage,
    netBusinessCheckInstallationDate,
    netBusinessBuildConnectivityOffer,
  ],
);

export const netBusiness = getProviderDiscoveryMetadata(netBusinessProvider);

function installationAssessment(requiredBy: string) {
  const meetsDeadline = installationDate <= requiredBy;
  return {
    status: meetsDeadline ? ('FULFILLED' as const) : ('BLOCKED' as const),
    providerId: 'netbusiness',
    coverage: true,
    serviceAvailable: true,
    availableDate: installationDate,
    requiredBy,
    meetsDeadline,
  };
}

function coverageSchema() {
  return {
    type: 'object',
    properties: { city: { type: 'string' } },
    required: ['city'],
    additionalProperties: false,
  } as const;
}

function installationSchema() {
  return {
    type: 'object',
    properties: { city: { type: 'string' }, requiredBy: { type: 'string' } },
    required: ['city', 'requiredBy'],
    additionalProperties: false,
  } as const;
}

function validateCoverageInput(input: unknown): ToolValidationResult<CoverageInput> {
  if (!isRecord(input) || input.city !== 'Guadalajara') {
    return invalid('NetBusiness coverage fixture supports Guadalajara only.');
  }
  return { ok: true, value: { city: input.city } };
}

function validateInstallationInput(input: unknown): ToolValidationResult<InstallationInput> {
  const coverage = validateCoverageInput(input);
  if (!coverage.ok) return coverage;
  if (!isRecord(input) || typeof input.requiredBy !== 'string') {
    return invalid('NetBusiness installation checks require a requiredBy date.');
  }
  return { ok: true, value: { city: coverage.value.city, requiredBy: input.requiredBy } };
}

function invalid<T>(message: string): ToolValidationResult<T> {
  return { ok: false, error: createProviderError('INVALID_INPUT', message) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
