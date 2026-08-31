import type { GoalState } from '@nexus/goal-state';
import type { IntentHandoff } from '@nexus/intent-handoff';
import type { WebMcpDocument } from '@nexus/webmcp';
import { describe, expect, it, vi } from 'vitest';

import { registerProviderTools } from '../../../packages/provider-template/src/index.js';
import { executeFiberMxBrokerTool } from '../../fibermx/src/index.js';
import { executeNetBusinessBrokerTool } from '../../netbusiness/src/index.js';
import { executeOfficeProBrandTool } from '../../officepro/src/index.js';
import {
  SECURENOW_COMMIT_TOOL_NAMES,
  SECURENOW_PLANNING_TOOL_NAMES as PROVIDER_PLANNING_TOOLS,
  executeSecureNowTool,
  executeSecureNowWebsitePlan,
  secureNowAssessSecurityRequirement,
  secureNowBrokerProvider,
  secureNowBuildSecurityPackage,
} from '../../securenow/src/index.js';
import { executeTechSupplyBrokerTool } from '../../techsupply/src/index.js';
import { renderAgentActivityTimeline, renderMissionDashboard } from './dashboard.js';
import { createInitialHeroGoalState } from './dashboard-fixtures.js';
import {
  runFiberMxInternetRoute,
  runNetBusinessInternetRecovery,
} from './internet-broker-mode.js';
import { runOfficeProBrandMode } from './officepro-brand-mode.js';
import {
  authorizeOfficeProIntentHandoff,
  executeOfficeProIntentHandoff,
  proposeOfficeProIntentHandoff,
} from './officepro-intent-handoff.js';
import {
  SECURENOW_APPROVAL_SCOPE_ID,
  SECURENOW_DISCOVERY_METADATA,
  SECURENOW_PLANNING_TOOL_NAMES,
  createSecureNowApproval,
  declineSecureNowApproval,
  discoverSecurityProvider,
  executeSecureNowInstallation,
  recordSecureNowApproval,
  runSecureNowPlanning,
} from './securenow-broker-mode.js';
import type { BoundSecureNowApproval } from './securenow-broker-mode.js';
import { runTechSupplyBrokerMode } from './techsupply-broker-mode.js';

