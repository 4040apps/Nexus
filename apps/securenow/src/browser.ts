import { configureProviderOrigin, registerProviderTools } from '@nexus/provider-template';
import { getBuildOriginConfiguration } from '@nexus/environment/build';
import type { WebMcpDocument } from '@nexus/webmcp';

import {
  executeSecureNowTool,
  executeSecureNowWebsitePlan,
  isSecureNowToolName,
  secureNowBrokerProvider,
} from './broker-runtime.js';
import type { SecureNowToolName } from './broker-runtime.js';

const { origins } = getBuildOriginConfiguration();
const NEXUS_ORIGIN = origins.nexus;
const status = document.querySelector<HTMLElement>('[data-registration-status]');
const output = document.querySelector<HTMLElement>('[data-provider-output]');
const button = document.querySelector<HTMLButtonElement>('[data-run-provider-flow]');
const registration = await registerProviderTools(
  document as unknown as WebMcpDocument,
  configureProviderOrigin(secureNowBrokerProvider, origins.securenow),
  { exposedTo: [NEXUS_ORIGIN] },
);

if (status) {
  status.dataset.status = registration.status;
  status.textContent = registration.status === 'REGISTERED'
    ? `REGISTERED — ${registration.registeredTools.length} genuine WebMCP tools exposed to NEXUS.`
    : 'WebMCP is unavailable. SecureNow’s normal planning website remains available.';
}
window.parent.postMessage({ type: 'SECURENOW_PROVIDER_READY', registrationStatus: registration.status }, NEXUS_ORIGIN);

button?.addEventListener('click', () => void runWebsitePlan());
window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.origin !== NEXUS_ORIGIN || !isToolRequest(event.data)) return;
  const request = event.data;
  void executeSecureNowTool(request.toolName, request.input).then((result) => {
    window.parent.postMessage({
      type: 'SECURENOW_TOOL_RESULT',
      requestId: request.requestId,
      toolName: request.toolName,
      result,
    }, NEXUS_ORIGIN);
  });
});

async function runWebsitePlan(): Promise<void> {
  if (!output || !button) return;
  button.disabled = true;
  const results = await executeSecureNowWebsitePlan();
  output.textContent = results.every((result) => result.ok)
    ? 'Security plan ready: MXN 37,500, installation Sep 27. Installation is not requested without separate explicit human approval.'
    : 'SecureNow could not complete the provider-owned plan.';
  button.disabled = false;
}

function isToolRequest(value: unknown): value is {
  type: 'NEXUS_SECURENOW_TOOL_REQUEST'; requestId: string; toolName: SecureNowToolName; input: unknown;
} {
  return typeof value === 'object' && value !== null && 'type' in value &&
    value.type === 'NEXUS_SECURENOW_TOOL_REQUEST' && 'requestId' in value &&
    typeof value.requestId === 'string' && 'toolName' in value &&
    isSecureNowToolName(value.toolName) && 'input' in value;
}
