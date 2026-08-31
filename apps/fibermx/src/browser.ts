import { configureProviderOrigin, registerProviderTools } from '@nexus/provider-template';
import { getBuildOriginConfiguration } from '@nexus/environment/build';
import type { WebMcpDocument } from '@nexus/webmcp';

import {
  executeFiberMxBrokerTool,
  executeFiberMxWebsiteFlow,
  fiberMxBrokerProvider,
  isFiberMxBrokerToolName,
} from './broker-runtime.js';
import type { FiberMxBrokerToolName } from './broker-runtime.js';

const { origins } = getBuildOriginConfiguration();
const NEXUS_ORIGIN = origins.nexus;
const status = document.querySelector<HTMLElement>('[data-registration-status]');
const output = document.querySelector<HTMLElement>('[data-provider-output]');
const button = document.querySelector<HTMLButtonElement>('[data-run-provider-flow]');
const registration = await registerProviderTools(
  document as unknown as WebMcpDocument,
  configureProviderOrigin(fiberMxBrokerProvider, origins.fibermx),
  { exposedTo: [NEXUS_ORIGIN] },
);

if (status) {
  status.dataset.status = registration.status;
  status.textContent = registration.status === 'REGISTERED'
    ? `REGISTERED — ${registration.registeredTools.length} genuine WebMCP tools exposed to NEXUS.`
    : 'WebMCP is unavailable. FiberMX’s normal website remains available.';
}
window.parent.postMessage({ type: 'FIBERMX_PROVIDER_READY', registrationStatus: registration.status }, NEXUS_ORIGIN);

button?.addEventListener('click', () => void runWebsiteFlow());
window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.origin !== NEXUS_ORIGIN || !isToolRequest(event.data)) return;
  const request = event.data;
  void executeFiberMxBrokerTool(request.toolName, request.input).then((result) => {
    window.parent.postMessage({
      type: 'FIBERMX_TOOL_RESULT',
      requestId: request.requestId,
      toolName: request.toolName,
      result,
    }, NEXUS_ORIGIN);
  });
});

async function runWebsiteFlow(): Promise<void> {
  if (!output || !button) return;
  button.disabled = true;
  const results = await executeFiberMxWebsiteFlow();
  const installation = results[1];
  output.textContent = installation?.ok
    ? 'Coverage is available. Earliest installation is Oct 8, 2026 — after the requested Oct 1 deadline.'
    : 'FiberMX could not complete the provider-owned check.';
  button.disabled = false;
}

function isToolRequest(value: unknown): value is {
  type: 'NEXUS_FIBERMX_TOOL_REQUEST'; requestId: string; toolName: FiberMxBrokerToolName; input: unknown;
} {
  return typeof value === 'object' && value !== null && 'type' in value &&
    value.type === 'NEXUS_FIBERMX_TOOL_REQUEST' && 'requestId' in value &&
    typeof value.requestId === 'string' && 'toolName' in value &&
    isFiberMxBrokerToolName(value.toolName) && 'input' in value;
}