describe('SecureNow human approval hero segment', () => {
  it('registers genuine READ/PLAN/COMMIT tools with the NEXUS origin boundary', async () => {
    const registerTool = vi.fn(async () => undefined);
    await expect(registerProviderTools(
      { modelContext: { registerTool } } satisfies WebMcpDocument,
      secureNowBrokerProvider,
      { exposedTo: ['http://localhost:4400'] },
    )).resolves.toMatchObject({
      status: 'REGISTERED',
      registeredTools: [
        'assess_security_requirement', 'build_security_package', 'request_installation',
      ],
    });
    expect(registerTool).toHaveBeenCalledTimes(3);
    expect(secureNowBrokerProvider.tools.map(({ operation }) => operation)).toEqual([
      'READ', 'PLAN', 'COMMIT',
    ]);
  });

  it('keeps assessment, package, pricing, and installation facts provider-owned', async () => {
    await expect(secureNowAssessSecurityRequirement.execute({
      city: 'Guadalajara', employees: 20, requiredBy: '2026-10-01',
    })).resolves.toMatchObject({ ok: true, data: { supported: true } });
    await expect(secureNowBuildSecurityPackage.execute({
      city: 'Guadalajara', employees: 20, requiredBy: '2026-10-01',
    })).resolves.toMatchObject({
      ok: true,
      data: {
        price: 37_500,
        currency: 'MXN',
        installationDate: '2026-09-27',
        requiredBy: '2026-10-01',
        meetsDeadline: true,
      },
    });
    const metadata = JSON.stringify(SECURENOW_DISCOVERY_METADATA);
    for (const privateFact of ['37500', '2026-09-27', 'packageId', 'components', 'price']) {
      expect(metadata).not.toContain(privateFact);
    }
    expect(discoverSecurityProvider([SECURENOW_DISCOVERY_METADATA], 'Guadalajara')).toEqual({
      ...SECURENOW_DISCOVERY_METADATA,
      categories: ['security'],
      serviceAreas: ['Guadalajara'],
      capabilities: ['assess_security_requirement', 'build_security_package', 'request_installation'],
    });
  });

  it('requires valid Broker Mode and the canonical 80% recovered state', async () => {
    const { goalState, handoff } = await createExecutedHandoff();
    await expect(runSecureNowPlanning(goalState, handoff, {
      invoke: executeSecureNowTool,
    })).rejects.toMatchObject({ code: 'INVALID_GOAL_STATE' });

    const invalidHandoff = { ...handoff, status: 'PROPOSED' } as unknown as IntentHandoff;
    const postInternet = await createPostInternetGoal();
    await expect(runSecureNowPlanning(postInternet.goalState, invalidHandoff, {
      invoke: executeSecureNowTool,
    })).rejects.toMatchObject({ code: 'BROKER_MODE_REQUIRED' });
  });

  it('runs only autonomous planning tools and stops at REQUIRES_HUMAN', async () => {
    const { goalState, handoff } = await createPostInternetGoal();
    const invoke = vi.fn(executeSecureNowTool);
    const planned = await runSecureNowPlanning(goalState, handoff, { invoke });
    const security = planned.goalState.requirements.find(({ id }) => id === 'security');
    const internet = planned.goalState.requirements.find(({ id }) => id === 'internet');
    const events = planned.goalState.activity.filter(
      (event) => 'requirementId' in event && event.requirementId === 'security',
    );

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls.map(([name]) => name)).toEqual([...SECURENOW_PLANNING_TOOL_NAMES]);
    expect(invoke.mock.calls.some(([name]) => name === 'request_installation')).toBe(false);
    expect(planned.invokedTools).toEqual([...SECURENOW_PLANNING_TOOL_NAMES]);
    expect(events.map((event) => 'toStatus' in event ? event.toStatus : undefined)).toEqual([
      'DISCOVERED', 'MATCHED', 'PROPOSED', 'REQUIRES_HUMAN',
    ]);
    expect(security).toMatchObject({
      status: 'REQUIRES_HUMAN',
      providerId: 'securenow',
      estimatedCost: 37_500,
      approval: { required: true, approved: false },
    });
    expect(planned.proposal).toMatchObject({
      total: 37_500,
      currency: 'MXN',
      installationDate: '2026-09-27',
      meetsDeadline: true,
      action: 'request_installation',
    });
    expect(planned.goalState).toMatchObject({
      progress: 80, budgetUsed: 372_500, budgetRemaining: 127_500,
    });
    expect(internet?.failureHistory).toMatchObject([{
      providerId: 'fibermx', blocker: { code: 'DELIVERY_DEADLINE' },
    }]);
    expect(JSON.stringify(planned.goalState)).not.toContain('securenow-office-20');
  });

  it('cannot invoke commitment through either orchestration or website fallback before approval', async () => {
    const { goalState, handoff } = await createPostInternetGoal();
    const planned = await runSecureNowPlanning(goalState, handoff, { invoke: executeSecureNowTool });
    const invoke = vi.fn(executeSecureNowTool);

    await expect(executeSecureNowInstallation(planned.goalState, planned.proposal, { invoke }))
      .rejects.toMatchObject({ code: 'INVALID_APPROVAL' });
    expect(invoke).not.toHaveBeenCalled();
    expect(await executeSecureNowWebsitePlan()).toHaveLength(2);
    expect(PROVIDER_PLANNING_TOOLS).toEqual([
      'assess_security_requirement', 'build_security_package',
    ]);
    expect(SECURENOW_COMMIT_TOOL_NAMES).toEqual(['request_installation']);
    await expect(executeSecureNowTool('request_installation', {
      packageId: 'securenow-office-20',
    })).resolves.toMatchObject({ ok: false, code: 'REQUIRES_HUMAN' });
  });

  it('keeps cancel uncommitted and rejects stale or unrelated approval binding', async () => {
    const { goalState, handoff } = await createPostInternetGoal();
    const planned = await runSecureNowPlanning(goalState, handoff, { invoke: executeSecureNowTool });
    expect(declineSecureNowApproval(planned.goalState, planned.proposal)).toBe(planned.goalState);
    expect(planned.goalState.requirements.find(({ id }) => id === 'security')).toMatchObject({
      status: 'REQUIRES_HUMAN', approval: { approved: false },
    });

    const valid = createSecureNowApproval(planned.goalState, planned.proposal);
    const stale = { ...valid, expectedTotal: 40_000 } as unknown as BoundSecureNowApproval;
    expect(() => recordSecureNowApproval(planned.goalState, planned.proposal, stale))
      .toThrow('stale, malformed, or bound to a different commitment');
  });

  it('records human approval before invoking commitment exactly once', async () => {
    const { goalState, handoff } = await createPostInternetGoal();
    const planned = await runSecureNowPlanning(goalState, handoff, { invoke: executeSecureNowTool });
    const approved = recordSecureNowApproval(planned.goalState, planned.proposal);
    const invoke = vi.fn(executeSecureNowTool);
    const committed = await executeSecureNowInstallation(approved, planned.proposal, { invoke });
    const security = committed.goalState.requirements.find(({ id }) => id === 'security');
    const internet = committed.goalState.requirements.find(({ id }) => id === 'internet');
    const approvalIndex = committed.goalState.activity.findIndex(
      (event) => event.action === 'REQUIREMENT_APPROVAL_RECORDED',
    );
    const commitmentIndex = committed.goalState.activity.findIndex(
      (event) => 'details' in event && event.details?.toolName === 'request_installation',
    );

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('request_installation', expect.objectContaining({
      approval: expect.objectContaining({
        goalId: 'goal-office-guadalajara',
        requirementId: 'security',
        providerId: 'securenow',
        expectedTotal: 37_500,
        action: 'request_installation',
        approvalScopeId: SECURENOW_APPROVAL_SCOPE_ID,
      }),
    }));
    expect(approvalIndex).toBeGreaterThan(-1);
    expect(commitmentIndex).toBeGreaterThan(approvalIndex);
    expect(security).toMatchObject({
      status: 'FULFILLED',
      providerId: 'securenow',
      estimatedCost: 37_500,
      approval: { approved: true, expectedTotal: 37_500 },
    });
    expect(committed.goalState).toMatchObject({
      progress: 100, budgetUsed: 410_000, budgetRemaining: 90_000,
    });
    expect(internet?.failureHistory).toMatchObject([{
      providerId: 'fibermx', blocker: { code: 'DELIVERY_DEADLINE' },
    }]);
    expect(JSON.stringify(committed.goalState)).not.toContain('securenow-office-20');
    expect(JSON.stringify(committed.goalState)).not.toContain('installation-securenow');
  });

  it('validates commitment results and preserves the approved state on failure', async () => {
    const { goalState, handoff } = await createPostInternetGoal();
    const planned = await runSecureNowPlanning(goalState, handoff, { invoke: executeSecureNowTool });
    const approved = recordSecureNowApproval(planned.goalState, planned.proposal);
    const snapshot = structuredClone(approved);
    await expect(executeSecureNowInstallation(approved, planned.proposal, {
      async invoke(toolName, input) {
        const result = await executeSecureNowTool(toolName, input);
        return result.ok
          ? { ...result, data: { ...(result.data as Record<string, unknown>), price: 37_501 } }
          : result;
      },
    })).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESULT' });
    expect(approved).toEqual(snapshot);
    expect(approved.requirements.find(({ id }) => id === 'security')).toMatchObject({
      status: 'REQUIRES_HUMAN', approval: { approved: true },
    });
  });

  it('renders the approval stop and the complete journey from canonical Goal State', async () => {
    const { goalState, handoff } = await createPostInternetGoal();
    const planned = await runSecureNowPlanning(goalState, handoff, { invoke: executeSecureNowTool });
    const approvalHtml = renderMissionDashboard(planned.goalState, undefined, undefined, undefined, {
      providerOrigin: 'http://localhost:4900',
      phase: 'REQUIRES_HUMAN',
      message: 'request_installation has not been invoked.',
      transport: 'WEBMCP',
    });
    expect(approvalHtml).toContain('REQUIRES_HUMAN · HUMAN APPROVAL REQUIRED');
    expect(approvalHtml).toContain('Approve and continue');
    expect(approvalHtml).toContain('MXN 37,500');
    expect(approvalHtml).toContain('The earlier Intent Handoff did not authorize this commitment.');
    expect(approvalHtml).toContain('src="http://localhost:4900" allow="tools"');
    expect(approvalHtml).toContain('80%');

    const approved = recordSecureNowApproval(planned.goalState, planned.proposal);
    const complete = await executeSecureNowInstallation(approved, planned.proposal, {
      invoke: executeSecureNowTool,
    });
    const html = renderMissionDashboard(complete.goalState, undefined, undefined, undefined, {
      providerOrigin: 'http://localhost:4900', phase: 'COMPLETE', message: 'Complete.',
    });
    const timeline = renderAgentActivityTimeline(complete.goalState);
    expect(html).toContain('MISSION COMPLETE · 100%');
    expect(html).toContain('MXN 410,000 / MXN 500,000');
    expect(html).toContain('MXN 90,000');
    expect(html).toContain('✕ FiberMX — Deadline failure');
    expect(html).toContain('✓ NetBusiness — Recovery');
    expect(html).toContain('✓ SecureNow — Human approval recorded');
    expect(timeline).toContain('<strong>Human</strong>');
    expect(timeline).toContain('Human approved SecureNow installation');
    expect(timeline).toContain('<code>request_installation</code>');
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

async function createPostInternetGoal(): Promise<{ goalState: GoalState; handoff: IntentHandoff }> {
  const executed = await createExecutedHandoff();
  const computers = await runTechSupplyBrokerMode(executed.goalState, executed.handoff, {
    invoke: executeTechSupplyBrokerTool,
  });
  const blocked = await runFiberMxInternetRoute(computers.goalState, executed.handoff, {
    invoke: executeFiberMxBrokerTool,
  });
  const recovered = await runNetBusinessInternetRecovery(blocked.goalState, executed.handoff, {
    invoke: executeNetBusinessBrokerTool,
  });
  return { goalState: recovered.goalState, handoff: executed.handoff };
}
