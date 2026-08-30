import type { GoalState } from '@nexus/goal-state';
import type { IntentHandoff } from '@nexus/intent-handoff';
import { describe, expect, it, vi } from 'vitest';

import {
  TECHSUPPLY_BROKER_TOOL_NAMES as PROVIDER_TOOL_NAMES,
  executeTechSupplyBrokerTool,
  techSupply,
  techSupplyBuildComputerPackage,
  techSupplyCheckInventory,
  techSupplySearchComputers,
} from '../../techsupply/src/index.js';
import { executeOfficeProBrandTool } from '../../officepro/src/index.js';
import { renderAgentActivityTimeline, renderMissionDashboard } from './dashboard.js';
import { createInitialHeroGoalState } from './dashboard-fixtures.js';
import { runOfficeProBrandMode } from './officepro-brand-mode.js';
import {
  authorizeOfficeProIntentHandoff,
  executeOfficeProIntentHandoff,
  proposeOfficeProIntentHandoff,
} from './officepro-intent-handoff.js';
import {
  TECHSUPPLY_BROKER_TOOL_NAMES,
  TECHSUPPLY_DISCOVERY_METADATA,
  discoverComputerProvider,
  runTechSupplyBrokerMode,
} from './techsupply-broker-mode.js';

describe('TechSupply Broker Mode live segment', () => {
  it('fails closed unless the Intent Handoff is executed', async () => {
    const { goalState } = await createPostOfficeProGoal();
    const proposed = proposeOfficeProIntentHandoff(goalState);

    await expect(
      runTechSupplyBrokerMode(
        proposed.goalState,
        proposed.handoff as unknown as IntentHandoff,
        { invoke: executeTechSupplyBrokerTool },
      ),
    ).rejects.toMatchObject({ code: 'BROKER_MODE_REQUIRED' });
  });

  it('discovers TechSupply from thin computer metadata without provider business data', () => {
    const provider = discoverComputerProvider(
      [TECHSUPPLY_DISCOVERY_METADATA],
      'Guadalajara',
    );
    expect(provider).toEqual({
      id: 'techsupply',
      name: 'TechSupply',
      origin: 'http://localhost:4600',
      categories: ['computer'],
      serviceAreas: ['Guadalajara'],
      capabilities: [...TECHSUPPLY_BROKER_TOOL_NAMES],
    });
    expect(techSupply.categories).toEqual(['computer']);
    const serialized = JSON.stringify(provider);
    for (const forbidden of [
      'techsupply-business-laptop',
      'techsupply-computers-20',
      '9500',
      '190000',
      'stock',
      'unitPrice',
      'deliveryDate',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('keeps deterministic catalog, stock, price, and delivery facts in provider tools', async () => {
    const input = { city: 'Guadalajara', quantity: 20 };
    const search = await techSupplySearchComputers.execute(input);
    const inventory = await techSupplyCheckInventory.execute(input);
    const computerPackage = await techSupplyBuildComputerPackage.execute(input);

    expect(search).toMatchObject({
      ok: true,
      data: { requestedQuantity: 20, stock: 20, unitPrice: 9_500 },
    });
    expect(inventory).toEqual({
      ok: true,
      data: {
        itemId: 'techsupply-business-laptop',
        requestedQuantity: 20,
        stock: 20,
        available: true,
      },
    });
    expect(computerPackage).toMatchObject({
      ok: true,
      data: {
        quantity: 20,
        unitPrice: 9_500,
        totalPrice: 190_000,
        currency: 'MXN',
        deliveryDate: '2026-09-22',
      },
    });
    expect('2026-09-22' <= '2026-10-01').toBe(true);
    expect(PROVIDER_TOOL_NAMES).toEqual(TECHSUPPLY_BROKER_TOOL_NAMES);
    expect(PROVIDER_TOOL_NAMES).not.toContain('request_quote');
  });

  it('uses every canonical transition and reaches the exact 60% mission checkpoint', async () => {
    const { goalState, handoff } = await createExecutedHandoff();
    const invoke = vi.fn(executeTechSupplyBrokerTool);
    const result = await runTechSupplyBrokerMode(goalState, handoff, { invoke });
    const computer = result.goalState.requirements.find(({ id }) => id === 'computers');
    const internet = result.goalState.requirements.find(({ id }) => id === 'internet');
    const security = result.goalState.requirements.find(({ id }) => id === 'security');
    const computerEvents = result.goalState.activity.filter(
      (event) => 'requirementId' in event && event.requirementId === 'computers',
    );

    expect(computerEvents.map((event) => ('toStatus' in event ? event.toStatus : undefined))).toEqual([
      'DISCOVERED',
      'MATCHED',
      'PROPOSED',
      'FULFILLED',
    ]);
    expect(result.invokedTools).toEqual([
      'search_computers',
      'check_inventory',
      'build_computer_package',
    ]);
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(computer).toMatchObject({
      status: 'FULFILLED',
      providerId: 'techsupply',
      estimatedCost: 190_000,
      quantity: 20,
    });
    expect(result.goalState).toMatchObject({
      progress: 60,
      budgetUsed: 345_000,
      budgetRemaining: 155_000,
    });
    expect(internet).toMatchObject({ status: 'PENDING' });
    expect(security).toMatchObject({ status: 'PENDING' });
    expect(internet?.providerId).toBeUndefined();
    expect(security?.providerId).toBeUndefined();
    expect(result.remainingRequirementIds).toEqual(['internet', 'security']);
    expect(result.deliveryDate).toBe('2026-09-22');

    const persisted = JSON.stringify({
      requirement: computer,
      activity: computerEvents,
    });
    for (const privateValue of [
      'techsupply-business-laptop',
      'techsupply-computers-20',
      '"unitPrice":',
      '"stock":',
      '9500',
    ]) {
      expect(persisted).not.toContain(privateValue);
    }
    for (const laterProvider of ['fibermx', 'netbusiness', 'securenow']) {
      expect(persisted).not.toContain(laterProvider);
    }
  });

  it('renders real TechSupply activity and the updated live dashboard without a fixture query', async () => {
    const { goalState, handoff } = await createExecutedHandoff();
    const result = await runTechSupplyBrokerMode(goalState, handoff, {
      invoke: executeTechSupplyBrokerTool,
    });
    const timeline = renderAgentActivityTimeline(result.goalState);
    const html = renderMissionDashboard(
      result.goalState,
      {
        providerOrigin: 'http://localhost:4500',
        phase: 'COMPLETE',
        message: 'OfficePro completed.',
        handoff,
      },
      {
        providerOrigin: 'http://localhost:4600',
        phase: 'COMPLETE',
        message: 'TechSupply completed.',
        transport: 'WEBMCP',
      },
    );

    expect(timeline).toContain('NEXUS discovered TechSupply');
    expect(timeline).toContain('<code>search_computers</code>');
    expect(timeline).toContain('<code>check_inventory</code>');
    expect(timeline).toContain('<code>build_computer_package</code>');
    expect(timeline).toContain('TechSupply fulfilled 20 computers');
    expect(html).toContain('Broker Mode');
    expect(html).toContain('20 computers fulfilled by TechSupply');
    expect(html).toContain('MXN 190,000');
    expect(html).toContain('Sep 22, 2026 · before deadline');
    expect(html).toContain('60%');
    expect(html).toContain('MXN 345,000');
    expect(html).toContain('MXN 155,000');
    expect(html).toContain('title="Independent TechSupply provider website"');
    expect(html).toContain('src="http://localhost:4600" allow="tools"');
    expect(html).not.toContain('No provider has been contacted yet.');
  });

  it('rejects malformed provider facts and preserves the post-handoff Goal State', async () => {
    const { goalState, handoff } = await createExecutedHandoff();
    const snapshot = structuredClone(goalState);
    const invoke = vi.fn(async (toolName: (typeof TECHSUPPLY_BROKER_TOOL_NAMES)[number], input: unknown) => {
      const result = await executeTechSupplyBrokerTool(toolName, input);
      if (toolName !== 'build_computer_package' || !result.ok) return result;
      return {
        ...result,
        data: { ...(result.data as Record<string, unknown>), totalPrice: 189_999 },
      };
    });

    await expect(runTechSupplyBrokerMode(goalState, handoff, { invoke })).rejects.toMatchObject({
      code: 'INVALID_PROVIDER_RESULT',
    });
    expect(goalState).toEqual(snapshot);
    expect(goalState.requirements.find(({ id }) => id === 'computers')).toMatchObject({
      status: 'PENDING',
    });
  });
});

async function createPostOfficeProGoal(): Promise<{ goalState: GoalState }> {
  const officePro = await runOfficeProBrandMode(createInitialHeroGoalState(), {
    invoke: executeOfficeProBrandTool,
  });
  return { goalState: officePro.goalState };
}

async function createExecutedHandoff(): Promise<{ goalState: GoalState; handoff: IntentHandoff }> {
  const { goalState } = await createPostOfficeProGoal();
  const proposed = proposeOfficeProIntentHandoff(goalState);
  const authorized = authorizeOfficeProIntentHandoff(proposed.goalState, proposed.handoff);
  const executed = executeOfficeProIntentHandoff(authorized.goalState, authorized.handoff);
  return executed;
}
