import type { WebMcpToolDefinition } from '@nexus/webmcp';

export type ProviderDescriptor = {
  id: string;
  name: string;
  categories: readonly string[];
  serviceAreas: readonly string[];
  capabilities: readonly string[];
};

export function defineProvider<const TProvider extends ProviderDescriptor>(
  provider: TProvider,
): TProvider {
  return provider;
}

export type ProviderTool = WebMcpToolDefinition<unknown, unknown>;
