import type {
  WebMcpDocument,
  WebMcpModelContext,
  WebMcpRemoteTool,
} from '@nexus/webmcp';
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
import type {
  OfficeProBrandToolName,
  OfficeProToolInvoker,
} from './officepro-brand-mode.js';
import {
  authorizeOfficeProIntentHandoff,
  executeOfficeProIntentHandoff,
  proposeOfficeProIntentHandoff,
} from './officepro-intent-handoff.js';

const PROVIDER_ORIGIN = 'http://localhost:4500';
const main = document.querySelector<HTMLElement>('#main-content');
let goalState = createInitialHeroGoalState();
let requestSequence = 0;
let handoff: IntentHandoffLifecycle | undefined;
let providerTransport: 'WEBMCP' | 'WEBSITE_FALLBACK' | undefined;
let providerMessage = 'Waiting for the independent OfficePro origin to report its WebMCP capability.';

bindControls();

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
    renderCurrent();
  } catch (error) {
    renderLifecycleError(error);
  }
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

function renderLiveGoalState(): void {
  const hero = document.querySelector<HTMLElement>('.mission-hero');
  const graph = document.querySelector<HTMLElement>('.goal-graph');
  const activity = document.querySelector<HTMLElement>('.activity-panel');
  if (hero) hero.outerHTML = renderMissionSummary(goalState);
  if (graph) graph.outerHTML = renderGoalGraph(goalState);
  if (activity) activity.outerHTML = renderAgentActivityTimeline(goalState);
}

async function createInvoker(): Promise<{
  invoker: OfficeProToolInvoker;
  transport: 'WEBMCP' | 'WEBSITE_FALLBACK';
}> {
  const modelContext = (document as unknown as WebMcpDocument).modelContext;
  if (
    modelContext &&
    typeof modelContext.getTools === 'function' &&
    typeof modelContext.executeTool === 'function'
  ) {
    try {
      const tools = await modelContext.getTools({ fromOrigins: [PROVIDER_ORIGIN] });
      if (OFFICEPRO_BRAND_TOOL_NAMES.every((name) => tools.some((tool) => tool.name === name))) {
        return { invoker: createWebMcpInvoker(modelContext, tools), transport: 'WEBMCP' };
      }
    } catch {
      // The normal provider website is the explicit, visible fallback below.
    }
  }

  const frame = document.querySelector<HTMLIFrameElement>('iframe[src="http://localhost:4500"]');
  if (!frame?.contentWindow) {
    throw new Error('The independent OfficePro provider frame is unavailable.');
  }
  return { invoker: createWebsiteInvoker(frame.contentWindow), transport: 'WEBSITE_FALLBACK' };
}

function createWebMcpInvoker(
  modelContext: WebMcpModelContext,
  tools: readonly WebMcpRemoteTool[],
): OfficeProToolInvoker {
  return {
    async invoke(toolName, input) {
      const tool = tools.find((candidate) => candidate.name === toolName);
      if (!tool || !modelContext.executeTool) {
        throw new Error(`${toolName} was not discovered on ${PROVIDER_ORIGIN}.`);
      }
      return modelContext.executeTool(tool, JSON.stringify(input));
    },
  };
}

function createWebsiteInvoker(providerWindow: Window): OfficeProToolInvoker {
  return {
    invoke(toolName, input) {
      return new Promise((resolve, reject) => {
        const requestId = `officepro-request-${++requestSequence}`;
        const timeout = window.setTimeout(() => {
          window.removeEventListener('message', onMessage);
          reject(new Error(`OfficePro’s normal website did not answer ${toolName}.`));
        }, 5_000);
        const onMessage = (event: MessageEvent<unknown>): void => {
          if (
            event.origin !== PROVIDER_ORIGIN ||
            event.source !== providerWindow ||
            !isToolResponse(event.data, requestId, toolName)
          ) {
            return;
          }
          window.clearTimeout(timeout);
          window.removeEventListener('message', onMessage);
          resolve(event.data.result);
        };
        window.addEventListener('message', onMessage);
        providerWindow.postMessage(
          { type: 'NEXUS_OFFICEPRO_TOOL_REQUEST', requestId, toolName, input },
          PROVIDER_ORIGIN,
        );
      });
    },
  };
}

function isToolResponse(
  value: unknown,
  requestId: string,
  toolName: OfficeProBrandToolName,
): value is { type: 'OFFICEPRO_TOOL_RESULT'; requestId: string; toolName: string; result: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'OFFICEPRO_TOOL_RESULT' &&
    'requestId' in value &&
    value.requestId === requestId &&
    'toolName' in value &&
    value.toolName === toolName &&
    'result' in value
  );
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
  });
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
