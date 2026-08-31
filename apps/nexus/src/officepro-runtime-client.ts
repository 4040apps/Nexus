import { canBeginBrokerRouting } from '@nexus/intent-handoff';
import type { IntentHandoffLifecycle } from '@nexus/intent-handoff';

import {
  renderAgentActivityTimeline,
  renderGoalGraph,
  renderMissionDashboard,
  renderMissionSummary,
} from './dashboard.js';
import { createInitialHeroGoalState } from './dashboard-fixtures.js';
import {
  OFFICEPRO_BRAND_TOOL_NAMES,
  OfficeProBrandModeError,
  runOfficeProBrandMode,
} from './officepro-brand-mode.js';
import { createCrossOriginProviderInvoker } from './cross-origin-provider-client.js';
import {
  authorizeOfficeProIntentHandoff,
  executeOfficeProIntentHandoff,
  proposeOfficeProIntentHandoff,
} from './officepro-intent-handoff.js';
import {
  FIBERMX_PROVIDER_ORIGIN,
  INTERNET_BROKER_TOOL_NAMES,
  InternetBrokerModeError,
  NETBUSINESS_PROVIDER_ORIGIN,
  runFiberMxInternetRoute,
  runNetBusinessInternetRecovery,
} from './internet-broker-mode.js';
import type { InternetRuntimeView } from './dashboard.js';
import type { SecurityRuntimeView } from './dashboard.js';
import {
  SECURENOW_COMMIT_TOOL_NAME,
  SECURENOW_PLANNING_TOOL_NAMES,
  SECURENOW_PROVIDER_ORIGIN,
  SecureNowBrokerModeError,
  declineSecureNowApproval,
  executeSecureNowInstallation,
  recordSecureNowApproval,
  runSecureNowPlanning,
} from './securenow-broker-mode.js';
import type { SecureNowProposal } from './securenow-broker-mode.js';
import {
  TECHSUPPLY_BROKER_TOOL_NAMES,
  TECHSUPPLY_PROVIDER_ORIGIN,
  TechSupplyBrokerModeError,
  runTechSupplyBrokerMode,
} from './techsupply-broker-mode.js';
import { ExclusiveActionRunner } from './exclusive-action.js';

const PROVIDER_ORIGIN = 'http://localhost:4500';
const INITIAL_PROVIDER_MESSAGE = 'Waiting for the independent OfficePro origin to report its WebMCP capability.';
const main = document.querySelector<HTMLElement>('#main-content');
let goalState = createInitialHeroGoalState();
let handoff: IntentHandoffLifecycle | undefined;
let providerTransport: 'WEBMCP' | 'WEBSITE_FALLBACK' | undefined;
let providerMessage = INITIAL_PROVIDER_MESSAGE;
let techSupplyProviderReady = false;
let fiberMxProviderReady = false;
let netBusinessProviderReady = false;
let secureNowProviderReady = false;
let techSupplyView:
  | {
      providerOrigin: string;
      phase: 'READY' | 'RUNNING' | 'COMPLETE' | 'ERROR';
      message: string;
      transport?: 'WEBMCP' | 'WEBSITE_FALLBACK';
    }
  | undefined;
let internetView: InternetRuntimeView | undefined;
let securityView: SecurityRuntimeView | undefined;
let secureNowProposal: SecureNowProposal | undefined;
type DemoAction =
  | 'OFFICEPRO'
  | 'PROPOSE_HANDOFF'
  | 'AUTHORIZE_HANDOFF'
  | 'STAY_OFFICEPRO'
  | 'TECHSUPPLY'
  | 'FIBERMX'
  | 'NETBUSINESS'
  | 'SECURENOW_PLAN'
  | 'SECURENOW_APPROVE'
  | 'SECURENOW_DECLINE'
  | 'SECURENOW_RETRY'
  | 'RESET';
const actionRunner = new ExclusiveActionRunner<DemoAction>(syncBusyControls);

