import { REQUIREMENT_STATUSES } from '@nexus/goal-state';
import { describe, expect, it } from 'vitest';

import {
  deriveMissionMode,
  renderAgentActivityTimeline,
  renderMissionDashboard,
  renderRequirementStatus,
} from './dashboard.js';
import { createHeroDashboardStates } from './dashboard-fixtures.js';

const states = createHeroDashboardStates();

describe('NEXUS Mission Dashboard', () => {
  it('renders the canonical mission metadata', () => {
    const html = renderMissionDashboard(states.initial);

    expect(html).toContain('Open an office for 20 people in Guadalajara');
    expect(html).toContain('<dt>Location</dt><dd>Guadalajara</dd>');
    expect(html).toContain('<dt>Team</dt><dd>20 employees</dd>');
    expect(html).toContain('<dt>Deadline</dt><dd>Oct 1, 2026</dd>');
    expect(html).toContain('<dt>Budget</dt><dd>MXN 500,000</dd>');
  });

  it('renders progress derived by canonical Goal State', () => {
    expect(states['officepro-partial'].progress).toBe(40);

    const html = renderMissionDashboard(states['officepro-partial']);
    expect(html).toContain('style="--mission-progress: 40"');
    expect(html).toContain('<strong>40%</strong>');
    expect(html).toContain('<progress class="sr-only" max="100" value="40">');
  });

  it('renders used and remaining budget derived by canonical Goal State', () => {
    expect(states['officepro-partial']).toMatchObject({
      budgetUsed: 155_000,
      budgetRemaining: 345_000,
    });

    const html = renderMissionDashboard(states['officepro-partial']);
    expect(html).toContain('<strong>MXN 155,000</strong>');
    expect(html).toContain('<strong>MXN 345,000</strong>');
  });

  it('renders all five mission requirements', () => {
    const html = renderMissionDashboard(states.initial);

    for (const requirementId of ['desks', 'chairs', 'computers', 'internet', 'security']) {
      expect(html).toContain(`data-requirement-id="${requirementId}"`);
    }
    expect(html.match(/class="requirement-card /g)).toHaveLength(5);
  });

  it('represents every canonical status with visible text in addition to a symbol', () => {
    for (const status of REQUIREMENT_STATUSES) {
      const html = renderRequirementStatus(status);
      expect(html).toContain(`data-status="${status}"`);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toMatch(/<span>(Pending|Discovered|Matched|Proposed|Blocked|Human action|Fulfilled)<\/span>/);
    }
  });

  it('makes a blocker and its structured reason prominent', () => {
    const html = renderMissionDashboard(states['fibermx-blocked']);

    expect(html).toContain('requirement-card--blocked');
    expect(html).toContain('Mission blocker');
    expect(html).toContain('DELIVERY_DEADLINE');
    expect(html).toContain('FiberMX can install on Oct 8, after the Oct 1 mission deadline.');
  });

  it('makes pending human intervention explicit without executing it', () => {
    const security = states['approval-required'].requirements.find(
      (requirement) => requirement.id === 'security',
    );
    expect(security).toMatchObject({
      status: 'REQUIRES_HUMAN',
      approval: { required: true, approved: false },
    });

    const html = renderMissionDashboard(states['approval-required']);
    expect(html).toContain('requirement-card--requires-human');
    expect(html).toContain('Human intervention required');
    expect(html).toContain('NEXUS is paused before commitment.');
  });

  it('clearly distinguishes fulfilled requirements and approved commitments', () => {
    const html = renderMissionDashboard(states.complete);

    expect(html.match(/requirement-card--fulfilled/g)).toHaveLength(5);
    expect(html).toContain('data-status="FULFILLED"');
    expect(html).toContain('Human approval granted');
  });

  it('sorts Goal State activity chronologically rather than trusting input order', () => {
    const activity = states['officepro-partial'].activity;
    const earlier = activity[0];
    const later = activity.at(-1);
    expect(earlier).toBeDefined();
    expect(later).toBeDefined();

    const html = renderAgentActivityTimeline(
      {
        ...states['officepro-partial'],
        activity: [later, earlier].filter((event) => event !== undefined),
      },
    );
    expect(html.indexOf(`data-event-id="${earlier?.id}"`)).toBeLessThan(
      html.indexOf(`data-event-id="${later?.id}"`),
    );
  });

  it('shows provider assignment and recovered routes from Goal State', () => {
    const html = renderMissionDashboard(states['internet-rerouted']);

    expect(html).toContain('<dt>Provider</dt><dd>NetBusiness</dd>');
    expect(html).toContain('Recovered route');
    expect(html).toContain('<strong>FiberMX</strong> blocked');
    expect(html).toContain('<strong>NetBusiness</strong>');
  });

  it('renders initial and complete states at their canonical metric extremes', () => {
    const initialHtml = renderMissionDashboard(states.initial);
    const completeHtml = renderMissionDashboard(states.complete);

    expect(states.initial).toMatchObject({ progress: 0, budgetUsed: 0, budgetRemaining: 500_000 });
    expect(initialHtml).toContain('<strong>0%</strong>');
    expect(initialHtml).toContain('Ready to begin');

    expect(states.complete).toMatchObject({
      progress: 100,
      budgetUsed: 410_000,
      budgetRemaining: 90_000,
    });
    expect(completeHtml).toContain('<strong>100%</strong>');
    expect(completeHtml).toContain('<strong>MXN 410,000</strong>');
    expect(completeHtml).toContain('<strong>MXN 90,000</strong>');
  });

  it('renders discovery, WebMCP, handoff, failure, reroute, approval, and completion events', () => {
    const html = renderAgentActivityTimeline(states.complete);

    expect(html).toContain('search_furniture');
    expect(html).toContain('Intent Handoff');
    expect(html).toContain('check_installation_date');
    expect(html).toContain('Deadline conflict');
    expect(html).toContain('Internet rerouted from FiberMX to NetBusiness.');
    expect(html).toContain('request_installation');
    expect(html).toContain('waiting for explicit human approval');
    expect(html).toContain('Mission complete within budget and deadline.');
  });

  it('derives Brand and Broker mode only when Goal State activity supports them', () => {
    expect(deriveMissionMode(states.initial)).toBeUndefined();
    expect(deriveMissionMode(states['officepro-partial'])).toBe('Brand Mode');
    expect(deriveMissionMode(states['fibermx-blocked'])).toBe('Broker Mode');
  });
});
