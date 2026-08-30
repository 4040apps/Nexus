import type {
  WebMcpDocument,
  WebMcpRegisterToolOptions,
  WebMcpToolDefinition,
} from '@nexus/webmcp';

import { createProviderError } from './errors.js';
import type { AgentReadyProvider, ProviderRegistrationResult } from './types.js';

export async function registerProviderTools(
  targetDocument: WebMcpDocument,
  provider: AgentReadyProvider,
  options: WebMcpRegisterToolOptions = {},
): Promise<ProviderRegistrationResult> {
  const modelContext = targetDocument.modelContext;

  if (!modelContext || typeof modelContext.registerTool !== 'function') {
    return {
      status: 'UNSUPPORTED',
      registeredTools: [],
      errors: [
        createProviderError(
          'WEBMCP_UNSUPPORTED',
          'This browser does not expose document.modelContext; the provider site remains usable.',
        ),
      ],
    };
  }

  const registeredTools: string[] = [];
  const errors = [];

  for (const tool of provider.tools) {
    const webMcpTool: WebMcpToolDefinition<unknown, unknown> = {
      name: tool.name,
      ...(tool.title ? { title: tool.title } : {}),
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: tool.execute,
    };

    try {
      await modelContext.registerTool(webMcpTool, options);
      registeredTools.push(tool.name);
    } catch (error) {
      errors.push(
        createProviderError(
          'TOOL_REGISTRATION_FAILED',
          `WebMCP registration failed for tool "${tool.name}" without breaking the provider site.`,
          {
            details: {
              providerId: provider.metadata.id,
              toolName: tool.name,
              cause: error instanceof Error ? error.message : 'Unknown registration error',
            },
          },
        ),
      );
    }
  }

  return {
    status:
      errors.length === 0 ? 'REGISTERED' : registeredTools.length === 0 ? 'FAILED' : 'PARTIAL',
    registeredTools,
    errors,
  };
}
