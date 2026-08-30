import { REQUIREMENT_STATUSES } from '@nexus/goal-state';
import type {
  ActivityEvent,
  GoalState,
  Requirement,
  RequirementStatus,
} from '@nexus/goal-state';
import type { IntentHandoffLifecycle } from '@nexus/intent-handoff';

export type MissionMode = 'Brand Mode' | 'Broker Mode';

export type OfficeProRuntimeView = {
  providerOrigin: string;
  phase: 'READY' | 'RUNNING' | 'COMPLETE' | 'ERROR';
  message: string;
  transport?: 'WEBMCP' | 'WEBSITE_FALLBACK';
  handoff?: IntentHandoffLifecycle;
};

type StatusPresentation = {
  label: string;
  symbol: string;
  className: string;
};

const STATUS_PRESENTATION: Readonly<Record<RequirementStatus, StatusPresentation>> = {
  PENDING: { label: 'Pending', symbol: '○', className: 'pending' },
  DISCOVERED: { label: 'Discovered', symbol: '⌁', className: 'discovered' },
  MATCHED: { label: 'Matched', symbol: '↗', className: 'matched' },
  PROPOSED: { label: 'Proposed', symbol: '◇', className: 'proposed' },
  BLOCKED: { label: 'Blocked', symbol: '!', className: 'blocked' },
  REQUIRES_HUMAN: {
    label: 'Human action',
    symbol: '◆',
    className: 'requires-human',
  },
  FULFILLED: { label: 'Fulfilled', symbol: '✓', className: 'fulfilled' },
};

const REQUIREMENT_LABELS: Readonly<Record<string, string>> = {
  desk: 'Desks',
  chair: 'Chairs',
  computer: 'Computers',
  internet: 'Internet',
  security: 'Security',
};

const REQUIREMENT_SYMBOLS: Readonly<Record<string, string>> = {
  desk: 'D',
  chair: 'C',
  computer: 'PC',
  internet: 'NET',
  security: 'SEC',
};

const PROVIDER_LABELS: Readonly<Record<string, string>> = {
  officepro: 'OfficePro',
  techsupply: 'TechSupply',
  fibermx: 'FiberMX',
  netbusiness: 'NetBusiness',
  securenow: 'SecureNow',
};

export function deriveMissionMode(goalState: GoalState): MissionMode | undefined {
  if (goalState.activity.some((event) => event.action === 'HANDOFF_EXECUTED')) {
    return 'Broker Mode';
  }

  if (goalState.requirements.some((requirement) => requirement.providerId === 'officepro')) {
    return 'Brand Mode';
  }

  return undefined;
}

export function renderMissionDashboard(
  goalState: GoalState,
  officeProRuntime?: OfficeProRuntimeView,
): string {
  return `<article class="mission-dashboard" aria-labelledby="mission-title">
  ${renderMissionSummary(goalState)}
  ${officeProRuntime ? renderOfficeProRuntime(officeProRuntime) : ''}
  ${renderGoalGraph(goalState)}
  ${renderAgentActivityTimeline(goalState)}
</article>`;
}

export function renderOfficeProRuntime(runtime: OfficeProRuntimeView): string {
  const complete = runtime.phase === 'COMPLETE';
  const busy = runtime.phase === 'RUNNING';
  const brokerEnabled = runtime.handoff?.status === 'EXECUTED';
  const transportLabel =
    runtime.transport === 'WEBMCP'
      ? 'Genuine cross-origin WebMCP'
      : runtime.transport === 'WEBSITE_FALLBACK'
        ? 'Normal provider website fallback'
        : 'Detecting provider capability';

  return `<section class="dashboard-section provider-runtime${brokerEnabled ? ' provider-runtime--broker' : ''}" aria-labelledby="officepro-heading" data-handoff-status="${runtime.handoff?.status ?? 'NOT_STARTED'}">
    <div class="provider-runtime__copy">
      <p class="section-eyebrow">${brokerEnabled ? 'Broker Mode · authorized continuity' : 'Brand Mode · deliberate provider'}</p>
      <h2 id="officepro-heading">${brokerEnabled ? 'Intent transferred to NEXUS' : 'Ask OfficePro to fulfill furniture'}</h2>
      <p>${brokerEnabled ? 'NEXUS is now authorized to continue only the remaining mission intent across independent providers.' : 'NEXUS requests only OfficePro’s exposed capabilities. Catalog, stock, pricing, packaging, and delivery rules stay on the independent provider origin.'}</p>
      <p class="provider-runtime__status" role="status" aria-live="polite" data-officepro-status data-phase="${runtime.phase}">
        <strong>${escapeHtml(transportLabel)}</strong>
        <span>${escapeHtml(runtime.message)}</span>
      </p>
      ${
        runtime.handoff
          ? renderIntentHandoff(runtime.handoff)
          : complete
          ? `<div class="continuation-panel">
              <p><strong>OfficePro completed what it could.</strong> 3 requirements remain: computers, internet, and security.</p>
              <button type="button" data-continue-nexus>Continue through NEXUS</button>
              <small>This prepares a minimized Intent Handoff. It does not grant authorization.</small>
            </div>`
          : `<button class="primary-action" type="button" data-ask-officepro${busy ? ' disabled aria-busy="true"' : ''}>${busy ? 'OfficePro is working…' : 'Ask OfficePro'}</button>`
      }
    </div>
    <div class="provider-runtime__origin">
      <div><span>Independent provider origin</span><code>${escapeHtml(runtime.providerOrigin)}</code></div>
      <iframe title="Independent OfficePro provider website" src="${escapeAttribute(runtime.providerOrigin)}" allow="tools"></iframe>
    </div>
  </section>`;
}

