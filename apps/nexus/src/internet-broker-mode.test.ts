import type { GoalState } from '@nexus/goal-state';
import type { IntentHandoff } from '@nexus/intent-handoff';
import type { WebMcpDocument } from '@nexus/webmcp';
import { describe, expect, it, vi } from 'vitest';

import { registerProviderTools } from '../../../packages/provider-template/src/index.js';

import {
  FIBERMX_BROKER_TOOL_NAMES,
  executeFiberMxBrokerTool,
  fiberMxBrokerProvider,
  fiberMxBuildConnectivityOffer,
  fiberMxCheckInstallationDate,
} from '../../fibermx/src/index.js';
import {
  NETBUSINESS_BROKER_TOOL_NAMES,
  executeNetBusinessBrokerTool,
  netBusinessBrokerProvider,
  netBusinessBuildConnectivityOffer,
} from '../../netbusiness/src/index.js';
import { executeOfficeProBrandTool } from '../../officepro/src/index.js';
import { executeTechSupplyBrokerTool } from '../../techsupply/src/index.js';
import { renderAgentActivityTimeline, renderMissionDashboard } from './dashboard.js';
import { createInitialHeroGoalState } from './dashboard-fixtures.js';
import {
  FIBERMX_DISCOVERY_METADATA,
  INTERNET_BROKER_TOOL_NAMES,
  NETBUSINESS_DISCOVERY_METADATA,
  discoverInternetProvider,
  runFiberMxInternetRoute,
  runNetBusinessInternetRecovery,
} from './internet-broker-mode.js';
import { runOfficeProBrandMode } from './officepro-brand-mode.js';
import {
  authorizeOfficeProIntentHandoff,
  executeOfficeProIntentHandoff,
  proposeOfficeProIntentHandoff,
} from './officepro-intent-handoff.js';
import { runTechSupplyBrokerMode } from './techsupply-broker-mode.js';