bindControls();
window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (isTechSupplyReadyEvent(event)) {
    techSupplyProviderReady = true;
  }
  if (isInternetProviderReadyEvent(event, FIBERMX_PROVIDER_ORIGIN, 'FIBERMX_PROVIDER_READY')) {
    fiberMxProviderReady = true;
  }
  if (isInternetProviderReadyEvent(event, NETBUSINESS_PROVIDER_ORIGIN, 'NETBUSINESS_PROVIDER_READY')) {
    netBusinessProviderReady = true;
  }
  if (isInternetProviderReadyEvent(event, SECURENOW_PROVIDER_ORIGIN, 'SECURENOW_PROVIDER_READY')) {
    secureNowProviderReady = true;
  }
});

function bindControls(): void {
  document.querySelector<HTMLButtonElement>('[data-ask-officepro]')?.addEventListener('click', () => {
    void runExclusive('OFFICEPRO', runFlow);
  });
  document.querySelector<HTMLButtonElement>('[data-continue-nexus]')?.addEventListener('click', () => {
    void runExclusive('PROPOSE_HANDOFF', proposeHandoff);
  });
  document.querySelector<HTMLButtonElement>('[data-authorize-handoff]')?.addEventListener('click', () => {
    void runExclusive('AUTHORIZE_HANDOFF', authorizeAndExecuteHandoff);
  });
  document.querySelector<HTMLButtonElement>('[data-stay-officepro]')?.addEventListener('click', () => {
    void runExclusive('STAY_OFFICEPRO', stayWithOfficePro);
  });
  document.querySelector<HTMLButtonElement>('[data-route-computers]')?.addEventListener('click', () => {
    void runExclusive('TECHSUPPLY', runTechSupplyFlow);
  });
  document.querySelector<HTMLButtonElement>('[data-route-internet]')?.addEventListener('click', () => {
    void runExclusive('FIBERMX', runFiberMxFlow);
  });
  document.querySelector<HTMLButtonElement>('[data-recover-internet]')?.addEventListener('click', () => {
    void runExclusive('NETBUSINESS', runNetBusinessRecovery);
  });
  document.querySelector<HTMLButtonElement>('[data-route-security]')?.addEventListener('click', () => {
    void runExclusive('SECURENOW_PLAN', runSecureNowPlan);
  });
  document.querySelector<HTMLButtonElement>('[data-approve-security]')?.addEventListener('click', () => {
    void runExclusive('SECURENOW_APPROVE', approveAndCommitSecurity);
  });
  document.querySelector<HTMLButtonElement>('[data-decline-security]')?.addEventListener('click', () => {
    void runExclusive('SECURENOW_DECLINE', declineSecurity);
  });
  document.querySelector<HTMLButtonElement>('[data-retry-security-commit]')?.addEventListener('click', () => {
    void runExclusive('SECURENOW_RETRY', commitApprovedSecurity);
  });
  document.querySelector<HTMLButtonElement>('[data-reset-mission]')?.addEventListener('click', () => {
    void runExclusive('RESET', resetMission);
  });
  syncBusyControls();
}

async function runExclusive(action: DemoAction, operation: () => void | Promise<void>): Promise<void> {
  await actionRunner.run(action, operation);
}

function syncBusyControls(): void {
  const selectors = [
    '[data-ask-officepro]', '[data-continue-nexus]', '[data-authorize-handoff]',
    '[data-stay-officepro]', '[data-route-computers]', '[data-route-internet]',
    '[data-recover-internet]', '[data-route-security]', '[data-approve-security]',
    '[data-decline-security]', '[data-retry-security-commit]', '[data-reset-mission]',
  ].join(',');
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>(selectors))) {
    button.disabled = actionRunner.active !== undefined;
    if (actionRunner.active !== undefined) button.setAttribute('aria-disabled', 'true');
    else button.removeAttribute('aria-disabled');
  }
  const reset = document.querySelector<HTMLButtonElement>('[data-reset-mission]');
  if (reset && actionRunner.active === 'RESET') reset.setAttribute('aria-busy', 'true');
  else reset?.removeAttribute('aria-busy');
}

