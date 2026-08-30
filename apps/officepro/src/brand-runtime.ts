import type { ToolResult } from '@nexus/webmcp';

import { officeProBrandModeProvider } from './fixture.js';

export const OFFICEPRO_BRAND_TOOL_NAMES = [
  'analyze_office_requirement',
  'search_furniture',
  'build_furniture_package',
  'check_delivery',
] as const;

export type OfficeProBrandToolName = (typeof OFFICEPRO_BRAND_TOOL_NAMES)[number];

export async function executeOfficeProBrandTool(
  toolName: OfficeProBrandToolName,
  input: unknown,
): Promise<ToolResult<unknown>> {
  const tool = officeProBrandModeProvider.tools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    return {
      ok: false,
      code: 'TOOL_NOT_FOUND',
      message: `OfficePro does not expose ${toolName} in this Brand Mode segment.`,
      retryable: false,
    };
  }
  return tool.execute(input);
}

export async function executeOfficeProWebsiteFlow(): Promise<readonly ToolResult<unknown>[]> {
  const mission = { city: 'Guadalajara', employees: 20 } as const;
  return [
    await executeOfficeProBrandTool('analyze_office_requirement', {
      ...mission,
      requirementTypes: ['desk', 'chair', 'computer', 'internet', 'security'],
    }),
    await executeOfficeProBrandTool('search_furniture', mission),
    await executeOfficeProBrandTool('build_furniture_package', mission),
    await executeOfficeProBrandTool('check_delivery', {
      city: mission.city,
      requiredBy: '2026-10-01',
    }),
  ];
}

export function isOfficeProBrandToolName(value: unknown): value is OfficeProBrandToolName {
  return (
    typeof value === 'string' &&
    (OFFICEPRO_BRAND_TOOL_NAMES as readonly string[]).includes(value)
  );
}
