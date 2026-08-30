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

const earliestInstallationDate = '2026-10-08';
const offerPrice = 24_000;

export const fiberMxCheckCoverage = defineProviderTool({
  name: 'check_coverage',
  title: 'Check FiberMX coverage',
  description: 'Checks FiberMX’s provider-owned Guadalajara coverage.',
  operation: 'READ',
  requiresHumanApproval: false,
  inputSchema: coverageSchema(),
  validate: validateCoverageInput,
  execute(input) {
    return providerSuccess({ city: input.city, covered: true, serviceAvailable: true });
  },
});

export const fiberMxCheckInstallationDate = defineProviderTool({
  name: 'check_installation_date',
  title: 'Check FiberMX installation date',
  description: 'Checks FiberMX’s earliest installation against the mission deadline.',
  operation: 'READ',
  requiresHumanApproval: false,
  inputSchema: installationSchema(),
  validate: validateInstallationInput,
  execute(input) {
    return providerSuccess(deadlineAssessment(input.requiredBy));
  },
});

export const fiberMxBuildConnectivityOffer = defineProviderTool({
  name: 'build_connectivity_offer',
  title: 'Build FiberMX connectivity offer',
  description: 'Builds a FiberMX offer while preserving a machine-readable deadline blocker.',
  operation: 'PLAN',
  requiresHumanApproval: false,
  inputSchema: installationSchema(),
  validate: validateInstallationInput,
  execute(input) {
    return providerSuccess({
      offerId: 'fibermx-connectivity-guadalajara',
      price: offerPrice,
      currency: 'MXN' as const,
      ...deadlineAssessment(input.requiredBy),
    });
  },
});

export const fiberMxProvider = defineAgentReadyProvider(
  {
    id: 'fibermx',
    name: 'FiberMX',
    description: 'Connectivity provider with a deliberate deadline conflict for the demo.',
    origin: 'https://fibermx.example',
    categories: ['internet'],
    serviceAreas: ['Guadalajara'],
  },
  [fiberMxCheckCoverage, fiberMxCheckInstallationDate, fiberMxBuildConnectivityOffer],
);

export const fiberMx = getProviderDiscoveryMetadata(fiberMxProvider);

function deadlineAssessment(requiredBy: string) {
  const missesDeadline = earliestInstallationDate > requiredBy;
  return {
    status: missesDeadline ? ('BLOCKED' as const) : ('FULFILLED' as const),
    providerId: 'fibermx',
    code: missesDeadline ? 'DELIVERY_DEADLINE' : null,
    message: missesDeadline
      ? `FiberMX can install on ${earliestInstallationDate}, after ${requiredBy}.`
      : `FiberMX can install by ${requiredBy}.`,
    coverage: true,
    serviceAvailable: true,
    availableDate: earliestInstallationDate,
    requiredBy,
    meetsDeadline: !missesDeadline,
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
    return invalid('FiberMX coverage fixture supports Guadalajara only.');
  }
  return { ok: true, value: { city: input.city } };
}

function validateInstallationInput(input: unknown): ToolValidationResult<InstallationInput> {
  const coverage = validateCoverageInput(input);
  if (!coverage.ok) return coverage;
  if (!isRecord(input) || typeof input.requiredBy !== 'string') {
    return invalid('FiberMX installation checks require a requiredBy date.');
  }
  return { ok: true, value: { city: coverage.value.city, requiredBy: input.requiredBy } };
}

function invalid<T>(message: string): ToolValidationResult<T> {
  return { ok: false, error: createProviderError('INVALID_INPUT', message) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
