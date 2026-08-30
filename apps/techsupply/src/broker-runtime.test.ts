import { registerProviderTools } from '@nexus/provider-template';
import type { WebMcpDocument } from '@nexus/webmcp';
import { describe, expect, it, vi } from 'vitest';

import {
  TECHSUPPLY_BROKER_TOOL_NAMES,
  executeTechSupplyBrokerTool,
  executeTechSupplyWebsiteFlow,
  techSupplyBrokerProvider,
} from './broker-runtime.js';

describe('TechSupply provider-owned Broker Mode runtime', () => {
  it('exposes only the three autonomous tools used by the live segment', async () => {
    expect(TECHSUPPLY_BROKER_TOOL_NAMES).toEqual([
      'search_computers',
      'check_inventory',
      'build_computer_package',
    ]);
    expect(await executeTechSupplyWebsiteFlow()).toHaveLength(3);
  });

  it('registers genuine tools with the NEXUS exposedTo boundary', async () => {
    const registerTool = vi.fn(async () => undefined);
    const document = { modelContext: { registerTool } } satisfies WebMcpDocument;
    const result = await registerProviderTools(document, techSupplyBrokerProvider, {
      exposedTo: ['http://localhost:4400'],
    });

    expect(result).toMatchObject({
      status: 'REGISTERED',
      registeredTools: [...TECHSUPPLY_BROKER_TOOL_NAMES],
    });
    expect(registerTool).toHaveBeenCalledTimes(3);
    expect(registerTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'search_computers' }),
      { exposedTo: ['http://localhost:4400'] },
    );
  });

  it('returns a typed error for tools outside the exposed segment', async () => {
    await expect(
      executeTechSupplyBrokerTool('missing' as 'search_computers', {}),
    ).resolves.toMatchObject({ ok: false, code: 'TOOL_NOT_FOUND' });
  });
});
