import { describe, expect, it, vi } from 'vitest';

import { executeFiberMxBrokerTool } from '../../fibermx/src/index.js';
import { executeNetBusinessBrokerTool } from '../../netbusiness/src/index.js';
import { executeOfficeProBrandTool } from '../../officepro/src/index.js';
import { executeSecureNowTool } from '../../securenow/src/index.js';
import { executeTechSupplyBrokerTool } from '../../techsupply/src/index.js';
import { createInitialHeroGoalState } from './dashboard-fixtures.js';
import { runFiberMxInternetRoute, runNetBusinessInternetRecovery } from './internet-broker-mode.js';
import { runOfficeProBrandMode } from './officepro-brand-mode.js';
import {
  authorizeOfficeProIntentHandoff,
  executeOfficeProIntentHandoff,
  proposeOfficeProIntentHandoff,
} from './officepro-intent-handoff.js';
import {
  executeSecureNowInstallation,
  recordSecureNowApproval,
  runSecureNowPlanning,
} from './securenow-broker-mode.js';
import { runTechSupplyBrokerMode } from './techsupply-broker-mode.js';

describe('complete deterministic hero integration', () => {
  it('replays every canonical checkpoint through one approved commitment', async () => {
    const initial = createInitialHeroGoalState();
    expect(initial).toMatchObject({ progress: 0, budgetUsed: 0, budgetRemaining: 500_000 });

    const furniture = await runOfficeProBrandMode(initial, { invoke: executeOfficeProBrandTool });
    expect(furniture.goalState).toMatchObject({
      progress: 40, budgetUsed: 155_000, budgetRemaining: 345_000,
    });

    const proposed = proposeOfficeProIntentHandoff(furniture.goalState);
    expect(proposed.handoff.status).toBe('PROPOSED');
    const authorized = authorizeOfficeProIntentHandoff(proposed.goalState, proposed.handoff);
    expect(authorized.handoff.status).toBe('AUTHORIZED');
    const executed = executeOfficeProIntentHandoff(authorized.goalState, authorized.handoff);
    expect(executed.handoff.status).toBe('EXECUTED');

    const computers = await runTechSupplyBrokerMode(executed.goalState, executed.handoff, {
      invoke: executeTechSupplyBrokerTool,
    });
    expect(computers.goalState).toMatchObject({
      progress: 60, budgetUsed: 345_000, budgetRemaining: 155_000,
    });

    const blocked = await runFiberMxInternetRoute(computers.goalState, executed.handoff, {
      invoke: executeFiberMxBrokerTool,
    });
    expect(blocked.goalState.requirements.find(({ id }) => id === 'internet')).toMatchObject({
      status: 'BLOCKED',
      providerId: 'fibermx',
      blocker: { code: 'DELIVERY_DEADLINE' },
    });

    const recovered = await runNetBusinessInternetRecovery(blocked.goalState, executed.handoff, {
      invoke: executeNetBusinessBrokerTool,
    });
    expect(recovered.goalState).toMatchObject({
      progress: 80, budgetUsed: 372_500, budgetRemaining: 127_500,
    });

    const planningInvoker = vi.fn(executeSecureNowTool);
    const planned = await runSecureNowPlanning(recovered.goalState, executed.handoff, {
      invoke: planningInvoker,
    });
    expect(planned.goalState.requirements.find(({ id }) => id === 'security')).toMatchObject({
      status: 'REQUIRES_HUMAN',
      approval: { required: true, approved: false },
    });
    expect(planned.goalState.progress).toBe(80);
    expect(planningInvoker.mock.calls.map(([toolName]) => toolName)).not.toContain('request_installation');

    const commitmentInvoker = vi.fn(executeSecureNowTool);
    expect(commitmentInvoker).toHaveBeenCalledTimes(0);
    const approved = recordSecureNowApproval(planned.goalState, planned.proposal);
    const complete = await executeSecureNowInstallation(approved, planned.proposal, {
      invoke: commitmentInvoker,
    });
    expect(commitmentInvoker).toHaveBeenCalledTimes(1);
    expect(commitmentInvoker).toHaveBeenCalledWith('request_installation', expect.any(Object));
    expect(complete.goalState).toMatchObject({
      progress: 100, budgetUsed: 410_000, budgetRemaining: 90_000,
    });

    const internet = complete.goalState.requirements.find(({ id }) => id === 'internet');
    const security = complete.goalState.requirements.find(({ id }) => id === 'security');
    expect(internet).toMatchObject({
      providerId: 'netbusiness',
      failureHistory: [{ providerId: 'fibermx', blocker: { code: 'DELIVERY_DEADLINE' } }],
    });
    expect(security).toMatchObject({
      status: 'FULFILLED', approval: { required: true, approved: true },
    });
    const approvalIndex = complete.goalState.activity.findIndex(
      ({ action }) => action === 'REQUIREMENT_APPROVAL_RECORDED',
    );
    const commitmentIndex = complete.goalState.activity.findIndex(
      (event) => 'details' in event && event.details?.toolName === 'request_installation',
    );
    expect(approvalIndex).toBeGreaterThan(-1);
    expect(commitmentIndex).toBeGreaterThan(approvalIndex);
  });
});
