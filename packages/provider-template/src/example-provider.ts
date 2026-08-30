import { createProviderError } from './errors.js';
import { defineAgentReadyProvider } from './provider.js';
import { defineProviderTool, providerSuccess } from './tools.js';
import type { AgentReadyProviderMetadata, ToolValidationResult } from './types.js';

export type ExampleAvailabilityInput = {
  itemId: string;
  city: string;
};

export type ExampleAvailability = {
  itemId: string;
  city: string;
  available: boolean;
};

export type ExampleAvailabilityService = {
  checkAvailability: (
    input: ExampleAvailabilityInput,
  ) => ExampleAvailability | Promise<ExampleAvailability>;
};

export function createExampleProvider(
  metadata: AgentReadyProviderMetadata,
  service: ExampleAvailabilityService,
) {
  const checkAvailability = defineProviderTool({
    name: 'check_availability',
    title: 'Check availability',
    description: 'Checks this provider’s own availability for an item in a service city.',
    operation: 'READ',
    requiresHumanApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', minLength: 1 },
        city: { type: 'string', minLength: 1 },
      },
      required: ['itemId', 'city'],
      additionalProperties: false,
    },
    validate: validateAvailabilityInput,
    async execute(input) {
      return providerSuccess(await service.checkAvailability(input));
    },
  });

  return defineAgentReadyProvider(metadata, [checkAvailability]);
}

function validateAvailabilityInput(input: unknown): ToolValidationResult<ExampleAvailabilityInput> {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('itemId' in input) ||
    !('city' in input) ||
    typeof input.itemId !== 'string' ||
    typeof input.city !== 'string' ||
    input.itemId.trim().length === 0 ||
    input.city.trim().length === 0
  ) {
    return {
      ok: false,
      error: createProviderError(
        'INVALID_INPUT',
        'Availability requires non-empty itemId and city values.',
      ),
    };
  }

  return {
    ok: true,
    value: {
      itemId: input.itemId,
      city: input.city,
    },
  };
}
