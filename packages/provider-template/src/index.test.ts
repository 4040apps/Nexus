import type {
  WebMcpDocument,
  WebMcpRegisterToolOptions,
  WebMcpToolDefinition,
} from '@nexus/webmcp';
import { describe, expect, it } from 'vitest';

import {
  createExampleProvider,
  createProviderError,
  createProviderReadinessSurfaces,
  defineAgentReadyProvider,
  defineProviderTool,
  getProviderDiscoveryMetadata,
  providerSuccess,
  registerProviderTools,
  renderAccessibleProviderPage,
} from './index.js';
import type {
  AgentReadyProvider,
  AgentReadyProviderMetadata,
  HumanApproval,
  ToolValidationResult,
} from './index.js';

const exampleMetadata: AgentReadyProviderMetadata = {
  id: 'example-provider',
  name: 'Example Provider',
  description: 'Deterministic provider used to exercise the shared agent-ready template.',
  origin: 'https://provider.example',
  categories: ['office-supplies'],
  serviceAreas: ['Guadalajara'],
};

describe('provider template contracts', () => {
  it('derives thin discovery metadata without provider business data', () => {
    const provider = createAvailabilityProvider();
    const discovery = getProviderDiscoveryMetadata(provider);

    expect(discovery).toEqual({
      ...exampleMetadata,
      capabilities: ['check_availability'],
      operations: { check_availability: 'READ' },
    });
    expect(JSON.stringify(discovery)).not.toContain('SKU-CHAIR');
    expect(JSON.stringify(discovery)).not.toContain('stock');
    expect(JSON.stringify(discovery)).not.toContain('price');
  });

  it('exercises the minimal provider-owned availability tool and normal validation', async () => {
    const providerCatalog = new Map([['SKU-CHAIR:Guadalajara', true]]);
    const provider = createExampleProvider(exampleMetadata, {
      checkAvailability(input) {
        return {
          ...input,
          available: providerCatalog.get(`${input.itemId}:${input.city}`) ?? false,
        };
      },
    });
    const tool = provider.tools[0];

    expect(tool).toBeDefined();
    expect(await tool?.execute({ itemId: 'SKU-CHAIR', city: 'Guadalajara' })).toEqual({
      ok: true,
      data: { itemId: 'SKU-CHAIR', city: 'Guadalajara', available: true },
    });
    expect(await tool?.execute({ itemId: '', city: 'Guadalajara' })).toMatchObject({
      ok: false,
      code: 'INVALID_INPUT',
      retryable: false,
    });
  });

  it('distinguishes read/planning tools from commitments and gates commitment execution', async () => {
    let committed = false;
    const commitmentTool = defineProviderTool({
      name: 'request_quote',
      title: 'Request quote',
      description: 'Creates a provider quote only after explicit human approval.',
      operation: 'COMMIT',
      requiresHumanApproval: true,
      inputSchema: {
        type: 'object',
        properties: {
          packageId: { type: 'string' },
          approval: { type: 'object' },
        },
        required: ['packageId'],
        additionalProperties: false,
      },
      validate: validateQuoteInput,
      getApproval: (input) => input.approval,
      execute(input) {
        committed = true;
        return providerSuccess({ quoteId: `quote-${input.packageId}` });
      },
    });

    expect(commitmentTool.operation).toBe('COMMIT');
    expect(commitmentTool.requiresHumanApproval).toBe(true);
    expect(await commitmentTool.execute({ packageId: 'package-1' })).toMatchObject({
      ok: false,
      code: 'REQUIRES_HUMAN',
    });
    expect(committed).toBe(false);
    expect(
      await commitmentTool.execute({
        packageId: 'package-1',
        approval: { approved: true, approvalId: '', approvedAt: '' },
      }),
    ).toMatchObject({ ok: false, code: 'REQUIRES_HUMAN' });
    expect(committed).toBe(false);

    const approval: HumanApproval = {
      approved: true,
      approvalId: 'approval-1',
      approvedAt: '2026-09-01T12:00:00.000Z',
    };
    expect(await commitmentTool.execute({ packageId: 'package-1', approval })).toEqual({
      ok: true,
      data: { quoteId: 'quote-package-1' },
    });
    expect(committed).toBe(true);
  });

  it('registers genuine tools through document.modelContext with current API options', async () => {
    const provider = createAvailabilityProvider();
    const registrations: Array<{
      tool: WebMcpToolDefinition<unknown, unknown>;
      options?: WebMcpRegisterToolOptions;
    }> = [];
    const targetDocument: WebMcpDocument = {
      modelContext: {
        async registerTool(tool, options) {
          registrations.push({ tool, ...(options ? { options } : {}) });
        },
      },
    };
    const controller = new AbortController();

    const result = await registerProviderTools(targetDocument, provider, {
      signal: controller.signal,
      exposedTo: ['https://agent.example'],
    });

    expect(result).toEqual({
      status: 'REGISTERED',
      registeredTools: ['check_availability'],
      errors: [],
    });
    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.tool).toMatchObject({
      name: 'check_availability',
      title: 'Check availability',
      description: expect.any(String),
      inputSchema: expect.any(Object),
      execute: expect.any(Function),
    });
    expect(registrations[0]?.options).toEqual({
      signal: controller.signal,
      exposedTo: ['https://agent.example'],
    });
  });

  it('fails registration defensively without breaking the provider site', async () => {
    const provider = createAvailabilityProvider();

    await expect(registerProviderTools({}, provider)).resolves.toMatchObject({
      status: 'UNSUPPORTED',
      registeredTools: [],
      errors: [{ code: 'WEBMCP_UNSUPPORTED' }],
    });

    const deniedDocument: WebMcpDocument = {
      modelContext: {
        async registerTool() {
          throw new DOMException('Permission denied', 'NotAllowedError');
        },
      },
    };
    await expect(registerProviderTools(deniedDocument, provider)).resolves.toMatchObject({
      status: 'FAILED',
      registeredTools: [],
      errors: [{ code: 'TOOL_REGISTRATION_FAILED', retryable: false }],
    });
  });

  it('generates non-empty readiness surfaces and an accessible semantic page', () => {
    const provider = createAvailabilityProvider();
    const readiness = createProviderReadinessSurfaces(provider);
    const page = renderAccessibleProviderPage(provider);

    expect(readiness.robotsTxt).toContain('Sitemap: https://provider.example/sitemap.xml');
    expect(readiness.sitemapXml).toContain('<loc>https://provider.example/</loc>');
    expect(readiness.llmsTxt).toContain('Capabilities: check_availability');
    expect(readiness.structuredData).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Example Provider',
      url: 'https://provider.example/',
    });
    expect(page).toContain('<html lang="en">');
    expect(page).toContain('<a href="#main-content">Skip to main content</a>');
    expect(page).toContain('<main id="main-content" tabindex="-1">');
    expect(page).toContain('aria-labelledby="capabilities-heading"');
    expect(page).toContain('role="status" aria-live="polite"');
    expect(page).toContain('<script type="application/ld+json">');
  });

  it('refuses empty tools and invalid origins instead of generating fake readiness', () => {
    expect(() => defineAgentReadyProvider(exampleMetadata, [])).toThrow(
      'must expose at least one real tool',
    );
    expect(() =>
      defineAgentReadyProvider(
        { ...exampleMetadata, origin: 'http://insecure.example' },
        createAvailabilityProvider().tools,
      ),
    ).toThrow('must be a trustworthy HTTPS or localhost origin');
  });
});

function createAvailabilityProvider(): AgentReadyProvider {
  return createExampleProvider(exampleMetadata, {
    checkAvailability(input) {
      return { ...input, available: true };
    },
  });
}

type QuoteInput = {
  packageId: string;
  approval?: HumanApproval;
};

function validateQuoteInput(input: unknown): ToolValidationResult<QuoteInput> {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('packageId' in input) ||
    typeof input.packageId !== 'string' ||
    input.packageId.length === 0
  ) {
    return {
      ok: false,
      error: createProviderError('INVALID_INPUT', 'packageId is required.'),
    };
  }

  const approval = 'approval' in input ? input.approval : undefined;
  return {
    ok: true,
    value: {
      packageId: input.packageId,
      ...(isHumanApproval(approval) ? { approval } : {}),
    },
  };
}

function isHumanApproval(value: unknown): value is HumanApproval {
  return (
    typeof value === 'object' &&
    value !== null &&
    'approved' in value &&
    value.approved === true &&
    'approvalId' in value &&
    typeof value.approvalId === 'string' &&
    'approvedAt' in value &&
    typeof value.approvedAt === 'string'
  );
}
