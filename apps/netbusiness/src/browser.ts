import { registerProviderTools } from '@nexus/provider-template';
import type { WebMcpDocument } from '@nexus/webmcp';

import {
  executeNetBusinessBrokerTool,
  executeNetBusinessWebsiteFlow,
  isNetBusinessBrokerToolName,
  netBusinessBrokerProvider,
} from './broker-runtime.js';
import type { NetBusinessBrokerToolName } from './broker-runtime.js';

const NEXUS_ORIGIN = 'http://localhost:4400';
const status = document.querySelector<HTMLElement>('[data-registration-status]');
const output = document.querySelector<HTMLElement>('[data-provider-output]');
const button = document.querySelector<HTMLButtonElement>('[data-run-provider-flow]');
const registration = await registerProviderTools(
  document as unknown as WebMcpDocument,
  netBusinessBrokerProvider,
  { exposedTo: [NEXUS_ORIGIN] },
);

if (status) {
  status.dataset.status = registration.status;
  status.textContent = registration.status === 'REGISTERED'
    ? `REGISTERED — ${registration.registeredTools.length} genuine WebMCP tools exposed to NEXUS.`
    : 'WebMCP is unavailable. NetBusiness’s normal website remains available.';
}
window.parent.postMessage({ type: 'NETBUSINESS_PROVIDER_READY', registrationStatus: registration.status }, NEXUS_ORIGIN);

button?.addEventListener('click', () => void runWebsiteFlow());
window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.origin !== NEXUS_ORIGIN || !isToolRequest(event.data)) return;
  const request = event.data;
  void executeNetBusinessBrokerTool(request.toolName, request.input).then((result) => {
    window.parent.postMessage({
      type: 'NETBUSINESS_TOOL_RESULT',
      requestId: request.requestId,
      toolName: request.toolName,
      result,
    }, NEXUS_ORIGIN);
  });
});

async function runWebsiteFlow(): Promise<void> {
  if (!output || !button) return;
  button.disabled = true;
  const results = await executeNetBusinessWebsiteFlow();
  output.textContent = results.every((result) => result.ok)
    ? 'Coverage confirmed. Installation Sep 25, 2026 meets the deadline; offer total MXN 27,500.'
    : 'NetBusiness could not complete the provider-owned check.';
  button.disabled = false;
}

function isToolRequest(value: unknown): value is {
  type: 'NEXUS_NETBUSINESS_TOOL_REQUEST'; requestId: string; toolName: NetBusinessBrokerToolName; input: unknown;
} {
  return typeof value === 'object' && value !== null && 'type' in value &&
    value.type === 'NEXUS_NETBUSINESS_TOOL_REQUEST' && 'requestId' in value &&
    typeof value.requestId === 'string' && 'toolName' in value &&
    isNetBusinessBrokerToolName(value.toolName) && 'input' in value;
}