async function resetMission(): Promise<void> {
  goalState = createInitialHeroGoalState();
  handoff = undefined;
  providerTransport = undefined;
  providerMessage = INITIAL_PROVIDER_MESSAGE;
  techSupplyProviderReady = false;
  fiberMxProviderReady = false;
  netBusinessProviderReady = false;
  secureNowProviderReady = false;
  techSupplyView = undefined;
  internetView = undefined;
  securityView = undefined;
  secureNowProposal = undefined;
  render({ phase: 'READY', message: providerMessage });
  const status = document.querySelector<HTMLElement>('[data-reset-status]');
  if (status) status.textContent = 'Mission reset. Brand Mode restored at 0% with all requirements pending.';
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  document.querySelector<HTMLButtonElement>('[data-reset-mission]')?.focus();
}

async function runFlow(): Promise<void> {
  setWorkingStatus('Connecting to the independent OfficePro origin…');

  try {
    const { invoker, transport } = await createInvoker();
    setWorkingStatus(
      transport === 'WEBMCP'
        ? 'WebMCP tools discovered. OfficePro is executing provider-owned logic.'
        : 'document.modelContext is unavailable or its tools were not exposed. Running OfficePro’s visibly labeled normal website flow; no WebMCP success is claimed.',
    );
    const result = await runOfficeProBrandMode(goalState, invoker, {
      onGoalStateChange(nextGoalState) {
        goalState = nextGoalState;
        renderLiveGoalState();
      },
    });
    goalState = result.goalState;
    providerTransport = transport;
    providerMessage =
      transport === 'WEBMCP'
        ? 'All four genuine WebMCP invocations completed on the OfficePro origin.'
        : 'OfficePro’s provider-owned website flow completed because WebMCP was unavailable.';
    render({
      phase: 'COMPLETE',
      transport: providerTransport,
      message: providerMessage,
    });
  } catch (error) {
    const message =
      error instanceof OfficeProBrandModeError || error instanceof Error
        ? error.message
        : 'OfficePro Brand Mode could not complete.';
    render({ phase: 'ERROR', message });
  }
}

function proposeHandoff(): void {
  try {
    const proposed = proposeOfficeProIntentHandoff(goalState);
    goalState = proposed.goalState;
    handoff = proposed.handoff;
    renderCurrent();
  } catch (error) {
    renderLifecycleError(error);
  }
}

async function authorizeAndExecuteHandoff(): Promise<void> {
  if (!handoff || handoff.status !== 'PROPOSED') return;

  try {
    const authorized = authorizeOfficeProIntentHandoff(goalState, handoff);
    goalState = authorized.goalState;
    handoff = authorized.handoff;
    renderCurrent();

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    const executed = executeOfficeProIntentHandoff(goalState, authorized.handoff);
    if (!canBeginBrokerRouting(executed.handoff)) {
      throw new Error('Broker Mode cannot start until the authorized handoff is executed.');
    }
    goalState = executed.goalState;
    handoff = executed.handoff;
    techSupplyView = {
      providerOrigin: TECHSUPPLY_PROVIDER_ORIGIN,
      phase: 'READY',
      message: 'Broker Mode is authorized. TechSupply has not been contacted yet.',
    };
    renderCurrent();
  } catch (error) {
    renderLifecycleError(error);
  }
}

async function runFiberMxFlow(): Promise<void> {
  if (!handoff || handoff.status !== 'EXECUTED' || !canBeginBrokerRouting(handoff)) return;
  fiberMxProviderReady = false;
  internetView = {
    fiberMxOrigin: FIBERMX_PROVIDER_ORIGIN,
    netBusinessOrigin: NETBUSINESS_PROVIDER_ORIGIN,
    phase: 'FIBER_RUNNING',
    message: 'Discovering FiberMX and invoking its provider-owned coverage, installation, and offer tools.',
  };
  renderCurrent();
  try {
    await waitForInternetProvider('fibermx');
    const frame = document.querySelector<HTMLIFrameElement>(`iframe[src="${FIBERMX_PROVIDER_ORIGIN}"]`);
    const { invoker, transport } = await createCrossOriginProviderInvoker({
      providerOrigin: FIBERMX_PROVIDER_ORIGIN,
      toolNames: INTERNET_BROKER_TOOL_NAMES,
      frame,
      requestType: 'NEXUS_FIBERMX_TOOL_REQUEST',
      responseType: 'FIBERMX_TOOL_RESULT',
      requestIdPrefix: 'fibermx-request',
      timeoutLabel: 'FiberMX',
    });
    const result = await runFiberMxInternetRoute(goalState, handoff, invoker);
    goalState = result.goalState;
    internetView = {
      fiberMxOrigin: FIBERMX_PROVIDER_ORIGIN,
      netBusinessOrigin: NETBUSINESS_PROVIDER_ORIGIN,
      phase: 'BLOCKED',
      message: result.blocker.message,
      fiberMxTransport: transport,
    };
    renderCurrent();
  } catch (error) {
    renderInternetError(error);
  }
}

