import type { ToolResult } from '@nexus/webmcp';
import { defineAgentReadyProvider } from '@nexus/provider-template';

import { techSupplyProvider } from './fixture.js';

export const TECHSUPPLY_BROKER_TOOL_NAMES = [
  'search_computers',
  'check_inventory',
  'build_computer_package',
] as const;

export type TechSupplyBrokerToolName = (typeof TECHSUPPLY_BROKER_TOOL_NAMES)[number];

export const techSupplyBrokerProvider = defineAgentReadyProvider(
  techSupplyProvider.metadata,
  techSupplyProvider.tools.filter((tool) =>
    (TECHSUPPLY_BROKER_TOOL_NAMES as readonly string[]).includes(tool.name),
  ),
);

export async function executeTechSupplyBrokerTool(
  toolName: TechSupplyBrokerToolName,
  input: unknown,
): Promise<ToolResult<unknown>> {
  const tool = techSupplyProvider.tools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    return {
      ok: false,
      code: 'TOOL_NOT_FOUND',
      message: `TechSupply does not expose ${toolName} in this Broker Mode segment.`,
      retryable: false,
    };
  }
  return tool.execute(input);
}

export async function executeTechSupplyWebsiteFlow(): Promise<readonly ToolResult<unknown>[]> {
  const input = { city: 'Guadalajara', quantity: 20 } as const;
  return Promise.all(
    TECHSUPPLY_BROKER_TOOL_NAMES.map((toolName) =>
      executeTechSupplyBrokerTool(toolName, input),
    ),
  );
}

export function isTechSupplyBrokerToolName(value: unknown): value is TechSupplyBrokerToolName {
  return (
    typeof value === 'string' &&
    (TECHSUPPLY_BROKER_TOOL_NAMES as readonly string[]).includes(value)
  );
}
