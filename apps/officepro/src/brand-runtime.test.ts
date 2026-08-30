import { describe, expect, it, vi } from 'vitest';

import { registerProviderTools } from '@nexus/provider-template';
import type { WebMcpDocument } from '@nexus/webmcp';

import { executeOfficeProWebsiteFlow } from './brand-runtime.js';
import { officeProBrandModeProvider } from './fixture.js';

describe('OfficePro independent provider runtime', () => {
  it('registers exactly four genuine tools through document.modelContext', async () => {
    const registerTool = vi.fn(async () => undefined);
    const document = { modelContext: { registerTool } } satisfies WebMcpDocument;

    const result = await registerProviderTools(document, officeProBrandModeProvider, {
      exposedTo: ['http://localhost:4400'],
    });

    expect(result).toMatchObject({
      status: 'REGISTERED',
      registeredTools: [
        'analyze_office_requirement',
        'search_furniture',
        'build_furniture_package',
        'check_delivery',
      ],
    });
    expect(registerTool).toHaveBeenCalledTimes(4);
    expect(registerTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'analyze_office_requirement' }),
      { exposedTo: ['http://localhost:4400'] },
    );
  });

  it('keeps the normal OfficePro website flow functional without WebMCP', async () => {
    await expect(registerProviderTools({}, officeProBrandModeProvider)).resolves.toMatchObject({
      status: 'UNSUPPORTED',
    });

    const results = await executeOfficeProWebsiteFlow();
    expect(results).toHaveLength(4);
    expect(results.every((result) => result.ok)).toBe(true);
  });
});