async function runNetBusinessRecovery(): Promise<void> {
  if (!handoff || handoff.status !== 'EXECUTED' || !canBeginBrokerRouting(handoff)) return;
  const fiberMxTransport = internetView?.fiberMxTransport;
  netBusinessProviderReady = false;
  internetView = {
    fiberMxOrigin: FIBERMX_PROVIDER_ORIGIN,
    netBusinessOrigin: NETBUSINESS_PROVIDER_ORIGIN,
    phase: 'NETBUSINESS_RUNNING',
    message: 'Preserving the FiberMX failure while discovering a different provider for only internet.',
    ...(fiberMxTransport ? { fiberMxTransport } : {}),
  };
  renderCurrent();
  try {
    await waitForInternetProvider('netbusiness');
    const frame = document.querySelector<HTMLIFrameElement>(`iframe[src="${NETBUSINESS_PROVIDER_ORIGIN}"]`);
    const { invoker, transport } = await createCrossOriginProviderInvoker({
      providerOrigin: NETBUSINESS_PROVIDER_ORIGIN,
      toolNames: INTERNET_BROKER_TOOL_NAMES,
      frame,
      requestType: 'NEXUS_NETBUSINESS_TOOL_REQUEST',
      responseType: 'NETBUSINESS_TOOL_RESULT',
      requestIdPrefix: 'netbusiness-request',
      timeoutLabel: 'NetBusiness',
    });
    const result = await runNetBusinessInternetRecovery(goalState, handoff, invoker);
    goalState = result.goalState;
    internetView = {
      fiberMxOrigin: FIBERMX_PROVIDER_ORIGIN,
      netBusinessOrigin: NETBUSINESS_PROVIDER_ORIGIN,
      phase: 'COMPLETE',
      message: 'NetBusiness installed before the deadline; FiberMX remains in failure history.',
      ...(fiberMxTransport ? { fiberMxTransport } : {}),
      netBusinessTransport: transport,
    };
    securityView = {
      providerOrigin: SECURENOW_PROVIDER_ORIGIN,
      phase: 'READY',
      message: 'Internet is complete. SecureNow has not been contacted yet.',
    };
    renderCurrent();
  } catch (error) {
    renderInternetError(error);
  }
}

async function runSecureNowPlan(): Promise<void> {
  if (!handoff || handoff.status !== 'EXECUTED' || !canBeginBrokerRouting(handoff)) return;
  secureNowProviderReady = false;
  securityView = {
    providerOrigin: SECURENOW_PROVIDER_ORIGIN,
    phase: 'PLANNING',
    message: 'Invoking only SecureNow assessment and planning tools. No commitment is authorized.',
  };
  renderCurrent();
  try {
    await waitForSecureNowProvider();
    const { invoker, transport } = await createSecureNowInvoker(SECURENOW_PLANNING_TOOL_NAMES);
    const result = await runSecureNowPlanning(goalState, handoff, invoker);
    goalState = result.goalState;
    secureNowProposal = result.proposal;
    securityView = {
      providerOrigin: SECURENOW_PROVIDER_ORIGIN,
      phase: 'REQUIRES_HUMAN',
      transport,
      message: 'SecureNow planning is complete. request_installation has not been invoked.',
    };
    renderCurrent();
  } catch (error) {
    renderSecurityError(error, false);
  }
}