export function renderIntentHandoff(handoff: IntentHandoffLifecycle): string {
  const statusOrder = ['PROPOSED', 'AUTHORIZED', 'EXECUTED'] as const;
  const currentIndex = statusOrder.indexOf(handoff.status);
  const remaining = handoff.remainingRequirements
    .map((requirement) => `<li>${escapeHtml(REQUIREMENT_LABELS[requirement.type] ?? titleCase(requirement.type))}${requirement.quantity === undefined ? '' : ` · ${requirement.quantity}`}</li>`)
    .join('');

  return `<section class="handoff-panel handoff-panel--${handoff.status.toLowerCase()}" aria-labelledby="handoff-heading">
    <p class="handoff-panel__mode">Intent Handoff · ${escapeHtml(handoff.status)}</p>
    <h3 id="handoff-heading">${handoff.status === 'EXECUTED' ? 'NEXUS can continue the remaining goal' : 'Continue this goal through NEXUS?'}</h3>
    <ol class="handoff-lifecycle" aria-label="Intent Handoff lifecycle">
      ${statusOrder.map((status, index) => `<li class="${index <= currentIndex ? 'is-complete' : ''}" aria-current="${status === handoff.status ? 'step' : 'false'}"><span aria-hidden="true">${index <= currentIndex ? '✓' : index + 1}</span>${titleCase(status)}</li>`).join('')}
    </ol>
    ${
      handoff.status === 'PROPOSED'
        ? `<div class="handoff-summary">
            <div>
              <strong>OfficePro fulfilled</strong>
              <ul><li>Desks · 20</li><li>Chairs · 20</li></ul>
            </div>
            <div>
              <strong>3 requirements remain</strong>
              <ul>${remaining}</ul>
            </div>
          </div>
          <p>NEXUS is requesting permission to discover independent providers for these remaining requirements.</p>
          <div class="handoff-budget"><span>Remaining budget</span><strong>${formatMoney(handoff.constraints.remainingBudget)}</strong></div>
          <p class="handoff-assurance">Granting this permission does not make a purchase, reservation, signature, or other commitment.</p>
          <div class="handoff-actions">
            <button type="button" data-authorize-handoff>Authorize NEXUS to continue</button>
            <button type="button" class="secondary-action" data-stay-officepro>Stay with OfficePro</button>
          </div>`
        : handoff.status === 'AUTHORIZED'
          ? `<p class="handoff-decision" role="status" aria-live="polite"><strong>Human authorization recorded.</strong> NEXUS is executing the approved handoff. Broker routing remains locked until execution completes.</p>`
          : `<p class="handoff-decision handoff-decision--executed" role="status" aria-live="polite" data-broker-enabled="true"><strong>Intent transferred to NEXUS · Broker Mode enabled.</strong> NEXUS may now continue computers, internet, and security. No provider has been contacted yet.</p>`
    }
  </section>`;
}

export function renderMissionSummary(goalState: GoalState): string {
  const mode = deriveMissionMode(goalState);
  const complete = goalState.progress === 100;

  return `<header class="mission-hero${complete ? ' mission-hero--complete' : ''}">
    <div class="mission-hero__copy">
      <div class="mission-kicker">
        <span class="mission-signal" aria-hidden="true"></span>
        <span>Live mission</span>
        ${mode ? `<span class="mode-badge">${escapeHtml(mode)}</span>` : ''}
      </div>
      <h1 id="mission-title">${escapeHtml(goalState.goal)}</h1>
      <p class="mission-thesis">One human goal, coordinated visibly across independent providers.</p>
      <dl class="mission-facts" aria-label="Mission constraints">
        ${renderFact('Location', goalState.constraints.city)}
        ${renderFact('Team', `${goalState.constraints.employees} employees`)}
        ${renderFact('Deadline', formatDate(goalState.constraints.deadline))}
        ${renderFact('Budget', formatMoney(goalState.constraints.budget))}
      </dl>
    </div>
    ${renderMissionProgress(goalState)}
  </header>`;
}

export function renderMissionProgress(goalState: GoalState): string {
  const progress = Math.max(0, Math.min(100, goalState.progress));

  return `<section class="mission-progress" aria-labelledby="progress-heading">
    <h2 class="sr-only" id="progress-heading">Mission progress and budget</h2>
    <div class="progress-ring" style="--mission-progress: ${progress}" aria-hidden="true">
      <div class="progress-ring__center">
        <strong>${progress}%</strong>
        <span>complete</span>
      </div>
    </div>
    <progress class="sr-only" max="100" value="${progress}">${progress}% complete</progress>
    <div class="budget-summary">
      <div class="budget-summary__primary">
        <span>Budget used</span>
        <strong>${formatMoney(goalState.budgetUsed)}</strong>
        <small>of ${formatMoney(goalState.constraints.budget)}</small>
      </div>
      <div class="budget-summary__remaining">
        <span>Remaining</span>
        <strong>${formatMoney(goalState.budgetRemaining)}</strong>
      </div>
    </div>
  </section>`;
}

