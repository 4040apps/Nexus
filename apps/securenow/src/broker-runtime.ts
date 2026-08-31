import { defineAgentReadyProvider } from '@nexus/provider-template';
import type { ToolResult } from '@nexus/webmcp';

import { secureNowProvider } from './fixture.js';

export const SECURENOW_TOOL_NAMES = [
  'assess_security_requirement',
  'build_security_package',
  'request_installation',
] as const;
export const SECURENOW_PLANNING_TOOL_NAMES = [
  'assess_security_requirement',
  'build_security_package',
] as const;
export const SECURENOW_COMMIT_TOOL_NAMES = ['request_installation'] as const;
export type SecureNowToolName = (typeof SECURENOW_TOOL_NAMES)[number];

export const secureNowBrokerProvider = defineAgentReadyProvider(
  secureNowProvider.metadata,
  secureNowProvider.tools.filter((tool) =>
    (SECURENOW_TOOL_NAMES as readonly string[]).includes(tool.name),
  ),
);

export async function executeSecureNowTool(
  toolName: SecureNowToolName,
  input: unknown,
): Promise<ToolResult<unknown>> {
  const tool = secureNowBrokerProvider.tools.find((candidate) => candidate.name === toolName);
  return tool
    ? tool.execute(input)
    : { ok: false, code: 'TOOL_NOT_FOUND', message: `SecureNow does not expose ${toolName}.`, retryable: false };
}

export async function executeSecureNowWebsitePlan(): Promise<readonly ToolResult<unknown>[]> {
  const input = { city: 'Guadalajara', employees: 20, requiredBy: '2026-10-01' } as const;
  return Promise.all(SECURENOW_PLANNING_TOOL_NAMES.map((name) => executeSecureNowTool(name, input)));
}

export function isSecureNowToolName(value: unknown): value is SecureNowToolName {
  return typeof value === 'string' && (SECURENOW_TOOL_NAMES as readonly string[]).includes(value);
}
