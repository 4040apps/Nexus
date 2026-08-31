import { configureProviderOrigin, registerProviderTools } from '@nexus/provider-template';
import { getBuildOriginConfiguration } from '@nexus/environment/build';
import type { WebMcpDocument } from '@nexus/webmcp';

import {
  executeOfficeProBrandTool,
  executeOfficeProWebsiteFlow,
  isOfficeProBrandToolName,
} from './brand-runtime.js';
import { officeProBrandModeProvider } from './fixture.js';

const { origins } = getBuildOriginConfiguration();
const NEXUS_ORIGIN = origins.nexus;
const status = document.querySelector<HTMLElement>('[data-registration-status]');
const output = document.querySelector<HTMLElement>('[data-provider-output]');
const runButton = document.querySelector<HTMLButtonElement>('[data-run-provider-flow]');

const registration = await registerProviderTools(
  document as unknown as WebMcpDocument,
  configureProviderOrigin(officeProBrandModeProvider, origins.officepro),
  { exposedTo: [NEXUS_ORIGIN] },
);

if (status) {
  status.dataset.status = registration.status;
  status.textContent =
    registration.status === 'REGISTERED'
      ? `REGISTERED — ${registration.registeredTools.length} genuine WebMCP tools exposed to NEXUS.`
      : 'WebMCP is unavailable. OfficePro’s normal website flow remains available.';
}

window.parent.postMessage(
  {
    type: 'OFFICEPRO_PROVIDER_READY',
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
  void executeOfficeProBrandTool(request.toolName, request.input).then((result) => {
    window.parent.postMessage(
      {
        type: 'OFFICEPRO_TOOL_RESULT',
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
  output.textContent = 'OfficePro is checking its catalog, stock, package, and delivery date…';
  const results = await executeOfficeProWebsiteFlow();
  const successful = results.filter((result) => result.ok).length;
  output.textContent = `${successful} of 4 provider-owned operations completed. OfficePro’s normal website remains functional without WebMCP.`;
  runButton.disabled = false;
}

function isToolRequest(
  value: unknown,
): value is { type: 'NEXUS_OFFICEPRO_TOOL_REQUEST'; requestId: string; toolName: Parameters<typeof executeOfficeProBrandTool>[0]; input: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'NEXUS_OFFICEPRO_TOOL_REQUEST' &&
    'requestId' in value &&
    typeof value.requestId === 'string' &&
    'toolName' in value &&
    isOfficeProBrandToolName(value.toolName) &&
    'input' in value
  );
}
