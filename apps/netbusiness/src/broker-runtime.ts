import { defineAgentReadyProvider } from '@nexus/provider-template';
import type { ToolResult } from '@nexus/webmcp';

import { netBusinessProvider } from './fixture.js';

export const NETBUSINESS_BROKER_TOOL_NAMES = [
  'check_coverage',
  'check_installation_date',
  'build_connectivity_offer',
] as const;
export type NetBusinessBrokerToolName = (typeof NETBUSINESS_BROKER_TOOL_NAMES)[number];

export const netBusinessBrokerProvider = defineAgentReadyProvider(
  netBusinessProvider.metadata,
  netBusinessProvider.tools.filter((tool) =>
    (NETBUSINESS_BROKER_TOOL_NAMES as readonly string[]).includes(tool.name),
  ),
);

export async function executeNetBusinessBrokerTool(
  toolName: NetBusinessBrokerToolName,
  input: unknown,
): Promise<ToolResult<unknown>> {
  const tool = netBusinessBrokerProvider.tools.find((candidate) => candidate.name === toolName);
  return tool
    ? tool.execute(input)
    : { ok: false, code: 'TOOL_NOT_FOUND', message: `NetBusiness does not expose ${toolName}.`, retryable: false };
}

export async function executeNetBusinessWebsiteFlow(): Promise<readonly ToolResult<unknown>[]> {
  const input = { city: 'Guadalajara', requiredBy: '2026-10-01' } as const;
  return Promise.all(NETBUSINESS_BROKER_TOOL_NAMES.map((name) => executeNetBusinessBrokerTool(name, input)));
}

export function isNetBusinessBrokerToolName(value: unknown): value is NetBusinessBrokerToolName {
  return typeof value === 'string' && (NETBUSINESS_BROKER_TOOL_NAMES as readonly string[]).includes(value);
}
