import {
  createGoalState,
  rerouteRequirement,
  transitionRequirement,
} from '@nexus/goal-state';
import type {
  GoalState,
  Requirement,
  RequirementApproval,
  RequirementBlocker,
  RequirementStatus,
} from '@nexus/goal-state';
import {
  authorizeIntentHandoff,
  canBeginBrokerRouting,
  executeIntentHandoff,
  proposeIntentHandoff,
} from '@nexus/intent-handoff';
import type { ToolResult } from '@nexus/webmcp';
import { describe, expect, it } from 'vitest';

import {
  fiberMx,
  fiberMxBuildConnectivityOffer,
  fiberMxCheckCoverage,
} from '../../fibermx/src/index.js';
import {
  netBusiness,
  netBusinessBuildConnectivityOffer,
} from '../../netbusiness/src/index.js';
import {
  officePro,
  officeProAnalyzeOfficeRequirement,
  officeProBuildFurniturePackage,
  officeProCheckDelivery,
  officeProSearchFurniture,
} from '../../officepro/src/index.js';
import {
  secureNow,
  secureNowBuildSecurityPackage,
  secureNowRequestInstallation,
} from '../../securenow/src/index.js';
import {
  techSupply,
  techSupplyBuildComputerPackage,
  techSupplyCheckInventory,
} from '../../techsupply/src/index.js';

const mission = {
  city: 'Guadalajara',
  employees: 20,
  deadline: '2026-10-01',
  budget: 500_000,
} as const;