async function approveAndCommitSecurity(): Promise<void> {
  if (!secureNowProposal) return;
  try {
    goalState = recordSecureNowApproval(goalState, secureNowProposal);
    await commitApprovedSecurity();
  } catch (error) {
    renderSecurityError(error, goalState.requirements.find(({ id }) => id === 'security')?.approval?.approved === true);
  }
}

async function commitApprovedSecurity(): Promise<void> {
  if (!secureNowProposal) return;
  const transport = securityView?.transport;
  secureNowProviderReady = false;
  securityView = {
    providerOrigin: SECURENOW_PROVIDER_ORIGIN,
    phase: 'COMMITTING',
    message: 'Human approval is recorded. SecureNow may now execute request_installation.',
    approvalRecorded: true,
    ...(transport ? { transport } : {}),
  };
  renderCurrent();
  try {
    await waitForSecureNowProvider();
    const commitInvoker = await createSecureNowInvoker([SECURENOW_COMMIT_TOOL_NAME]);
    const result = await executeSecureNowInstallation(goalState, secureNowProposal, commitInvoker.invoker);
    goalState = result.goalState;
    securityView = {
      providerOrigin: SECURENOW_PROVIDER_ORIGIN,
      phase: 'COMPLETE',
      message: 'SecureNow executed the human-approved installation request on its independent origin.',
      approvalRecorded: true,
      transport: commitInvoker.transport,
    };
    renderCurrent();
  } catch (error) {
    renderSecurityError(error, true);
  }
}

function declineSecurity(): void {
  if (!secureNowProposal) return;
  declineSecureNowApproval(goalState, secureNowProposal);
  const approvalPanel = document.querySelector<HTMLElement>('.commitment-approval');
  if (approvalPanel) {
    approvalPanel.setAttribute('role', 'status');
    const notice = document.createElement('p');
    notice.className = 'handoff-assurance';
    notice.textContent = 'Not approved. SecureNow installation remains uncommitted; you may approve later.';
    approvalPanel.append(notice);
  }
}

function renderSecurityError(error: unknown, approvalRecorded: boolean): void {
  securityView = {
    providerOrigin: SECURENOW_PROVIDER_ORIGIN,
    phase: 'ERROR',
    message: error instanceof SecureNowBrokerModeError || error instanceof Error
      ? error.message
      : 'SecureNow could not complete safely.',
    approvalRecorded,
    ...(securityView?.transport ? { transport: securityView.transport } : {}),
  };
  renderCurrent();
}

function waitForSecureNowProvider(): Promise<void> {
  if (secureNowProviderReady) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onReady);
      reject(new Error('The independent SecureNow provider did not become ready.'));
    }, 5_000);
    const onReady = (event: MessageEvent<unknown>): void => {
      if (!isInternetProviderReadyEvent(event, SECURENOW_PROVIDER_ORIGIN, 'SECURENOW_PROVIDER_READY')) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onReady);
      secureNowProviderReady = true;
      resolve();
    };
    window.addEventListener('message', onReady);
  });
}

async function createSecureNowInvoker(toolNames: readonly string[]) {
  const frame = document.querySelector<HTMLIFrameElement>(`iframe[src="${SECURENOW_PROVIDER_ORIGIN}"]`);
  return createCrossOriginProviderInvoker({
    providerOrigin: SECURENOW_PROVIDER_ORIGIN,
    toolNames,
    frame,
    requestType: 'NEXUS_SECURENOW_TOOL_REQUEST',
    responseType: 'SECURENOW_TOOL_RESULT',
    requestIdPrefix: 'securenow-request',
    timeoutLabel: 'SecureNow',
  });
}

function renderInternetError(error: unknown): void {
  const previous = internetView;
  internetView = {
    fiberMxOrigin: FIBERMX_PROVIDER_ORIGIN,
    netBusinessOrigin: NETBUSINESS_PROVIDER_ORIGIN,
    phase: 'ERROR',
    message: error instanceof InternetBrokerModeError || error instanceof Error
      ? error.message
      : 'Internet Broker Mode could not complete.',
    retryTarget: previous?.phase === 'NETBUSINESS_RUNNING' ? 'NETBUSINESS' : 'FIBER',
    ...(previous?.fiberMxTransport ? { fiberMxTransport: previous.fiberMxTransport } : {}),
    ...(previous?.netBusinessTransport ? { netBusinessTransport: previous.netBusinessTransport } : {}),
  };
  renderCurrent();
}

