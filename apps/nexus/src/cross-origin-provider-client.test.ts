import type { WebMcpDocument, WebMcpRemoteTool } from '@nexus/webmcp';
import { describe, expect, it, vi } from 'vitest';

import { createCrossOriginProviderInvoker } from './cross-origin-provider-client.js';

describe('shared cross-origin provider client', () => {
  it('discovers only the requested provider origin and invokes with the current WebMCP API', async () => {
    const tool: WebMcpRemoteTool = {
      name: 'search_computers',
      origin: 'http://localhost:4600',
    };
    const getTools = vi.fn(async () => [tool]);
    const executeTool = vi.fn(async () => '{"ok":true}');
    const targetDocument = {
      modelContext: {
        registerTool: vi.fn(async () => undefined),
        getTools,
        executeTool,
      },
    } satisfies WebMcpDocument;

    const { invoker, transport } = await createCrossOriginProviderInvoker({
      targetDocument,
      providerOrigin: 'http://localhost:4600',
      toolNames: ['search_computers'] as const,
      frame: null,
      requestType: 'NEXUS_TECHSUPPLY_TOOL_REQUEST',
      responseType: 'TECHSUPPLY_TOOL_RESULT',
      requestIdPrefix: 'techsupply-request',
      timeoutLabel: 'TechSupply',
    });
    await invoker.invoke('search_computers', { city: 'Guadalajara', quantity: 20 });

    expect(transport).toBe('WEBMCP');
    expect(getTools).toHaveBeenCalledWith({ fromOrigins: ['http://localhost:4600'] });
    expect(executeTool).toHaveBeenCalledWith(
      tool,
      JSON.stringify({ city: 'Guadalajara', quantity: 20 }),
    );
  });

  it('rejects same-name tools returned from a different origin', async () => {
    const targetDocument = {
      modelContext: {
        registerTool: vi.fn(async () => undefined),
        getTools: vi.fn(async () => [
          { name: 'search_computers', origin: 'http://localhost:9999' },
        ]),
        executeTool: vi.fn(async () => undefined),
      },
    } satisfies WebMcpDocument;

    await expect(
      createCrossOriginProviderInvoker({
        targetDocument,
        providerOrigin: 'http://localhost:4600',
        toolNames: ['search_computers'] as const,
        frame: null,
        requestType: 'NEXUS_TECHSUPPLY_TOOL_REQUEST',
        responseType: 'TECHSUPPLY_TOOL_RESULT',
        requestIdPrefix: 'techsupply-request',
        timeoutLabel: 'TechSupply',
      }),
    ).rejects.toThrow('provider frame is unavailable');
  });
});
