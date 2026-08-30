import { describe, expect, it, vi } from 'vitest';

import type { WebMcpModelContext, WebMcpRemoteTool } from './index.js';

describe('current cross-origin WebMCP contract', () => {
  it('passes fromOrigins to discovery and a JSON string to invocation', async () => {
    const remoteTool: WebMcpRemoteTool = {
      name: 'check_availability',
      origin: 'http://localhost:4200',
    };
    const getTools = vi.fn(async () => [remoteTool]);
    const executeTool = vi.fn(async () => ({ ok: true }));
    const context: WebMcpModelContext = {
      registerTool: vi.fn(async () => undefined),
      getTools,
      executeTool,
    };

    const tools = await context.getTools?.({
      fromOrigins: ['http://localhost:4200'],
    });
    const input = JSON.stringify({ itemId: 'desk-20', city: 'Guadalajara' });
    const result = await context.executeTool?.(tools?.[0] ?? remoteTool, input);

    expect(getTools).toHaveBeenCalledWith({
      fromOrigins: ['http://localhost:4200'],
    });
    expect(executeTool).toHaveBeenCalledWith(remoteTool, input);
    expect(result).toEqual({ ok: true });
  });
});