function waitForInternetProvider(provider: 'fibermx' | 'netbusiness'): Promise<void> {
  const ready = provider === 'fibermx' ? fiberMxProviderReady : netBusinessProviderReady;
  if (ready) return Promise.resolve();
  const origin = provider === 'fibermx' ? FIBERMX_PROVIDER_ORIGIN : NETBUSINESS_PROVIDER_ORIGIN;
  const type = provider === 'fibermx' ? 'FIBERMX_PROVIDER_READY' : 'NETBUSINESS_PROVIDER_READY';
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onReady);
      reject(new Error(`The independent ${provider === 'fibermx' ? 'FiberMX' : 'NetBusiness'} provider did not become ready.`));
    }, 5_000);
    const onReady = (event: MessageEvent<unknown>): void => {
      if (!isInternetProviderReadyEvent(event, origin, type)) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onReady);
      if (provider === 'fibermx') fiberMxProviderReady = true;
      else netBusinessProviderReady = true;
      resolve();
    };
    window.addEventListener('message', onReady);
  });
}

function isInternetProviderReadyEvent(
  event: MessageEvent<unknown>,
  origin: string,
  type: string,
): boolean {
  const frame = document.querySelector<HTMLIFrameElement>(`iframe[src="${origin}"]`);
  return event.origin === origin && event.source === frame?.contentWindow && isMessageType(event.data, type);
}

function isMessageType(value: unknown, type: string): boolean {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === type;
}

async function runTechSupplyFlow(): Promise<void> {
  if (!handoff || handoff.status !== 'EXECUTED' || !canBeginBrokerRouting(handoff)) return;
  setTechSupplyWorkingStatus();

  try {
    await waitForTechSupplyProvider();
    const frame = document.querySelector<HTMLIFrameElement>(
      `iframe[src="${TECHSUPPLY_PROVIDER_ORIGIN}"]`,
    );
    const { invoker, transport } = await createCrossOriginProviderInvoker({
      providerOrigin: TECHSUPPLY_PROVIDER_ORIGIN,
      toolNames: TECHSUPPLY_BROKER_TOOL_NAMES,
      frame,
      requestType: 'NEXUS_TECHSUPPLY_TOOL_REQUEST',
      responseType: 'TECHSUPPLY_TOOL_RESULT',
      requestIdPrefix: 'techsupply-request',
      timeoutLabel: 'TechSupply',
    });
    const result = await runTechSupplyBrokerMode(
      goalState,
      handoff,
      invoker,
    );
    goalState = result.goalState;
    techSupplyView = {
      providerOrigin: TECHSUPPLY_PROVIDER_ORIGIN,
      phase: 'COMPLETE',
      transport,
      message:
        transport === 'WEBMCP'
          ? 'Three genuine TechSupply WebMCP tools completed on the independent provider origin.'
          : 'TechSupply’s provider-owned website flow completed because WebMCP was unavailable.',
    };
    internetView = {
      fiberMxOrigin: FIBERMX_PROVIDER_ORIGIN,
      netBusinessOrigin: NETBUSINESS_PROVIDER_ORIGIN,
      phase: 'READY',
      message: 'Computers are complete. No internet provider has been contacted yet.',
    };
    renderCurrent();
  } catch (error) {
    techSupplyView = {
      providerOrigin: TECHSUPPLY_PROVIDER_ORIGIN,
      phase: 'ERROR',
      message:
        error instanceof TechSupplyBrokerModeError || error instanceof Error
          ? error.message
          : 'TechSupply Broker Mode could not complete.',
    };
    renderCurrent();
  }
}