describe('deterministic provider-owned hero fixtures', () => {
  it('lets OfficePro fulfill furniture but not unrelated requirements', async () => {
    const analysis = success(
      await officeProAnalyzeOfficeRequirement.execute({
        city: mission.city,
        employees: mission.employees,
        requirementTypes: ['desk', 'chair', 'computer', 'internet', 'security'],
      }),
    );
    const search = success(
      await officeProSearchFurniture.execute({
        city: mission.city,
        employees: mission.employees,
      }),
    );
    const packageOffer = success(
      await officeProBuildFurniturePackage.execute({
        city: mission.city,
        employees: mission.employees,
      }),
    );
    const delivery = success(
      await officeProCheckDelivery.execute({ city: mission.city, requiredBy: mission.deadline }),
    );

    expect(analysis.supportedTypes).toEqual(['desk', 'chair']);
    expect(analysis.unsupportedTypes).toEqual(['computer', 'internet', 'security']);
    expect(search.items.map((item) => item.stock)).toEqual([20, 20]);
    expect(packageOffer).toMatchObject({
      packageId: 'officepro-furniture-20',
      totalPrice: 155_000,
      deliveryDate: '2026-09-20',
    });
    expect(packageOffer.items.map((item) => item.totalPrice)).toEqual([80_000, 75_000]);
    expect(delivery).toMatchObject({ meetsDeadline: true, availableDate: '2026-09-20' });
  });

  it('lets TechSupply fulfill exactly 20 deterministic computers', async () => {
    const inventory = success(
      await techSupplyCheckInventory.execute({ city: mission.city, quantity: 20 }),
    );
    const packageOffer = success(
      await techSupplyBuildComputerPackage.execute({ city: mission.city, quantity: 20 }),
    );

    expect(inventory).toMatchObject({ stock: 20, requestedQuantity: 20, available: true });
    expect(packageOffer).toEqual({
      packageId: 'techsupply-computers-20',
      itemId: 'techsupply-business-laptop',
      quantity: 20,
      unitPrice: 9_500,
      totalPrice: 190_000,
      currency: 'MXN',
      deliveryDate: '2026-09-22',
    });
  });

  it('makes FiberMX machine-readably blocked and NetBusiness a valid reroute', async () => {
    const coverage = success(await fiberMxCheckCoverage.execute({ city: mission.city }));
    const blocked = success(
      await fiberMxBuildConnectivityOffer.execute({
        city: mission.city,
        requiredBy: mission.deadline,
      }),
    );
    const fallback = success(
      await netBusinessBuildConnectivityOffer.execute({
        city: mission.city,
        requiredBy: mission.deadline,
      }),
    );

    expect(coverage).toEqual({ city: mission.city, covered: true, serviceAvailable: true });
    expect(blocked).toMatchObject({
      status: 'BLOCKED',
      code: 'DELIVERY_DEADLINE',
      coverage: true,
      serviceAvailable: true,
      availableDate: '2026-10-08',
      requiredBy: '2026-10-01',
    });
    expect(fallback).toMatchObject({
      status: 'FULFILLED',
      coverage: true,
      availableDate: '2026-09-25',
      requiredBy: '2026-10-01',
      meetsDeadline: true,
      price: 27_500,
    });
  });

  it('gates SecureNow commitment while leaving read and planning actions autonomous', async () => {
    const packageOffer = success(
      await secureNowBuildSecurityPackage.execute({
        city: mission.city,
        employees: mission.employees,
        requiredBy: mission.deadline,
      }),
    );
    const beforeApproval = await secureNowRequestInstallation.execute({
      packageId: packageOffer.packageId,
    });

    expect(packageOffer).toMatchObject({
      packageId: 'securenow-office-20',
      price: 37_500,
      installationDate: '2026-09-27',
      meetsDeadline: true,
    });
    expect(beforeApproval).toMatchObject({ ok: false, code: 'REQUIRES_HUMAN' });

    const afterApproval = success(
      await secureNowRequestInstallation.execute({
        packageId: packageOffer.packageId,
        approval: {
          approved: true,
          approvalId: 'approval-securenow-1',
          approvedAt: '2026-09-01T12:26:00.000Z',
          goalId: 'goal-office-guadalajara',
          requirementId: 'security',
          providerId: 'securenow',
          expectedTotal: 37_500,
          currency: 'MXN',
          action: 'request_installation',
          approvalScopeId: 'goal-office-guadalajara:security:securenow:37500:request_installation',
        },
      }),
    );
    expect(afterApproval).toMatchObject({
      status: 'FULFILLED',
      price: 37_500,
      installationDate: '2026-09-27',
    });
  });

  it('keeps NEXUS discovery metadata thin and free of provider business data', () => {
    const registry = [officePro, techSupply, fiberMx, netBusiness, secureNow];
    const serialized = JSON.stringify(registry);

    expect(registry.map((entry) => entry.id)).toEqual([
      'officepro',
      'techsupply',
      'fibermx',
      'netbusiness',
      'securenow',
    ]);
    for (const privateValue of [
      '155000',
      '190000',
      '27500',
      '37500',
      '2026-10-08',
      '2026-09-25',
      'stock',
      'unitPrice',
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it('replays the full handoff, blocker, reroute, approval, and completion narrative', async () => {
    let state = createHeroGoal();

    const furniture = success(
      await officeProBuildFurniturePackage.execute({
        city: mission.city,
        employees: mission.employees,
      }),
    );
    const desk = furniture.items.find((item) => item.type === 'desk');
    const chair = furniture.items.find((item) => item.type === 'chair');
    expect(desk).toBeDefined();
    expect(chair).toBeDefined();
    state = fulfillDirectly(state, 'desks', 'officepro', desk?.totalPrice ?? 0);
    state = fulfillDirectly(state, 'chairs', 'officepro', chair?.totalPrice ?? 0);

    const proposed = proposeIntentHandoff(state, {
      handoffId: 'handoff-officepro-hero',
      sourceProviderId: 'officepro',
      eventId: nextEventId(state),
      occurredAt: nextOccurredAt(state),
    });
    const authorized = authorizeIntentHandoff(proposed.goalState, proposed.handoff, {
      authorizedByUser: true,
      approvedAt: nextOccurredAt(proposed.goalState),
      eventId: nextEventId(proposed.goalState),
    });
    const executed = executeIntentHandoff(authorized.goalState, authorized.handoff, {
      executedAt: nextOccurredAt(authorized.goalState),
      eventId: nextEventId(authorized.goalState),
    });
    expect(canBeginBrokerRouting(executed.handoff)).toBe(true);
    expect(executed.handoff.remainingRequirements.map((item) => item.id)).toEqual([
      'computers',
      'internet',
      'security',
    ]);
    state = executed.goalState;

    const computers = success(
      await techSupplyBuildComputerPackage.execute({ city: mission.city, quantity: 20 }),
    );
    state = fulfillDirectly(state, 'computers', 'techsupply', computers.totalPrice);

    const fiberOffer = success(
      await fiberMxBuildConnectivityOffer.execute({
        city: mission.city,
        requiredBy: mission.deadline,
      }),
    );
    state = move(state, 'internet', 'DISCOVERED');
    state = move(state, 'internet', 'MATCHED', { providerId: 'fibermx' });
    state = move(state, 'internet', 'PROPOSED', { estimatedCost: fiberOffer.price });
    if (fiberOffer.status !== 'BLOCKED' || fiberOffer.code === null) {
      throw new Error('The deterministic FiberMX fixture must block the mission deadline.');
    }
    state = move(state, 'internet', 'BLOCKED', {
      blocker: { code: fiberOffer.code, message: fiberOffer.message },
      details: {
        availableDate: fiberOffer.availableDate,
        requiredBy: fiberOffer.requiredBy,
      },
    });
    state = rerouteRequirement(state, {
      requirementId: 'internet',
      providerId: 'netbusiness',
      eventId: nextEventId(state),
      occurredAt: nextOccurredAt(state),
      details: { reason: 'FiberMX misses the mission deadline.' },
    });

    const netBusinessOffer = success(
      await netBusinessBuildConnectivityOffer.execute({
        city: mission.city,
        requiredBy: mission.deadline,
      }),
    );
    state = move(state, 'internet', 'PROPOSED', { estimatedCost: netBusinessOffer.price });
    state = move(state, 'internet', 'FULFILLED', {
      details: { installationDate: netBusinessOffer.availableDate },
    });

    const securityPackage = success(
      await secureNowBuildSecurityPackage.execute({
        city: mission.city,
        employees: mission.employees,
        requiredBy: mission.deadline,
      }),
    );
    state = move(state, 'security', 'DISCOVERED');
    state = move(state, 'security', 'MATCHED', { providerId: 'securenow' });
    state = move(state, 'security', 'PROPOSED', { estimatedCost: securityPackage.price });

    const pendingCommitment = await secureNowRequestInstallation.execute({
      packageId: securityPackage.packageId,
    });
    expect(pendingCommitment).toMatchObject({ ok: false, code: 'REQUIRES_HUMAN' });
    state = move(state, 'security', 'REQUIRES_HUMAN', {
      approval: { required: true, approved: false },
    });

    const humanApproval = {
      approved: true as const,
      approvalId: 'approval-securenow-hero',
      approvedAt: nextOccurredAt(state),
      goalId: 'goal-office-guadalajara',
      requirementId: 'security',
      providerId: 'securenow',
      expectedTotal: 37_500,
      currency: 'MXN' as const,
      action: 'request_installation',
      approvalScopeId: 'goal-office-guadalajara:security:securenow:37500:request_installation',
    };
    success(
      await secureNowRequestInstallation.execute({
        packageId: securityPackage.packageId,
        approval: humanApproval,
      }),
    );
    state = move(state, 'security', 'FULFILLED', {
      approval: { required: true, approved: true },
      details: {
        approvalId: humanApproval.approvalId,
        approvedAt: humanApproval.approvedAt,
      },
    });

    expect(state.requirements.every((item) => item.status === 'FULFILLED')).toBe(true);
    expect(state).toMatchObject({ progress: 100, budgetUsed: 410_000, budgetRemaining: 90_000 });
    expect(state.budgetUsed).toBeLessThanOrEqual(mission.budget);

    const internet = requirement(state, 'internet');
    expect(internet.failureHistory).toEqual([
      expect.objectContaining({
        providerId: 'fibermx',
        blocker: expect.objectContaining({ code: 'DELIVERY_DEADLINE' }),
      }),
    ]);
    expect(
      state.activity.some(
        (event) => event.action === 'REQUIREMENT_REROUTED' && event.providerId === 'netbusiness',
      ),
    ).toBe(true);

    const security = requirement(state, 'security');
    expect(security.approval).toEqual({ required: true, approved: true });
    expect(
      state.activity.some(
        (event) =>
          'requirementId' in event &&
          event.requirementId === 'security' &&
          event.outcome === 'REQUIRES_HUMAN',
      ),
    ).toBe(true);
    expect(state.activity.at(-1)?.details).toMatchObject({
      approvalId: 'approval-securenow-hero',
    });
  });
});

type TransitionOptions = {
  providerId?: string;
  estimatedCost?: number;
  blocker?: RequirementBlocker;
  approval?: RequirementApproval;
  details?: Readonly<Record<string, unknown>>;
};

function createHeroGoal(): GoalState {
  return createGoalState({
    id: 'goal-office-guadalajara',
    goal: 'Open an office for 20 people in Guadalajara',
    constraints: {
      city: mission.city,
      employees: mission.employees,
      budget: mission.budget,
      currency: 'MXN',
      deadline: mission.deadline,
    },
    requirements: [
      { id: 'desks', type: 'desk', quantity: 20, status: 'PENDING' },
      { id: 'chairs', type: 'chair', quantity: 20, status: 'PENDING' },
      { id: 'computers', type: 'computer', quantity: 20, status: 'PENDING' },
      { id: 'internet', type: 'internet', status: 'PENDING' },
      { id: 'security', type: 'security', status: 'PENDING' },
    ],
    activity: [],
  });
}

function fulfillDirectly(
  state: GoalState,
  requirementId: string,
  providerId: string,
  estimatedCost: number,
): GoalState {
  let next = move(state, requirementId, 'DISCOVERED');
  next = move(next, requirementId, 'MATCHED', { providerId });
  next = move(next, requirementId, 'PROPOSED', { estimatedCost });
  return move(next, requirementId, 'FULFILLED');
}

function move(
  state: GoalState,
  requirementId: string,
  toStatus: RequirementStatus,
  options: TransitionOptions = {},
): GoalState {
  return transitionRequirement(state, {
    requirementId,
    toStatus,
    eventId: nextEventId(state),
    occurredAt: nextOccurredAt(state),
    ...options,
  });
}

function requirement(state: GoalState, requirementId: string): Requirement {
  const match = state.requirements.find((item) => item.id === requirementId);
  expect(match).toBeDefined();
  return match as Requirement;
}

function nextEventId(state: GoalState): string {
  return `hero-event-${String(state.activity.length + 1).padStart(2, '0')}`;
}

function nextOccurredAt(state: GoalState): string {
  return `2026-09-01T12:00:${String(state.activity.length + 1).padStart(2, '0')}.000Z`;
}

function success<T>(result: ToolResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.data;
}