describe('FiberMX deadline failure and NetBusiness reroute', () => {
  it('runs both providers as genuine, independently registered WebMCP surfaces', async () => {
    const fiberRegister = vi.fn(async () => undefined);
    const netRegister = vi.fn(async () => undefined);

    await expect(registerProviderTools(
      { modelContext: { registerTool: fiberRegister } } satisfies WebMcpDocument,
      fiberMxBrokerProvider,
      { exposedTo: ['http://localhost:4400'] },
    )).resolves.toMatchObject({ status: 'REGISTERED', registeredTools: [...FIBERMX_BROKER_TOOL_NAMES] });
    await expect(registerProviderTools(
      { modelContext: { registerTool: netRegister } } satisfies WebMcpDocument,
      netBusinessBrokerProvider,
      { exposedTo: ['http://localhost:4400'] },
    )).resolves.toMatchObject({ status: 'REGISTERED', registeredTools: [...NETBUSINESS_BROKER_TOOL_NAMES] });

    expect(fiberRegister).toHaveBeenCalledTimes(3);
    expect(netRegister).toHaveBeenCalledTimes(3);
    expect(fiberRegister).toHaveBeenCalledWith(expect.objectContaining({ name: 'check_coverage' }), {
      exposedTo: ['http://localhost:4400'],
    });
  });

  it('keeps provider business facts inside each provider fixture', async () => {
    await expect(fiberMxCheckInstallationDate.execute({
      city: 'Guadalajara', requiredBy: '2026-10-01',
    })).resolves.toMatchObject({
      ok: true,
      data: { status: 'BLOCKED', code: 'DELIVERY_DEADLINE', availableDate: '2026-10-08' },
    });
    await expect(fiberMxBuildConnectivityOffer.execute({
      city: 'Guadalajara', requiredBy: '2026-10-01',
    })).resolves.toMatchObject({ ok: true, data: { price: 24_000, currency: 'MXN' } });
    await expect(netBusinessBuildConnectivityOffer.execute({
      city: 'Guadalajara', requiredBy: '2026-10-01',
    })).resolves.toMatchObject({
      ok: true,
      data: { status: 'FULFILLED', availableDate: '2026-09-25', price: 27_500, currency: 'MXN' },
    });

    const discovery = JSON.stringify([FIBERMX_DISCOVERY_METADATA, NETBUSINESS_DISCOVERY_METADATA]);
    for (const privateFact of ['2026-10-08', '2026-09-25', '24000', '27500', 'offerId', 'price']) {
      expect(discovery).not.toContain(privateFact);
    }
  });

  it('selects internet providers using thin metadata and excludes the failed provider on recovery', () => {
    const registry = [FIBERMX_DISCOVERY_METADATA, NETBUSINESS_DISCOVERY_METADATA];
    expect(discoverInternetProvider(registry, 'Guadalajara').id).toBe('fibermx');
    expect(discoverInternetProvider(registry, 'Guadalajara', ['fibermx']).id).toBe('netbusiness');
    expect(FIBERMX_DISCOVERY_METADATA.origin).toBe('http://localhost:4700');
    expect(NETBUSINESS_DISCOVERY_METADATA.origin).toBe('http://localhost:4800');
    expect(INTERNET_BROKER_TOOL_NAMES).toEqual([
      'check_coverage', 'check_installation_date', 'build_connectivity_offer',
    ]);
  });

  it('fails closed before the canonical 60% post-TechSupply state', async () => {
    const { goalState, handoff } = await createExecutedHandoff();
    await expect(runFiberMxInternetRoute(goalState, handoff, {
      invoke: executeFiberMxBrokerTool,
    })).rejects.toMatchObject({ code: 'INVALID_GOAL_STATE' });
  });

  it('records FiberMX as a visible structured blocker without counting its proposal', async () => {
    const { goalState, handoff } = await createPostTechSupplyGoal();
    const invoke = vi.fn(executeFiberMxBrokerTool);
    const result = await runFiberMxInternetRoute(goalState, handoff, { invoke });
    const internet = result.goalState.requirements.find(({ id }) => id === 'internet');
    const events = result.goalState.activity.filter(
      (event) => 'requirementId' in event && event.requirementId === 'internet',
    );

    expect(invoke).toHaveBeenCalledTimes(3);
    expect(result.invokedTools).toEqual([...INTERNET_BROKER_TOOL_NAMES]);
    expect(events.map((event) => 'toStatus' in event ? event.toStatus : undefined)).toEqual([
      'DISCOVERED', 'MATCHED', 'PROPOSED', 'BLOCKED',
    ]);
    expect(internet).toMatchObject({
      status: 'BLOCKED',
      providerId: 'fibermx',
      estimatedCost: 24_000,
      blocker: { code: 'DELIVERY_DEADLINE' },
      failureHistory: [{ providerId: 'fibermx', blocker: { code: 'DELIVERY_DEADLINE' } }],
    });
    expect(result.goalState).toMatchObject({
      progress: 60, budgetUsed: 345_000, budgetRemaining: 155_000,
    });
    expect(result.blocker.message).toContain('2026-10-08');
    expect(result.blocker.message).toContain('2026-10-01');
  });

  it('reroutes only internet, preserves FiberMX failure history, and reaches exactly 80%', async () => {
    const { goalState, handoff } = await createPostTechSupplyGoal();
    const blocked = await runFiberMxInternetRoute(goalState, handoff, {
      invoke: executeFiberMxBrokerTool,
    });
    const invoke = vi.fn(executeNetBusinessBrokerTool);
    const recovered = await runNetBusinessInternetRecovery(blocked.goalState, handoff, { invoke });
    const internet = recovered.goalState.requirements.find(({ id }) => id === 'internet');
    const security = recovered.goalState.requirements.find(({ id }) => id === 'security');
    const reroute = recovered.goalState.activity.find((event) => event.action === 'REQUIREMENT_REROUTED');

    expect(invoke).toHaveBeenCalledTimes(3);
    expect(recovered.invokedTools).toEqual([...INTERNET_BROKER_TOOL_NAMES]);
    expect(internet).toMatchObject({
      status: 'FULFILLED',
      providerId: 'netbusiness',
      estimatedCost: 27_500,
      failureHistory: [{
        providerId: 'fibermx',
        blocker: { code: 'DELIVERY_DEADLINE' },
      }],
    });
    expect(internet?.blocker).toBeUndefined();
    expect(reroute).toMatchObject({
      providerId: 'netbusiness',
      fromStatus: 'BLOCKED',
      toStatus: 'MATCHED',
      details: { previousProviderId: 'fibermx', blocker: { code: 'DELIVERY_DEADLINE' } },
    });
    expect(recovered.goalState).toMatchObject({
      progress: 80, budgetUsed: 372_500, budgetRemaining: 127_500,
    });
    expect(security).toMatchObject({ status: 'PENDING' });
    expect(security?.providerId).toBeUndefined();

    const persisted = JSON.stringify({ internet, events: recovered.goalState.activity });
    expect(persisted).toContain('fibermx');
    expect(persisted).toContain('netbusiness');
    expect(persisted).not.toContain('fibermx-connectivity-guadalajara');
    expect(persisted).not.toContain('netbusiness-connectivity-guadalajara');
  });

  it('validates all provider facts before returning a Goal State change', async () => {
    const { goalState, handoff } = await createPostTechSupplyGoal();
    const snapshot = structuredClone(goalState);
    await expect(runFiberMxInternetRoute(goalState, handoff, {
      async invoke(toolName, input) {
        const result = await executeFiberMxBrokerTool(toolName, input);
        return toolName === 'check_installation_date' && result.ok
          ? { ...result, data: { ...(result.data as Record<string, unknown>), availableDate: '2026-09-01' } }
          : result;
      },
    })).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESULT' });
    expect(goalState).toEqual(snapshot);
    expect(goalState.requirements.find(({ id }) => id === 'internet')).toMatchObject({ status: 'PENDING' });
  });

  it('renders the strong blocked moment, recovered route, origins, tools, and final checkpoint', async () => {
    const { goalState, handoff } = await createPostTechSupplyGoal();
    const blocked = await runFiberMxInternetRoute(goalState, handoff, { invoke: executeFiberMxBrokerTool });
    const blockedHtml = renderMissionDashboard(blocked.goalState, undefined, undefined, {
      fiberMxOrigin: 'http://localhost:4700',
      netBusinessOrigin: 'http://localhost:4800',
      phase: 'BLOCKED',
      message: blocked.blocker.message,
      fiberMxTransport: 'WEBMCP',
    });
    expect(blockedHtml).toContain('Visible provider failure · DELIVERY_DEADLINE');
    expect(blockedHtml).toContain('Oct 8 installation');
    expect(blockedHtml).toContain('misses Oct 1 deadline');
    expect(blockedHtml).toContain('Recover with another provider');
    expect(blockedHtml).toContain('60%');
    expect(blockedHtml).toContain('MXN 345,000');

    const recovered = await runNetBusinessInternetRecovery(blocked.goalState, handoff, {
      invoke: executeNetBusinessBrokerTool,
    });
    const html = renderMissionDashboard(recovered.goalState, undefined, undefined, {
      fiberMxOrigin: 'http://localhost:4700',
      netBusinessOrigin: 'http://localhost:4800',
      phase: 'COMPLETE',
      message: 'Recovered.',
      fiberMxTransport: 'WEBMCP',
      netBusinessTransport: 'WEBMCP',
    });
    const timeline = renderAgentActivityTimeline(recovered.goalState);
    expect(html).toContain('Internet recovered through NetBusiness');
    expect(html).toContain('FiberMX · Oct 8');
    expect(html).toContain('NetBusiness · Sep 25');
    expect(html).toContain('MXN 27,500');
    expect(html).toContain('80%');
    expect(html).toContain('MXN 372,500');
    expect(html).toContain('MXN 127,500');
    expect(html).toContain('Independent FiberMX provider website');
    expect(html).toContain('Independent NetBusiness provider website');
    expect(html).toContain('src="http://localhost:4700" allow="tools"');
    expect(html).toContain('src="http://localhost:4800" allow="tools"');
    expect(timeline).toContain('<code>check_coverage</code>');
    expect(timeline).toContain('<code>check_installation_date</code>');
    expect(timeline).toContain('<code>build_connectivity_offer</code>');
    expect(timeline).toContain('rerouted only internet to NetBusiness');
  });
});

async function createExecutedHandoff(): Promise<{ goalState: GoalState; handoff: IntentHandoff }> {
  const officePro = await runOfficeProBrandMode(createInitialHeroGoalState(), {
    invoke: executeOfficeProBrandTool,
  });
  const proposed = proposeOfficeProIntentHandoff(officePro.goalState);
  const authorized = authorizeOfficeProIntentHandoff(proposed.goalState, proposed.handoff);
  return executeOfficeProIntentHandoff(authorized.goalState, authorized.handoff);
}

async function createPostTechSupplyGoal(): Promise<{ goalState: GoalState; handoff: IntentHandoff }> {
  const executed = await createExecutedHandoff();
  const techSupply = await runTechSupplyBrokerMode(executed.goalState, executed.handoff, {
    invoke: executeTechSupplyBrokerTool,
  });
  return { goalState: techSupply.goalState, handoff: executed.handoff };
}
