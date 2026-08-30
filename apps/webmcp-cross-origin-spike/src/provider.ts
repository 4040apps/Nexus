import {
  createExampleProvider,
  registerProviderTools,
  type ExampleAvailabilityService,
} from '@nexus/provider-template';
import type { WebMcpDocument } from '@nexus/webmcp';

import {
  AUTHORIZED_CONSUMER_ORIGIN,
  PROVIDER_ORIGIN,
  PROVIDER_READY_MESSAGE,
} from './config.js';

const availabilityByItem = new Map([
  ['desk-20', true],
  ['chair-20', false],
]);

let invocationCount = 0;

const service: ExampleAvailabilityService = {
  checkAvailability(input) {
    invocationCount += 1;
    renderInvocation(input.itemId, input.city);

    return {
      itemId: input.itemId,
      city: input.city,
      available: input.city === 'Guadalajara' && availabilityByItem.get(input.itemId) === true,
    };
  },
};

const provider = createExampleProvider(
  {
    id: 'example-provider',
    name: 'Example Provider',
    description: 'Independent provider used by the cross-origin WebMCP spike.',
    origin: PROVIDER_ORIGIN,
    categories: ['office-furniture'],
    serviceAreas: ['Guadalajara'],
  },
  service,
);

setText('runtime', navigator.userAgent);

const registration = await registerProviderTools(document as unknown as WebMcpDocument, provider, {
  exposedTo: [AUTHORIZED_CONSUMER_ORIGIN],
});

setText(
  'registration-status',
  registration.status === 'REGISTERED'
    ? `Registered ${registration.registeredTools.join(', ')} for ${AUTHORIZED_CONSUMER_ORIGIN}.`
    : `WebMCP ${registration.status.toLowerCase()}: ${registration.errors.map((error) => error.message).join(' ')}`,
);
document.body.dataset.registrationStatus = registration.status;

window.parent.postMessage(
  {
    type: PROVIDER_READY_MESSAGE,
    status: registration.status,
    registeredTools: registration.registeredTools,
  },
  '*',
);

document.querySelector<HTMLButtonElement>('#website-check')?.addEventListener('click', async () => {
  const result = await service.checkAvailability({
    itemId: 'desk-20',
    city: 'Guadalajara',
  });
  setText('website-result', JSON.stringify(result));
});

function renderInvocation(itemId: string, city: string): void {
  setText('invocation-count', String(invocationCount));
  setText('provider-owned-call', `${itemId} in ${city}`);
}

function setText(id: string, text: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}
