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
import {
  TECHSUPPLY_BROKER_TOOL_NAMES,
  TECHSUPPLY_PROVIDER_ORIGIN,
  TechSupplyBrokerModeError,
  runTechSupplyBrokerMode,
} from './techsupply-broker-mode.js';

const PROVIDER_ORIGIN = 'http://localhost:4500';
const main = document.querySelector<HTMLElement>('#main-content');
let goalState = createInitialHeroGoalState();
let handoff: IntentHandoffLifecycle | undefined;
let providerTransport: 'WEBMCP' | 'WEBSITE_FALLBACK' | undefined;
let providerMessage = 'Waiting for the independent OfficePro origin to report its WebMCP capability.';
let techSupplyProviderReady = false;
let fiberMxProviderReady = false;
let netBusinessProviderReady = false;
let techSupplyView:
  | {
      providerOrigin: string;
      phase: 'READY' | 'RUNNING' | 'COMPLETE' | 'ERROR';
      message: string;
      transport?: 'WEBMCP' | 'WEBSITE_FALLBACK';
    }
  | undefined;
let internetView: InternetRuntimeView | undefined;

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
});

function bindControls(): void {
  document.querySelector<HTMLButtonElement>('[data-ask-officepro]')?.addEventListener('click', () => {
    void runFlow();
  });
  document.querySelector<HTMLButtonElement>('[data-continue-nexus]')?.addEventListener('click', () => {
    proposeHandoff();
  });
  document.querySelector<HTMLButtonElement>('[data-authorize-handoff]')?.addEventListener('click', () => {
    void authorizeAndExecuteHandoff();
  });
  document.querySelector<HTMLButtonElement>('[data-stay-officepro]')?.addEventListener('click', () => {
    stayWithOfficePro();
  });
  document.querySelector<HTMLButtonElement>('[data-route-computers]')?.addEventListener('click', () => {
    void runTechSupplyFlow();
  });
  document.querySelector<HTMLButtonElement>('[data-route-internet]')?.addEventListener('click', () => {
    void runFiberMxFlow();
  });
  document.querySelector<HTMLButtonElement>('[data-recover-internet]')?.addEventListener('click', () => {
    void runNetBusinessRecovery();
  });
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
    renderCurrent();
  } catch (error) {
    renderInternetError(error);
  }
}

function renderInternetError(error: unknown): void {
  internetView = {
    fiberMxOrigin: FIBERMX_PROVIDER_ORIGIN,
    netBusinessOrigin: NETBUSINESS_PROVIDER_ORIGIN,
    phase: 'ERROR',
    message: error instanceof InternetBrokerModeError || error instanceof Error
      ? error.message
      : 'Internet Broker Mode could not complete.',
    ...(internetView?.fiberMxTransport ? { fiberMxTransport: internetView.fiberMxTransport } : {}),
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
  phase: 'COMPLETE' | 'ERROR';
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
  }, techSupplyView, internetView);
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
