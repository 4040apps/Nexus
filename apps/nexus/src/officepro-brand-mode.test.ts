import { describe, expect, it, vi } from 'vitest';

import {
  executeOfficeProBrandTool,
  officeProBrandModeProvider,
} from '../../officepro/src/index.js';
import { deriveMissionMode, renderAgentActivityTimeline } from './dashboard.js';
import { createInitialHeroGoalState } from './dashboard-fixtures.js';
import {
  OFFICEPRO_BRAND_TOOL_NAMES,
  runOfficeProBrandMode,
} from './officepro-brand-mode.js';
import { createNexusReadinessSurfaces } from './readiness.js';

describe('OfficePro Brand Mode hero segment', () => {
  it('analyzes all requirements and invokes only the four read/plan tools', async () => {
    const invoked: { toolName: string; input: unknown }[] = [];
    const result = await runOfficeProBrandMode(createInitialHeroGoalState(), {
      async invoke(toolName, input) {
        invoked.push({ toolName, input });
        return executeOfficeProBrandTool(toolName, input);
      },
    });

    expect(invoked.map(({ toolName }) => toolName)).toEqual(OFFICEPRO_BRAND_TOOL_NAMES);
    expect(invoked[0]?.input).toEqual({
      city: 'Guadalajara',
      employees: 20,
      requirementTypes: ['desk', 'chair', 'computer', 'internet', 'security'],
    });
    expect(result.invokedTools).not.toContain('request_quote');
    expect(officeProBrandModeProvider.tools.map(({ operation }) => operation)).toEqual([
      'PLAN',
      'READ',
      'PLAN',
      'READ',
    ]);
  });

  it('confirms provider-owned stock, package pricing, and delivery before fulfillment', async () => {
    const stock = await executeOfficeProBrandTool('search_furniture', {
      city: 'Guadalajara',
      employees: 20,
    });
    const furniturePackage = await executeOfficeProBrandTool('build_furniture_package', {
      city: 'Guadalajara',
      employees: 20,
    });
    const delivery = await executeOfficeProBrandTool('check_delivery', {
      city: 'Guadalajara',
      requiredBy: '2026-10-01',
    });

    expect(stock).toMatchObject({
      ok: true,
      data: {
        items: [
          { type: 'desk', stock: 20, requestedQuantity: 20 },
          { type: 'chair', stock: 20, requestedQuantity: 20 },
        ],
      },
    });
    expect(furniturePackage).toMatchObject({
      ok: true,
      data: {
        currency: 'MXN',
        totalPrice: 155_000,
        deliveryDate: '2026-09-20',
        items: [
          { type: 'desk', quantity: 20, totalPrice: 80_000 },
          { type: 'chair', quantity: 20, totalPrice: 75_000 },
        ],
      },
    });
    expect(delivery).toEqual({
      ok: true,
      data: {
        city: 'Guadalajara',
        availableDate: '2026-09-20',
        requiredBy: '2026-10-01',
        meetsDeadline: true,
      },
    });
  });

  it('updates canonical Goal State to the exact OfficePro partial outcome', async () => {
    const result = await runRealFlow();
    const requirements = Object.fromEntries(
      result.goalState.requirements.map((requirement) => [requirement.id, requirement]),
    );

    expect(requirements.desks).toMatchObject({
      status: 'FULFILLED',
      providerId: 'officepro',
      estimatedCost: 80_000,
    });
    expect(requirements.chairs).toMatchObject({
      status: 'FULFILLED',
      providerId: 'officepro',
      estimatedCost: 75_000,
    });
    expect(requirements.computers).toMatchObject({ status: 'PENDING' });
    expect(requirements.internet).toMatchObject({ status: 'PENDING' });
    expect(requirements.security).toMatchObject({ status: 'PENDING' });
    expect(requirements.computers?.providerId).toBeUndefined();
    expect(requirements.internet?.providerId).toBeUndefined();
    expect(requirements.security?.providerId).toBeUndefined();
    expect(result.goalState).toMatchObject({
      progress: 40,
      budgetUsed: 155_000,
      budgetRemaining: 345_000,
    });
  });

  it('uses every canonical transition without skipping', async () => {
    const { goalState } = await runRealFlow();
    const transitionsFor = (requirementId: string) =>
      goalState.activity
        .filter((event) => 'requirementId' in event && event.requirementId === requirementId)
        .map((event) => ('toStatus' in event ? event.toStatus : undefined));

    expect(transitionsFor('desks')).toEqual(['DISCOVERED', 'MATCHED', 'PROPOSED', 'FULFILLED']);
    expect(transitionsFor('chairs')).toEqual(['DISCOVERED', 'MATCHED', 'PROPOSED', 'FULFILLED']);
  });

  it('publishes live Goal State after each provider tool stage', async () => {
    const updates: string[][] = [];
    await runOfficeProBrandMode(
      createInitialHeroGoalState(),
      { invoke: executeOfficeProBrandTool },
      {
        onGoalStateChange(goalState) {
          updates.push(goalState.requirements.map(({ status }) => status));
        },
      },
    );

    expect(updates).toEqual([
      ['DISCOVERED', 'DISCOVERED', 'PENDING', 'PENDING', 'PENDING'],
      ['MATCHED', 'MATCHED', 'PENDING', 'PENDING', 'PENDING'],
      ['PROPOSED', 'PROPOSED', 'PENDING', 'PENDING', 'PENDING'],
      ['FULFILLED', 'FULFILLED', 'PENDING', 'PENDING', 'PENDING'],
    ]);
  });

  it('keeps Brand Mode active and cannot begin Broker Mode automatically', async () => {
    const result = await runRealFlow();

    expect(deriveMissionMode(result.goalState)).toBe('Brand Mode');
    expect(result.mode).toBe('BRAND');
    expect(result.brokerModeStarted).toBe(false);
    expect(result.continuation).toEqual({
      status: 'OFFERED_NOT_AUTHORIZED',
      message: 'OfficePro completed what it could. 3 requirements remain. Continue through NEXUS?',
    });
    expect(result.goalState.activity.some((event) => event.action.startsWith('HANDOFF_'))).toBe(
      false,
    );
  });

  it('renders provider, tool, and actual result activity from Goal State', async () => {
    const { goalState } = await runRealFlow();
    const html = renderAgentActivityTimeline(goalState);

    for (const toolName of OFFICEPRO_BRAND_TOOL_NAMES) {
      expect(html).toContain(`<code>${toolName}</code>`);
    }
    expect(html).toContain('<strong>OfficePro</strong>');
    expect(html).toContain('20 desks');
    expect(html).toContain('20 chairs');
    expect(html).toContain('2026-09-20');
  });

  it('persists mission facts without copying provider catalog records into NEXUS', async () => {
    const result = await runRealFlow();
    const persistedGoalState = JSON.stringify(result.goalState);

    expect(persistedGoalState).not.toContain('officepro-desk-standard');
    expect(persistedGoalState).not.toContain('officepro-chair-ergonomic');
    expect(persistedGoalState).not.toContain('itemId');
    expect(persistedGoalState).not.toContain('unitPrice');
    expect(persistedGoalState).not.toContain('"stock":');
    expect(persistedGoalState).not.toContain('packageId');
  });

  it('fails closed on invalid provider facts without mutating the initial Goal State', async () => {
    const initial = createInitialHeroGoalState();
    const initialSnapshot = structuredClone(initial);
    const invoke = vi.fn(async (toolName: (typeof OFFICEPRO_BRAND_TOOL_NAMES)[number], input: unknown) => {
      if (toolName !== 'search_furniture') {
        return executeOfficeProBrandTool(toolName, input);
      }
      return {
        ok: true,
        data: {
          items: [
            { type: 'desk', stock: 19, requestedQuantity: 20 },
            { type: 'chair', stock: 20, requestedQuantity: 20 },
          ],
        },
      };
    });

    await expect(runOfficeProBrandMode(initial, { invoke })).rejects.toMatchObject({
      code: 'INVALID_PROVIDER_RESULT',
    });
    expect(initial).toEqual(initialSnapshot);
  });

  it('ships a real runtime entry path without requiring a snapshot query', () => {
    const html = createNexusReadinessSurfaces({
      canonicalOrigin: 'http://localhost:4400',
      officeProRuntime: { providerOrigin: 'http://localhost:4500' },
    }).html;

    expect(html).toContain('data-ask-officepro');
    expect(html).toContain('src="http://localhost:4500" allow="tools"');
    expect(html).toContain('src="/officepro-runtime-client.js"');
    expect(html).not.toContain('?state=');
  });
});

async function runRealFlow() {
  return runOfficeProBrandMode(createInitialHeroGoalState(), {
    invoke: executeOfficeProBrandTool,
  });
}