export function renderGoalGraph(goalState: GoalState): string {
  return `<section class="dashboard-section goal-graph" aria-labelledby="requirements-heading">
    <div class="section-heading">
      <div>
        <p class="section-eyebrow">Goal graph</p>
        <h2 id="requirements-heading">Mission requirements</h2>
      </div>
      <p>${goalState.requirements.filter((requirement) => requirement.status === 'FULFILLED').length} of ${goalState.requirements.length} fulfilled</p>
    </div>
    <div class="requirement-grid">
      ${goalState.requirements.map(renderRequirementCard).join('\n')}
    </div>
  </section>`;
}

export function renderRequirementCard(requirement: Requirement): string {
  const status = STATUS_PRESENTATION[requirement.status];
  const latestFailure = requirement.failureHistory?.at(-1);
  const provider = requirement.providerId ? providerLabel(requirement.providerId) : 'Unassigned';
  const quantity = requirement.quantity === undefined ? 'Service' : `Quantity ${requirement.quantity}`;

  return `<article class="requirement-card requirement-card--${status.className}" data-requirement-id="${escapeAttribute(requirement.id)}">
    <div class="requirement-card__topline">
      <span class="requirement-symbol" aria-hidden="true">${escapeHtml(REQUIREMENT_SYMBOLS[requirement.type] ?? 'REQ')}</span>
      ${renderRequirementStatus(requirement.status)}
    </div>
    <div class="requirement-card__title">
      <h3>${escapeHtml(REQUIREMENT_LABELS[requirement.type] ?? titleCase(requirement.type))}</h3>
      <span>${escapeHtml(quantity)}</span>
    </div>
    <dl class="requirement-meta">
      ${renderFact('Provider', provider)}
      ${renderFact('Cost', requirement.estimatedCost === undefined ? 'Not estimated' : formatMoney(requirement.estimatedCost))}
    </dl>
    ${renderBlocker(requirement)}
    ${renderApproval(requirement)}
    ${
      latestFailure && requirement.status !== 'BLOCKED'
        ? `<div class="route-recovery">
            <span class="route-recovery__label">Recovered route</span>
            <p><strong>${escapeHtml(providerLabel(latestFailure.providerId ?? 'provider'))}</strong> blocked <span aria-hidden="true">→</span><span class="sr-only">then rerouted to</span> <strong>${escapeHtml(provider)}</strong></p>
            <small>${escapeHtml(latestFailure.blocker.message)}</small>
          </div>`
        : ''
    }
  </article>`;
}

export function renderRequirementStatus(status: RequirementStatus): string {
  const presentation = STATUS_PRESENTATION[status];
  return `<span class="status-badge status-badge--${presentation.className}" data-status="${status}">
    <span class="status-badge__symbol" aria-hidden="true">${presentation.symbol}</span>
    <span>${presentation.label}</span>
  </span>`;
}

export function renderAgentActivityTimeline(goalState: GoalState): string {
  const events = [...goalState.activity].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id),
  );

  return `<section class="dashboard-section activity-panel" aria-labelledby="activity-heading">
    <div class="section-heading">
      <div>
        <p class="section-eyebrow">Agent activity</p>
        <h2 id="activity-heading">What NEXUS has been doing</h2>
      </div>
      <p>${events.length} auditable ${events.length === 1 ? 'event' : 'events'}</p>
    </div>
    <div class="activity-stream">
      ${
        events.length === 0
          ? `<div class="activity-empty">
              <span aria-hidden="true">◎</span>
              <p><strong>Ready to begin</strong>The mission is defined. Agent activity will appear here as providers are discovered and requirements move forward.</p>
            </div>`
          : `<ol>${events.map((event) => renderActivityEvent(event, goalState)).join('\n')}</ol>`
      }
    </div>
  </section>`;
}

function renderActivityEvent(event: ActivityEvent, goalState: GoalState): string {
  const isHandoff = 'handoffId' in event;
  const requirement =
    'requirementId' in event
      ? goalState.requirements.find((item) => item.id === event.requirementId)
      : undefined;
  const providerId = isHandoff
    ? event.sourceProviderId
    : event.providerId ?? readString(event.details, 'providerId');
  const actor = isHandoff && event.action === 'HANDOFF_AUTHORIZED'
    ? 'Human'
    : event.action === 'REQUIREMENT_REROUTED' || isHandoff
      ? 'NEXUS'
    : providerId
      ? providerLabel(providerId)
      : 'NEXUS';
  const outcome = isHandoff ? event.outcome : event.toStatus;
  const statusClass = activityStatusClass(outcome);
  const toolName = readString(event.details, 'toolName');
  const summary = readString(event.details, 'summary') ?? activitySummary(event, requirement);

  return `<li class="activity-event activity-event--${statusClass}" data-event-id="${escapeAttribute(event.id)}">
    <time datetime="${escapeAttribute(event.occurredAt)}">${escapeHtml(formatTime(event.occurredAt))}</time>
    <span class="activity-event__marker" aria-hidden="true"></span>
    <div class="activity-event__body">
      <div class="activity-event__meta">
        <strong>${escapeHtml(actor)}</strong>
        ${toolName ? `<code>${escapeHtml(toolName)}</code>` : `<span>${escapeHtml(activityActionLabel(event))}</span>`}
      </div>
      <p>${escapeHtml(summary)}</p>
    </div>
    <span class="activity-event__outcome">${escapeHtml(statusLabel(outcome))}</span>
  </li>`;
}

