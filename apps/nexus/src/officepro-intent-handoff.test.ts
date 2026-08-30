import {
  canBeginBrokerRouting,
  executeIntentHandoff,
  IntentHandoffError,
} from '@nexus/intent-handoff';
import { describe, expect, it, vi } from 'vitest';

import { executeOfficeProBrandTool } from '../../officepro/src/index.js';
import {
  deriveMissionMode,
  renderAgentActivityTimeline,
  renderMissionDashboard,
} from './dashboard.js';
import { createInitialHeroGoalState } from './dashboard-fixtures.js';
import { runOfficeProBrandMode } from './officepro-brand-mode.js';
import {
  authorizeOfficeProIntentHandoff,
  executeOfficeProIntentHandoff,
  proposeOfficeProIntentHandoff,
} from './officepro-intent-handoff.js';

describe('OfficePro Intent Handoff live segment', () => {
  it('proposes only the minimized remaining intent and continuation constraints', async () => {
    const partialGoal = await createOfficeProPartialGoal();
    const proposed = proposeOfficeProIntentHandoff(partialGoal);

    expect(proposed.handoff).toEqual({
      handoffId: 'handoff-officepro-hero',
      goalId: 'goal-office-guadalajara',
      status: 'PROPOSED',
      source: { providerId: 'officepro', mode: 'BRAND' },
      destination: { type: 'NEXUS', mode: 'BROKER' },
      remainingRequirements: [
        { id: 'computers', type: 'computer', quantity: 20 },
        { id: 'internet', type: 'internet' },
        { id: 'security', type: 'security' },
      ],
      constraints: {
        city: 'Guadalajara',
        deadline: '2026-10-01',
        remainingBudget: 345_000,
        currency: 'MXN',
      },
      authorizedByUser: false,
      authorization: { required: true, approved: false },
    });

    const serialized = JSON.stringify(proposed.handoff);
    for (const forbidden of [
      'desks',
      'chairs',
      'officepro-desk-standard',
      'officepro-chair-ergonomic',
      'itemId',
      'stock',
      'unitPrice',
      'packageId',
      'providerResult',
      'employees',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('keeps routing locked through proposal and authorization, then unlocks on execution', async () => {
    const partialGoal = await createOfficeProPartialGoal();
    const proposed = proposeOfficeProIntentHandoff(partialGoal);
    expect(canBeginBrokerRouting(proposed.handoff)).toBe(false);
    expect(deriveMissionMode(proposed.goalState)).toBe('Brand Mode');

    const authorized = authorizeOfficeProIntentHandoff(proposed.goalState, proposed.handoff);
    expect(canBeginBrokerRouting(authorized.handoff)).toBe(false);
    expect(deriveMissionMode(authorized.goalState)).toBe('Brand Mode');

    const executed = executeOfficeProIntentHandoff(authorized.goalState, authorized.handoff);
    expect(canBeginBrokerRouting(executed.handoff)).toBe(true);
    expect(deriveMissionMode(executed.goalState)).toBe('Broker Mode');

    for (const state of [proposed.goalState, authorized.goalState, executed.goalState]) {
      expect(state).toMatchObject({
        progress: 40,
        budgetUsed: 155_000,
        budgetRemaining: 345_000,
      });
      expect(state.requirements.map(({ id, status }) => ({ id, status }))).toEqual([
        { id: 'desks', status: 'FULFILLED' },
        { id: 'chairs', status: 'FULFILLED' },
        { id: 'computers', status: 'PENDING' },
        { id: 'internet', status: 'PENDING' },
        { id: 'security', status: 'PENDING' },
      ]);
    }
  });

  it('makes execution without authorization impossible', async () => {
    const partialGoal = await createOfficeProPartialGoal();
    const proposed = proposeOfficeProIntentHandoff(partialGoal);

    expect(() =>
      executeIntentHandoff(proposed.goalState, proposed.handoff, {
        executedAt: '2026-08-30T16:10:00.000Z',
        eventId: 'attempted-unauthorized-execution',
      }),
    ).toThrowError(IntentHandoffError);
    expect(proposed.goalState.activity.some(({ action }) => action === 'HANDOFF_EXECUTED')).toBe(
      false,
    );
  });

  it('records the canonical audit lifecycle with the human actor visible', async () => {
    const partialGoal = await createOfficeProPartialGoal();
    const proposed = proposeOfficeProIntentHandoff(partialGoal);
    const authorized = authorizeOfficeProIntentHandoff(proposed.goalState, proposed.handoff);
    const executed = executeOfficeProIntentHandoff(authorized.goalState, authorized.handoff);
    const handoffEvents = executed.goalState.activity.filter(({ action }) =>
      action.startsWith('HANDOFF_'),
    );

    expect(handoffEvents.map(({ action }) => action)).toEqual([
      'HANDOFF_PROPOSED',
      'HANDOFF_AUTHORIZED',
      'HANDOFF_EXECUTED',
    ]);

    const timeline = renderAgentActivityTimeline(executed.goalState);
    expect(timeline).toContain('<strong>NEXUS</strong>');
    expect(timeline).toContain('<strong>Human</strong>');
    expect(timeline).toContain('Intent Handoff prepared');
    expect(timeline).toContain('explicitly authorized NEXUS');
    expect(timeline).toContain('Broker Mode started');
  });

  it('renders an explicit accessible approval step before the executed Broker Mode state', async () => {
    const partialGoal = await createOfficeProPartialGoal();
    const proposed = proposeOfficeProIntentHandoff(partialGoal);
    const proposedHtml = renderMissionDashboard(proposed.goalState, {
      providerOrigin: 'http://localhost:4500',
      phase: 'COMPLETE',
      message: 'OfficePro completed.',
      handoff: proposed.handoff,
    });

    expect(proposedHtml).toContain('data-handoff-status="PROPOSED"');
    expect(proposedHtml).toContain('Continue this goal through NEXUS?');
    expect(proposedHtml).toContain('Authorize NEXUS to continue');
    expect(proposedHtml).toContain('Stay with OfficePro');
    expect(proposedHtml).toContain('MXN 345,000');
    expect(proposedHtml).toContain('does not make a purchase');
    expect(proposedHtml).not.toContain('data-broker-enabled="true"');

    const authorized = authorizeOfficeProIntentHandoff(proposed.goalState, proposed.handoff);
    const authorizedHtml = renderMissionDashboard(authorized.goalState, {
      providerOrigin: 'http://localhost:4500',
      phase: 'COMPLETE',
      message: 'OfficePro completed.',
      handoff: authorized.handoff,
    });
    expect(authorizedHtml).toContain('Human authorization recorded.');
    expect(authorizedHtml).toContain('Broker routing remains locked');
    expect(authorizedHtml).not.toContain('data-broker-enabled="true"');

    const executed = executeOfficeProIntentHandoff(authorized.goalState, authorized.handoff);
    const executedHtml = renderMissionDashboard(executed.goalState, {
      providerOrigin: 'http://localhost:4500',
      phase: 'COMPLETE',
      message: 'OfficePro completed.',
      handoff: executed.handoff,
    });
    expect(executedHtml).toContain('data-handoff-status="EXECUTED"');
    expect(executedHtml).toContain('data-broker-enabled="true"');
    expect(executedHtml).toContain('Intent transferred to NEXUS');
    expect(executedHtml).toContain('Broker Mode enabled');
    expect(executedHtml).toContain('No provider has been contacted yet.');
  });

  it('does not invoke or assign any second provider during handoff', async () => {
    const invoke = vi.fn(executeOfficeProBrandTool);
    const officePro = await runOfficeProBrandMode(createInitialHeroGoalState(), { invoke });
    const callsAfterOfficePro = invoke.mock.calls.length;
    const proposed = proposeOfficeProIntentHandoff(officePro.goalState);
    const authorized = authorizeOfficeProIntentHandoff(proposed.goalState, proposed.handoff);
    const executed = executeOfficeProIntentHandoff(authorized.goalState, authorized.handoff);

    expect(invoke).toHaveBeenCalledTimes(callsAfterOfficePro);
    expect(callsAfterOfficePro).toBe(4);
    expect(executed.goalState.requirements.slice(2).every(({ providerId }) => !providerId)).toBe(
      true,
    );
    const serializedActivity = JSON.stringify(
      executed.goalState.activity.filter(({ action }) => action.startsWith('HANDOFF_')),
    );
    for (const providerId of ['techsupply', 'fibermx', 'netbusiness', 'securenow']) {
      expect(serializedActivity).not.toContain(providerId);
    }
  });
});

async function createOfficeProPartialGoal() {
  const result = await runOfficeProBrandMode(createInitialHeroGoalState(), {
    invoke: executeOfficeProBrandTool,
  });
  return result.goalState;
}
