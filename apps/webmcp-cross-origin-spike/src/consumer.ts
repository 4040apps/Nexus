import type { WebMcpDocument } from '@nexus/webmcp';

import {
  AUTHORIZED_CONSUMER_ORIGIN,
  PROVIDER_ORIGIN,
  PROVIDER_READY_MESSAGE,
  PROVIDER_TOOL_NAME,
} from './config.js';

const isAuthorizedOrigin = window.location.origin === AUTHORIZED_CONSUMER_ORIGIN;
const invokeButton = document.querySelector<HTMLButtonElement>('#discover-and-invoke');
let providerStatus = 'WAITING';

setText('consumer-origin', window.location.origin);
setText('expected-access', isAuthorizedOrigin ? 'AUTHORIZED' : 'UNAUTHORIZED');
setText('runtime', navigator.userAgent);

window.addEventListener('message', (event) => {
  if (
    event.origin !== PROVIDER_ORIGIN ||
    !isProviderReadyMessage(event.data)
  ) {
    return;
  }

  providerStatus = event.data.status;
  setText('provider-ready', `${event.data.status} from ${event.origin}`);
  if (invokeButton) invokeButton.disabled = false;
});

invokeButton?.addEventListener('click', async () => {
  if (providerStatus === 'UNSUPPORTED') {
    setOutcome('UNSUPPORTED', 'The provider iframe does not expose document.modelContext.');
    return;
  }

  const modelContext = (document as WebMcpDocument).modelContext;

  if (
    !modelContext ||
    typeof modelContext.getTools !== 'function' ||
    typeof modelContext.executeTool !== 'function'
  ) {
    setOutcome('UNSUPPORTED', 'This browser does not expose the current consumer WebMCP API.');
    return;
  }

  try {
    const tools = await modelContext.getTools({ fromOrigins: [PROVIDER_ORIGIN] });
    const providerTool = tools.find(
      (tool) => tool.name === PROVIDER_TOOL_NAME && tool.origin === PROVIDER_ORIGIN,
    );

    if (!providerTool) {
      setOutcome(
        isAuthorizedOrigin ? 'AUTHORIZED_TOOL_NOT_VISIBLE' : 'UNAUTHORIZED_BLOCKED',
        `${PROVIDER_TOOL_NAME} was not exposed to ${window.location.origin}.`,
      );
      return;
    }

    if (!isAuthorizedOrigin) {
      setOutcome(
        'SECURITY_FAILURE',
        `Unauthorized origin discovered ${PROVIDER_TOOL_NAME}; do not treat this runtime as validated.`,
      );
      return;
    }

    const result = await modelContext.executeTool(
      providerTool,
      JSON.stringify({ itemId: 'desk-20', city: 'Guadalajara' }),
    );
    setOutcome('AUTHORIZED_SUCCESS', JSON.stringify(result));
  } catch (error) {
    setOutcome(
      isAuthorizedOrigin ? 'AUTHORIZED_FAILED' : 'UNAUTHORIZED_BLOCKED',
      error instanceof Error ? error.message : 'WebMCP rejected the operation.',
    );
  }
});

function isProviderReadyMessage(
  value: unknown,
): value is { type: string; status: string; registeredTools: readonly string[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === PROVIDER_READY_MESSAGE &&
    'status' in value &&
    typeof value.status === 'string' &&
    'registeredTools' in value &&
    Array.isArray(value.registeredTools)
  );
}

function setOutcome(outcome: string, detail: string): void {
  document.body.dataset.outcome = outcome;
  setText('outcome', outcome);
  setText('result', detail);
}

function setText(id: string, text: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}
