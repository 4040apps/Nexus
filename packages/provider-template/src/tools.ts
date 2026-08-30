import type { ToolSuccess } from '@nexus/webmcp';

import { createProviderError, ProviderTemplateError } from './errors.js';
import type { HumanApproval, ProviderTool, ProviderToolConfig } from './types.js';

const WEBMCP_TOOL_NAME = /^[A-Za-z0-9_.-]+$/;

export function defineProviderTool<TInput, TOutput>(
  config: ProviderToolConfig<TInput, TOutput>,
): ProviderTool<TOutput> {
  assertToolConfig(config);

  return {
    name: config.name,
    title: config.title,
    description: config.description,
    inputSchema: config.inputSchema,
    operation: config.operation,
    requiresHumanApproval: config.operation === 'COMMIT',
    async execute(input: unknown) {
      try {
        const validation = config.validate(input);

        if (!validation.ok) {
          return validation.error;
        }

        if (
          config.operation === 'COMMIT' &&
          !isValidHumanApproval(config.getApproval(validation.value))
        ) {
          return createProviderError(
            'REQUIRES_HUMAN',
            `Tool "${config.name}" requires explicit human approval before commitment.`,
            { details: { toolName: config.name, operation: config.operation } },
          );
        }

        return await config.execute(validation.value);
      } catch {
        return createProviderError(
          'INTERNAL_ERROR',
          `Tool "${config.name}" could not complete its provider operation.`,
          { details: { toolName: config.name, operation: config.operation } },
        );
      }
    },
  };
}

export function providerSuccess<TData>(data: TData): ToolSuccess<TData> {
  return { ok: true, data };
}

function assertToolConfig<TInput, TOutput>(
  config: ProviderToolConfig<TInput, TOutput>,
): void {
  if (
    !WEBMCP_TOOL_NAME.test(config.name) ||
    config.title.trim().length === 0 ||
    config.description.trim().length === 0 ||
    typeof config.validate !== 'function' ||
    typeof config.execute !== 'function'
  ) {
    throw new ProviderTemplateError(
      'INVALID_TOOL_DEFINITION',
      `Tool "${config.name}" is not a valid WebMCP tool definition.`,
      { toolName: config.name },
    );
  }
}

function isValidHumanApproval(approval: HumanApproval | undefined): boolean {
  return Boolean(
    approval?.approved === true &&
      approval.approvalId.trim().length > 0 &&
      approval.approvedAt.trim().length > 0,
  );
}