function renderBlocker(requirement: Requirement): string {
  if (!requirement.blocker) return '';

  return `<div class="blocker-panel">
    <div class="blocker-panel__heading">
      <span aria-hidden="true">!</span>
      <strong>Mission blocker</strong>
      <code>${escapeHtml(requirement.blocker.code)}</code>
    </div>
    <p>${escapeHtml(requirement.blocker.message)}</p>
  </div>`;
}

function renderApproval(requirement: Requirement): string {
  if (!requirement.approval?.required) return '';

  if (requirement.approval.approved) {
    return `<div class="approval-panel approval-panel--approved">
      <span aria-hidden="true">✓</span>
      <p><strong>Human approval granted</strong>Commitment authorized and recorded.</p>
    </div>`;
  }

  return `<div class="approval-panel approval-panel--pending">
    <span aria-hidden="true">◆</span>
    <p><strong>Human intervention required</strong>NEXUS is paused before commitment.</p>
  </div>`;
}

function renderFact(label: string, value: string): string {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function activitySummary(event: ActivityEvent, requirement: Requirement | undefined): string {
  if ('handoffId' in event) {
    const handoffCopy = {
      HANDOFF_PROPOSED: 'Intent Handoff prepared for the remaining mission requirements.',
      HANDOFF_AUTHORIZED: 'The human explicitly authorized NEXUS continuation.',
      HANDOFF_EXECUTED: 'Broker Mode started for the remaining requirements.',
    } as const;
    return handoffCopy[event.action];
  }

  const requirementName = requirement
    ? REQUIREMENT_LABELS[requirement.type] ?? titleCase(requirement.type)
    : titleCase(event.requirementId);

  if (event.action === 'REQUIREMENT_REROUTED') {
    return `${requirementName} rerouted to ${providerLabel(event.providerId ?? 'a new provider')}.`;
  }

  const transitionCopy: Readonly<Record<RequirementStatus, string>> = {
    PENDING: `${requirementName} is pending.`,
    DISCOVERED: `Provider discovery completed for ${requirementName}.`,
    MATCHED: `${requirementName} matched to ${providerLabel(event.providerId ?? 'a provider')}.`,
    PROPOSED: `A provider offer is ready for ${requirementName}.`,
    BLOCKED: `${requirementName} encountered a provider blocker.`,
    REQUIRES_HUMAN: `${requirementName} is paused for explicit human approval.`,
    FULFILLED: `${requirementName} fulfilled.`,
  };
  return transitionCopy[event.toStatus];
}

function activityActionLabel(event: ActivityEvent): string {
  if ('handoffId' in event) {
    return titleCase(event.action.replaceAll('_', ' '));
  }
  return event.action === 'REQUIREMENT_REROUTED'
    ? 'Requirement rerouted'
    : 'Goal State updated';
}

function activityStatusClass(outcome: string): string {
  if (outcome === 'BLOCKED') return 'blocked';
  if (outcome === 'REQUIRES_HUMAN') return 'requires-human';
  if (outcome === 'FULFILLED' || outcome === 'EXECUTED') return 'fulfilled';
  return 'active';
}

function statusLabel(status: string): string {
  if (status in STATUS_PRESENTATION) {
    return STATUS_PRESENTATION[status as RequirementStatus].label;
  }
  return titleCase(status.replaceAll('_', ' '));
}

function providerLabel(providerId: string): string {
  return PROVIDER_LABELS[providerId] ?? titleCase(providerId);
}

function readString(
  details: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | undefined {
  const value = details?.[key];
  return typeof value === 'string' ? value : undefined;
}

function formatMoney(value: number): string {
  return `MXN ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(new Date(value));
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('`', '&#96;');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const MISSION_DASHBOARD_STYLES = `
  :root {
    color-scheme: dark;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-synthesis: none;
    --canvas: #07101d;
    --surface: #0d1929;
    --surface-raised: #122137;
    --line: #263954;
    --text: #f4f7fb;
    --muted: #a8b6ca;
    --accent: #b8f24b;
    --accent-dark: #263c0e;
  }

  * { box-sizing: border-box; }
  html { background: var(--canvas); }
  body {
    margin: 0;
    color: var(--text);
    background:
      radial-gradient(circle at 90% -10%, rgba(52, 103, 164, .28), transparent 34rem),
      radial-gradient(circle at 0 35%, rgba(70, 118, 106, .14), transparent 30rem),
      var(--canvas);
    min-width: 20rem;
  }

  a { color: #cae8ff; }
  a:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; border-radius: .2rem; }
  .skip-link {
    position: fixed;
    z-index: 20;
    left: 1rem;
    top: -5rem;
    padding: .75rem 1rem;
    color: #07101d;
    background: var(--accent);
    font-weight: 800;
    text-decoration: none;
  }
  .skip-link:focus { top: 1rem; }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .site-header, .site-footer, main { width: min(100% - 2.5rem, 90rem); margin-inline: auto; }
  .site-header {
    min-height: 5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    border-bottom: 1px solid rgba(142, 167, 200, .18);
  }
  .brand { display: flex; align-items: center; gap: .8rem; font-weight: 900; letter-spacing: .14em; }
  .brand-mark {
    display: grid;
    place-items: center;
    width: 2.15rem;
    aspect-ratio: 1;
    border: 1px solid #5e7ca2;
    border-radius: .65rem;
    color: var(--accent);
    background: #101e31;
  }
  .site-header nav ul { display: flex; flex-wrap: wrap; gap: 1.25rem; margin: 0; padding: 0; list-style: none; }
  .site-header nav a { color: var(--muted); font-size: .82rem; font-weight: 700; text-decoration: none; }
  .site-header nav a:hover { color: var(--text); }
  main { padding-block: 2.25rem 4rem; }
  .site-footer { padding-block: 1.5rem 2.5rem; color: var(--muted); border-top: 1px solid rgba(142, 167, 200, .18); font-size: .85rem; }

  .mission-dashboard { display: grid; gap: 2.25rem; }
  .mission-hero {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(20rem, .65fr);
    gap: clamp(2rem, 5vw, 5rem);
    padding: clamp(2rem, 4vw, 4rem);
    border: 1px solid #2a4666;
    border-radius: 1.5rem;
    background:
      linear-gradient(120deg, rgba(22, 46, 73, .96), rgba(11, 25, 43, .98)),
      var(--surface);
    box-shadow: 0 2rem 5rem rgba(0, 0, 0, .24);
  }
  .mission-hero::after {
    content: '';
    position: absolute;
    width: 19rem;
    aspect-ratio: 1;
    right: -8rem;
    top: -9rem;
    border: 1px solid rgba(184, 242, 75, .28);
    border-radius: 50%;
    box-shadow: 0 0 0 3.5rem rgba(184, 242, 75, .025), 0 0 0 7rem rgba(184, 242, 75, .02);
    pointer-events: none;
  }
  .mission-hero--complete { border-color: #668c32; }
  .mission-hero__copy { position: relative; z-index: 1; }
  .mission-kicker, .section-eyebrow {
    display: flex;
    align-items: center;
    gap: .6rem;
    margin: 0 0 1rem;
    color: #bed0e8;
    font-size: .75rem;
    font-weight: 800;
    letter-spacing: .14em;
    text-transform: uppercase;
  }
  .mission-signal { width: .55rem; aspect-ratio: 1; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 .3rem rgba(184, 242, 75, .12); }
  .mode-badge { margin-left: .35rem; padding: .34rem .55rem; border: 1px solid #5d7390; border-radius: 999px; color: #eaf3ff; letter-spacing: .06em; background: rgba(8, 17, 30, .5); }
  .mission-hero h1 { max-width: 18ch; margin: 0; font-size: clamp(2.35rem, 5vw, 5rem); line-height: .98; letter-spacing: -.055em; text-wrap: balance; }
  .mission-thesis { max-width: 42rem; margin: 1.4rem 0 2rem; color: #c0ccdc; font-size: clamp(1rem, 1.8vw, 1.18rem); }
  .mission-facts, .requirement-meta { display: grid; margin: 0; }
  .mission-facts { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
  .mission-facts div { min-width: 0; padding-top: .85rem; border-top: 1px solid #34506f; }
  dt { color: var(--muted); font-size: .72rem; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
  dd { margin: .25rem 0 0; color: var(--text); font-weight: 750; }

  .mission-progress { position: relative; z-index: 1; display: grid; justify-items: center; align-content: center; gap: 1.4rem; }
  .progress-ring {
    --progress-color: var(--accent);
    display: grid;
    place-items: center;
    width: clamp(11rem, 17vw, 14rem);
    aspect-ratio: 1;
    padding: .72rem;
    border-radius: 50%;
    background: conic-gradient(var(--progress-color) calc(var(--mission-progress) * 1%), #263a52 0);
    box-shadow: 0 0 3rem rgba(184, 242, 75, .08);
  }
  .progress-ring__center { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 50%; background: #0b1828; }
  .progress-ring strong { font-size: clamp(2.5rem, 5vw, 4rem); line-height: 1; letter-spacing: -.06em; }
  .progress-ring span { margin-top: .35rem; color: var(--muted); font-size: .76rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
  .budget-summary { display: grid; grid-template-columns: 1fr 1fr; width: 100%; border: 1px solid #2a405b; border-radius: 1rem; background: rgba(7, 17, 30, .66); }
  .budget-summary > div { padding: 1rem; }
  .budget-summary > div + div { border-left: 1px solid #2a405b; }
  .budget-summary span, .budget-summary small { display: block; color: var(--muted); font-size: .7rem; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
  .budget-summary strong { display: block; margin-block: .28rem; font-size: 1.05rem; }

  .dashboard-section { padding: clamp(1.4rem, 3vw, 2.5rem); border: 1px solid var(--line); border-radius: 1.35rem; background: rgba(13, 25, 41, .86); }

  .provider-runtime { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(18rem, .85fr); gap: 2rem; align-items: stretch; border-color: #466737; background: linear-gradient(130deg, rgba(24, 46, 37, .9), rgba(13, 25, 41, .92)); }
  .provider-runtime--broker { border-color: #4b83b8; background: linear-gradient(130deg, rgba(21, 53, 78, .94), rgba(13, 25, 41, .92)); }
  .provider-runtime h2 { margin: 0; font-size: clamp(1.5rem, 3vw, 2.15rem); letter-spacing: -.035em; }
  .provider-runtime__copy > p:not(.section-eyebrow):not(.provider-runtime__status) { color: #c4d2ca; line-height: 1.55; }
  .provider-runtime__status { display: grid; gap: .22rem; margin: 1.25rem 0; padding: .9rem 1rem; border: 1px solid #4f6a5c; border-radius: .8rem; background: rgba(7, 20, 21, .58); }
  .provider-runtime__status strong { color: #d9ffbf; font-size: .76rem; letter-spacing: .06em; text-transform: uppercase; }
  .provider-runtime__status span { color: #c5d2cc; font-size: .88rem; line-height: 1.45; }
  .provider-runtime__status[data-phase="ERROR"] { border-color: #9d4b57; background: rgba(68, 20, 29, .6); }
  .provider-runtime__origin { overflow: hidden; display: grid; grid-template-rows: auto 1fr; min-height: 20rem; border: 1px solid #53675e; border-radius: 1rem; background: #f5f0e8; }
  .provider-runtime__origin > div { display: grid; gap: .25rem; padding: .75rem 1rem; color: #cad6d0; background: #13251f; }
  .provider-runtime__origin span { font-size: .66rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .provider-runtime__origin code { overflow-wrap: anywhere; color: #edffe3; font-size: .78rem; }
  .provider-runtime iframe { width: 100%; min-height: 16rem; border: 0; background: #f5f0e8; }
  .primary-action, .continuation-panel button, .handoff-actions button { padding: .85rem 1.1rem; border: 1px solid #c7fa6d; border-radius: .65rem; color: #0a1608; background: var(--accent); font: inherit; font-weight: 900; cursor: pointer; }
  .primary-action:focus-visible, .continuation-panel button:focus-visible, .handoff-actions button:focus-visible { outline: 3px solid #d7f5ff; outline-offset: 3px; }
  .primary-action:disabled { cursor: wait; opacity: .68; }
  .continuation-panel { margin-top: 1.1rem; padding: 1rem; border: 1px solid #72934c; border-radius: .8rem; background: rgba(28, 56, 26, .68); }
  .continuation-panel p { margin: 0 0 .8rem; line-height: 1.5; }
  .continuation-panel small { display: block; margin-top: .65rem; color: #b8c9b2; }
  .handoff-panel { margin-top: 1.1rem; padding: clamp(1rem, 2vw, 1.4rem); border: 1px solid #708aa6; border-radius: 1rem; background: rgba(9, 25, 41, .82); }
  .handoff-panel--executed { border-color: #73a9d5; background: rgba(13, 43, 67, .86); }
  .handoff-panel__mode { margin: 0 0 .35rem; color: #b9d9f3; font-size: .7rem; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
  .handoff-panel h3 { margin: 0; font-size: 1.35rem; letter-spacing: -.025em; }
  .handoff-lifecycle { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; margin: 1.1rem 0; padding: 0; list-style: none; }
  .handoff-lifecycle li { display: flex; align-items: center; gap: .4rem; min-width: 0; padding: .55rem; border: 1px solid #40566d; border-radius: .6rem; color: #9babbc; font-size: .72rem; font-weight: 800; text-transform: uppercase; }
  .handoff-lifecycle li span { display: grid; place-items: center; flex: 0 0 auto; width: 1.3rem; aspect-ratio: 1; border: 1px solid #586c81; border-radius: 50%; font-size: .67rem; }
  .handoff-lifecycle li.is-complete { border-color: #579070; color: #d8ffe5; background: rgba(25, 67, 46, .6); }
  .handoff-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
  .handoff-summary > div { padding: .8rem; border: 1px solid #3f5871; border-radius: .65rem; background: rgba(14, 36, 57, .7); }
  .handoff-summary strong { color: #e7f2ff; font-size: .82rem; }
  .handoff-summary ul { margin: .55rem 0 0; padding-left: 1.1rem; color: #c4d3e1; font-size: .8rem; line-height: 1.55; }
  .handoff-panel > p:not(.handoff-panel__mode) { color: #c5d2df; font-size: .86rem; line-height: 1.5; }
  .handoff-budget { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: .8rem 0; border-block: 1px solid #40576e; }
  .handoff-budget span { color: #a9bbcc; font-size: .72rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .handoff-budget strong { font-size: 1.15rem; }
  .handoff-assurance { padding: .75rem; border-left: .2rem solid #76a4c9; background: rgba(36, 67, 93, .45); }
  .handoff-actions { display: flex; flex-wrap: wrap; gap: .7rem; margin-top: 1rem; }
  .handoff-actions .secondary-action { border-color: #66809a; color: #e5edf5; background: #1a3044; }
  .handoff-decision { margin-bottom: 0; padding: 1rem; border: 1px solid #68819a; border-radius: .7rem; background: rgba(30, 55, 76, .65); }
  .handoff-decision strong { display: block; margin-bottom: .3rem; color: #f0f6fc; }
  .handoff-decision--executed { border-color: #5b9b77; background: rgba(26, 73, 50, .68); }
  .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 2rem; margin-bottom: 1.5rem; }
  .section-heading h2 { margin: 0; font-size: clamp(1.5rem, 3vw, 2.15rem); letter-spacing: -.035em; }
  .section-heading > p { margin: 0; color: var(--muted); font-size: .83rem; font-weight: 700; }
  .section-eyebrow { margin-bottom: .35rem; color: #90a5c0; }

  .requirement-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .85rem; }
  .requirement-card { position: relative; min-width: 0; padding: 1.15rem; border: 1px solid #2c4059; border-radius: 1.05rem; background: linear-gradient(160deg, rgba(23, 39, 61, .96), rgba(12, 24, 40, .98)); }
  .requirement-card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: .25rem; border-radius: 1.05rem 0 0 1.05rem; background: #61738b; }
  .requirement-card--blocked { grid-column: span 2; border-color: #8b4952; background: linear-gradient(150deg, rgba(74, 28, 38, .92), rgba(27, 20, 31, .98)); }
  .requirement-card--requires-human { grid-column: span 2; border-color: #9c6d2f; background: linear-gradient(150deg, rgba(71, 45, 20, .94), rgba(29, 24, 24, .98)); }
  .requirement-card--blocked::before { background: #ff6979; }
  .requirement-card--requires-human::before { background: #ffb34d; }
  .requirement-card--fulfilled::before { background: #7ee2a8; }
  .requirement-card--matched::before, .requirement-card--discovered::before { background: #78b9ff; }
  .requirement-card--proposed::before { background: #edcf72; }
  .requirement-card__topline { display: flex; align-items: center; justify-content: space-between; gap: .6rem; }
  .requirement-symbol { display: grid; place-items: center; min-width: 2rem; height: 2rem; padding-inline: .35rem; border: 1px solid #415a79; border-radius: .6rem; color: #c9d8eb; font-size: .68rem; font-weight: 900; letter-spacing: .04em; }
  .status-badge { display: inline-flex; align-items: center; gap: .35rem; min-height: 1.8rem; padding: .28rem .5rem; border: 1px solid #54667d; border-radius: 999px; color: #d9e2ee; background: #1b2b3e; font-size: .68rem; font-weight: 850; line-height: 1; white-space: nowrap; }
  .status-badge__symbol { font-size: .9rem; }
  .status-badge--blocked { border-color: #a7515d; color: #ffd5d9; background: #4d2028; }
  .status-badge--requires-human { border-color: #aa732f; color: #ffe1b5; background: #4d341b; }
  .status-badge--fulfilled { border-color: #41795a; color: #d4ffe5; background: #193c2a; }
  .status-badge--discovered, .status-badge--matched { border-color: #3f6f9e; color: #d8ebff; background: #183854; }
  .status-badge--proposed { border-color: #826f35; color: #fff0bd; background: #40391f; }
  .requirement-card__title { margin-block: 1.15rem; }
  .requirement-card__title h3 { margin: 0 0 .25rem; font-size: 1.25rem; letter-spacing: -.025em; }
  .requirement-card__title > span { color: var(--muted); font-size: .78rem; }
  .requirement-meta { gap: .72rem; }
  .requirement-meta div { display: flex; justify-content: space-between; gap: .75rem; padding-top: .65rem; border-top: 1px solid rgba(83, 107, 138, .35); }
  .requirement-meta dd { margin: 0; font-size: .78rem; text-align: right; overflow-wrap: anywhere; }
  .blocker-panel, .approval-panel, .route-recovery { margin-top: 1rem; padding: .9rem; border-radius: .75rem; }
  .blocker-panel { border: 1px solid #9d4b57; background: rgba(68, 20, 29, .76); }
  .blocker-panel__heading { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem; }
  .blocker-panel__heading > span { display: grid; place-items: center; width: 1.45rem; aspect-ratio: 1; border-radius: 50%; color: #2b080e; background: #ff7d89; font-weight: 950; }
  .blocker-panel code { color: #ffc2c8; font-size: .7rem; }
  .blocker-panel p, .route-recovery p, .approval-panel p { margin: .6rem 0 0; font-size: .82rem; line-height: 1.45; }
  .approval-panel { display: flex; align-items: flex-start; gap: .7rem; }
  .approval-panel > span { font-size: 1.1rem; }
  .approval-panel p { margin: 0; }
  .approval-panel strong { display: block; margin-bottom: .2rem; }
  .approval-panel--pending { border: 1px solid #9f6b2d; color: #ffe8c8; background: rgba(77, 48, 16, .72); }
  .approval-panel--approved { border: 1px solid #467a59; color: #d8ffe6; background: rgba(19, 58, 38, .72); }
  .route-recovery { border: 1px dashed #51749c; background: rgba(24, 50, 75, .65); }
  .route-recovery__label { color: #9fcaff; font-size: .66rem; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
  .route-recovery small { display: block; color: var(--muted); line-height: 1.4; }

  .activity-panel { overflow: hidden; }
  .activity-stream ol { margin: 0; padding: 0; list-style: none; }
  .activity-event { display: grid; grid-template-columns: 3.3rem 1rem minmax(0, 1fr) auto; gap: .9rem; min-height: 4.25rem; position: relative; }
  .activity-event time { padding-top: .15rem; color: #91a6c0; font-size: .72rem; font-variant-numeric: tabular-nums; }
  .activity-event__marker { position: relative; z-index: 1; width: .75rem; height: .75rem; margin-top: .2rem; border: 2px solid #85bdf6; border-radius: 50%; background: #15395a; box-shadow: 0 0 0 .28rem #0d1929; }
  .activity-event:not(:last-child) .activity-event__marker::after { content: ''; position: absolute; width: 1px; height: 3.45rem; top: .75rem; left: calc(50% - .5px); background: #314963; }
  .activity-event--blocked .activity-event__marker { border-color: #ff8b96; background: #7e2b36; }
  .activity-event--requires-human .activity-event__marker { border-color: #ffc166; background: #754817; }
  .activity-event--fulfilled .activity-event__marker { border-color: #8ce5af; background: #236541; }
  .activity-event__body { min-width: 0; padding-bottom: 1.25rem; }
  .activity-event__meta { display: flex; align-items: center; flex-wrap: wrap; gap: .65rem; }
  .activity-event__meta strong { font-size: .82rem; }
  .activity-event__meta span, .activity-event code { color: #98abc3; font-size: .72rem; }
  .activity-event code { padding: .18rem .35rem; border: 1px solid #314d6d; border-radius: .3rem; background: #10243a; }
  .activity-event__body p { margin: .28rem 0 0; color: #c6d1df; font-size: .85rem; line-height: 1.45; }
  .activity-event__outcome { align-self: start; padding: .25rem .45rem; border: 1px solid #415873; border-radius: 999px; color: #b9c8d9; font-size: .65rem; font-weight: 800; text-transform: uppercase; }
  .activity-empty { display: flex; align-items: center; gap: 1rem; min-height: 8rem; padding: 1.5rem; border: 1px dashed #38516d; border-radius: 1rem; color: var(--muted); }
  .activity-empty > span { display: grid; place-items: center; width: 3rem; aspect-ratio: 1; border: 1px solid #4b6684; border-radius: 50%; font-size: 1.3rem; }
  .activity-empty p { margin: 0; max-width: 42rem; }
  .activity-empty strong { display: block; margin-bottom: .2rem; color: var(--text); }

  @media (max-width: 74rem) {
    .mission-hero { grid-template-columns: 1fr minmax(18rem, .55fr); }
    .mission-facts { grid-template-columns: repeat(2, 1fr); }
    .requirement-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }

  @media (max-width: 52rem) {
    .site-header { align-items: flex-start; flex-direction: column; padding-block: 1.15rem; }
    .mission-hero { grid-template-columns: 1fr; }
    .mission-progress { grid-template-columns: auto minmax(15rem, 1fr); }
    .budget-summary { align-self: stretch; }
    .requirement-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .provider-runtime { grid-template-columns: 1fr; }
    .requirement-card--blocked, .requirement-card--requires-human { grid-column: span 2; }
  }

  @media (max-width: 38rem) {
    .site-header, .site-footer, main { width: min(100% - 1.25rem, 90rem); }
    .site-header nav ul { gap: .8rem; }
    main { padding-top: 1rem; }
    .mission-hero, .dashboard-section { border-radius: 1rem; }
    .mission-progress { grid-template-columns: 1fr; }
    .mission-facts, .requirement-grid { grid-template-columns: 1fr; }
    .handoff-summary, .handoff-lifecycle { grid-template-columns: 1fr; }
    .requirement-card--blocked, .requirement-card--requires-human { grid-column: span 1; }
    .section-heading { align-items: flex-start; flex-direction: column; gap: .5rem; }
    .activity-event { grid-template-columns: 2.8rem .8rem minmax(0, 1fr); gap: .65rem; }
    .activity-event__outcome { grid-column: 3; justify-self: start; margin: -.8rem 0 1rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
  }
`;

export function assertCanonicalStatusPresentation(): void {
  for (const status of REQUIREMENT_STATUSES) {
    if (!STATUS_PRESENTATION[status]) {
      throw new TypeError(`Missing dashboard presentation for ${status}.`);
    }
  }
}