function waitForTechSupplyProvider(): Promise<void> {
  if (techSupplyProviderReady) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onReady);
      reject(new Error('The independent TechSupply provider did not become ready.'));
    }, 5_000);
    const onReady = (event: MessageEvent<unknown>): void => {
      if (!isTechSupplyReadyEvent(event)) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onReady);
      techSupplyProviderReady = true;
      resolve();
    };
    window.addEventListener('message', onReady);
  });
}

function isProviderReady(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'TECHSUPPLY_PROVIDER_READY'
  );
}

function isTechSupplyReadyEvent(event: MessageEvent<unknown>): boolean {
  const frame = document.querySelector<HTMLIFrameElement>(
    `iframe[src="${TECHSUPPLY_PROVIDER_ORIGIN}"]`,
  );
  return (
    event.origin === TECHSUPPLY_PROVIDER_ORIGIN &&
    event.source === frame?.contentWindow &&
    isProviderReady(event.data)
  );
}

function stayWithOfficePro(): void {
  const decision = document.querySelector<HTMLElement>('.handoff-assurance');
  if (decision) {
    decision.setAttribute('role', 'status');
    decision.setAttribute('aria-live', 'polite');
    decision.innerHTML =
      '<strong>Staying with OfficePro.</strong> No authorization was granted. Brand Mode remains active and no provider was contacted.';
  }
}

function renderCurrent(): void {
  render({
    phase: 'COMPLETE',
    message: providerMessage,
    ...(providerTransport ? { transport: providerTransport } : {}),
  });
}

function renderLifecycleError(error: unknown): void {
  render({
    phase: 'ERROR',
    message: error instanceof Error ? error.message : 'Intent Handoff could not complete.',
    ...(providerTransport ? { transport: providerTransport } : {}),
  });
}

function setTechSupplyWorkingStatus(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-route-computers]');
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'TechSupply is working…';
  }
  const status = document.querySelector<HTMLElement>('[data-techsupply-status]');
  if (status) {
    status.dataset.phase = 'RUNNING';
    status.innerHTML =
      '<strong>Provider operation in progress</strong><span>Discovering and invoking TechSupply on its independent origin.</span>';
  }
}

function renderLiveGoalState(): void {
  const hero = document.querySelector<HTMLElement>('.mission-hero');
  const graph = document.querySelector<HTMLElement>('.goal-graph');
  const activity = document.querySelector<HTMLElement>('.activity-panel');
  if (hero) hero.outerHTML = renderMissionSummary(goalState);
  if (graph) graph.outerHTML = renderGoalGraph(goalState);
  if (activity) activity.outerHTML = renderAgentActivityTimeline(goalState);
}

async function createInvoker() {
  const frame = document.querySelector<HTMLIFrameElement>('iframe[src="http://localhost:4500"]');
  const result = await createCrossOriginProviderInvoker({
    providerOrigin: PROVIDER_ORIGIN,
    toolNames: OFFICEPRO_BRAND_TOOL_NAMES,
    frame,
    requestType: 'NEXUS_OFFICEPRO_TOOL_REQUEST',
    responseType: 'OFFICEPRO_TOOL_RESULT',
    requestIdPrefix: 'officepro-request',
    timeoutLabel: 'OfficePro',
  });
  return result;
}

function setWorkingStatus(message: string): void {
  const button = document.querySelector<HTMLButtonElement>('[data-ask-officepro]');
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'OfficePro is working…';
  }
  const status = document.querySelector<HTMLElement>('[data-officepro-status]');
  if (status) {
    status.dataset.phase = 'RUNNING';
    status.innerHTML = `<strong>Provider operation in progress</strong><span>${escapeHtml(message)}</span>`;
  }
}

function render(view: {
  phase: 'READY' | 'COMPLETE' | 'ERROR';
  message: string;
  transport?: 'WEBMCP' | 'WEBSITE_FALLBACK';
}): void {
  if (!main) return;
  main.innerHTML = renderMissionDashboard(goalState, {
    providerOrigin: PROVIDER_ORIGIN,
    phase: view.phase,
    message: view.message,
    ...(view.transport ? { transport: view.transport } : {}),
    ...(handoff ? { handoff } : {}),
  }, techSupplyView, internetView, securityView, true);
  bindControls();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
