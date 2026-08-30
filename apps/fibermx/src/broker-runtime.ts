import { defineAgentReadyProvider } from '@nexus/provider-template';
import type { ToolResult } from '@nexus/webmcp';

import { fiberMxProvider } from './fixture.js';

export const FIBERMX_BROKER_TOOL_NAMES = [
  'check_coverage',
  'check_installation_date',
  'build_connectivity_offer',
] as const;
export type FiberMxBrokerToolName = (typeof FIBERMX_BROKER_TOOL_NAMES)[number];

export const fiberMxBrokerProvider = defineAgentReadyProvider(
  fiberMxProvider.metadata,
  fiberMxProvider.tools.filter((tool) =>
    (FIBERMX_BROKER_TOOL_NAMES as readonly string[]).includes(tool.name),
  ),
);

export async function executeFiberMxBrokerTool(
  toolName: FiberMxBrokerToolName,
  input: unknown,
): Promise<ToolResult<unknown>> {
  const tool = fiberMxBrokerProvider.tools.find((candidate) => candidate.name === toolName);
  return tool
    ? tool.execute(input)
    : { ok: false, code: 'TOOL_NOT_FOUND', message: `FiberMX does not expose ${toolName}.`, retryable: false };
}

export async function executeFiberMxWebsiteFlow(): Promise<readonly ToolResult<unknown>[]> {
  const input = { city: 'Guadalajara', requiredBy: '2026-10-01' } as const;
  return Promise.all(FIBERMX_BROKER_TOOL_NAMES.map((name) => executeFiberMxBrokerTool(name, input)));
}

export function isFiberMxBrokerToolName(value: unknown): value is FiberMxBrokerToolName {
  return typeof value === 'string' && (FIBERMX_BROKER_TOOL_NAMES as readonly string[]).includes(value);
}
