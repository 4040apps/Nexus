import { ProviderTemplateError } from './errors.js';
import type {
  AgentReadyProvider,
  AgentReadyProviderMetadata,
  ProviderDescriptor,
  ProviderDiscoveryMetadata,
  ProviderTool,
} from './types.js';

export function defineProvider<const TProvider extends ProviderDescriptor>(
  provider: TProvider,
): TProvider {
  assertText(provider.id, 'id');
  assertText(provider.name, 'name');
  return provider;
}

export function defineAgentReadyProvider(
  metadata: AgentReadyProviderMetadata,
  tools: readonly ProviderTool[],
): AgentReadyProvider {
  validateAgentReadyMetadata(metadata);

  const toolNames = new Set<string>();
  for (const tool of tools) {
    if (toolNames.has(tool.name)) {
      throw new ProviderTemplateError(
        'DUPLICATE_TOOL_NAME',
        `Provider "${metadata.id}" declares tool "${tool.name}" more than once.`,
        { providerId: metadata.id, toolName: tool.name },
      );
    }
    toolNames.add(tool.name);
  }

  if (tools.length === 0) {
    throw new ProviderTemplateError(
      'INVALID_PROVIDER_METADATA',
      `Agent-ready provider "${metadata.id}" must expose at least one real tool.`,
      { providerId: metadata.id },
    );
  }

  return {
    metadata: {
      ...metadata,
      categories: [...metadata.categories],
      serviceAreas: [...metadata.serviceAreas],
      origin: normalizeOrigin(metadata.origin),
    },
    tools: [...tools],
  };
}

export function getProviderDiscoveryMetadata(
  provider: AgentReadyProvider,
): ProviderDiscoveryMetadata {
  return {
    id: provider.metadata.id,
    name: provider.metadata.name,
    description: provider.metadata.description,
    origin: provider.metadata.origin,
    categories: [...provider.metadata.categories],
    serviceAreas: [...provider.metadata.serviceAreas],
    capabilities: provider.tools.map((tool) => tool.name),
    operations: Object.fromEntries(provider.tools.map((tool) => [tool.name, tool.operation])),
  };
}

function validateAgentReadyMetadata(metadata: AgentReadyProviderMetadata): void {
  assertText(metadata.id, 'id');
  assertText(metadata.name, 'name');
  assertText(metadata.description, 'description');

  if (metadata.categories.length === 0 || metadata.serviceAreas.length === 0) {
    throw new ProviderTemplateError(
      'INVALID_PROVIDER_METADATA',
      `Provider "${metadata.id}" requires real categories and service areas.`,
      { providerId: metadata.id },
    );
  }

  normalizeOrigin(metadata.origin);
}

function assertText(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new ProviderTemplateError(
      'INVALID_PROVIDER_METADATA',
      `Provider metadata field "${field}" cannot be empty.`,
      { field },
    );
  }
}

function normalizeOrigin(origin: string): string {
  let parsed: URL;

  try {
    parsed = new URL(origin);
  } catch {
    throw new ProviderTemplateError(
      'INVALID_PROVIDER_METADATA',
      `Provider origin "${origin}" is not a valid URL.`,
      { origin },
    );
  }

  const isLocalDevelopment =
    parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);

  if (parsed.protocol !== 'https:' && !isLocalDevelopment) {
    throw new ProviderTemplateError(
      'INVALID_PROVIDER_METADATA',
      `Provider origin "${origin}" must be a trustworthy HTTPS or localhost origin.`,
      { origin },
    );
  }

  return parsed.origin;
}
