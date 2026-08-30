import { registerProviderTools } from '@nexus/provider-template';
import type { WebMcpDocument } from '@nexus/webmcp';

import {
  executeTechSupplyBrokerTool,
  executeTechSupplyWebsiteFlow,
  isTechSupplyBrokerToolName,
  techSupplyBrokerProvider,
} from './broker-runtime.js';
import type { TechSupplyBrokerToolName } from './broker-runtime.js';

const NEXUS_ORIGIN = 'http://localhost:4400';
const status = document.querySelector<HTMLElement>('[data-registration-status]');
const output = document.querySelector<HTMLElement>('[data-provider-output]');
const runButton = document.querySelector<HTMLButtonElement>('[data-run-provider-flow]');
const registration = await registerProviderTools(
  document as unknown as WebMcpDocument,
  techSupplyBrokerProvider,
  { exposedTo: [NEXUS_ORIGIN] },
);

if (status) {
  status.dataset.status = registration.status;
  status.textContent =
    registration.status === 'REGISTERED'
      ? `REGISTERED — ${registration.registeredTools.length} genuine WebMCP tools exposed to NEXUS.`
      : 'WebMCP is unavailable. TechSupply’s normal website flow remains available.';
}

window.parent.postMessage(
  {
    type: 'TECHSUPPLY_PROVIDER_READY',
    registrationStatus: registration.status,
    registeredTools: registration.registeredTools,
  },
  NEXUS_ORIGIN,
);

runButton?.addEventListener('click', () => {
  void runNormalWebsiteFlow();
});

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.origin !== NEXUS_ORIGIN || !isToolRequest(event.data)) return;
  const request = event.data;
  void executeTechSupplyBrokerTool(request.toolName, request.input).then((result) => {
    window.parent.postMessage(
      {
        type: 'TECHSUPPLY_TOOL_RESULT',
        requestId: request.requestId,
        toolName: request.toolName,
        result,
      },
      NEXUS_ORIGIN,
    );
  });
});

async function runNormalWebsiteFlow(): Promise<void> {
  if (!output || !runButton) return;
  runButton.disabled = true;
  output.textContent = 'TechSupply is checking its catalog, inventory, package, and delivery date…';
  const results = await executeTechSupplyWebsiteFlow();
  const successful = results.filter((result) => result.ok).length;
  output.textContent = `${successful} of 3 provider-owned planning operations completed. TechSupply’s normal website remains functional without WebMCP.`;
  runButton.disabled = false;
}

function isToolRequest(
  value: unknown,
): value is { type: 'NEXUS_TECHSUPPLY_TOOL_REQUEST'; requestId: string; toolName: TechSupplyBrokerToolName; input: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'NEXUS_TECHSUPPLY_TOOL_REQUEST' &&
    'requestId' in value &&
    typeof value.requestId === 'string' &&
    'toolName' in value &&
    isTechSupplyBrokerToolName(value.toolName) &&
    'input' in value
  );
}
