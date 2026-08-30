import { describe, expect, it } from 'vitest';

import {
  AUTHORIZED_CONSUMER_ORIGIN,
  PROVIDER_ORIGIN,
  UNAUTHORIZED_CONSUMER_ORIGIN,
} from './config.js';
import { renderConsumerPage, renderProviderPage } from './server.js';

describe('cross-origin WebMCP reproduction harness', () => {
  it('uses separate authorized consumer, provider, and unauthorized origins', () => {
    expect(new Set([
      AUTHORIZED_CONSUMER_ORIGIN,
      PROVIDER_ORIGIN,
      UNAUTHORIZED_CONSUMER_ORIGIN,
    ]).size).toBe(3);
  });

  it('delegates the tools permission to the independent provider iframe', () => {
    const page = renderConsumerPage(AUTHORIZED_CONSUMER_ORIGIN);

    expect(page).toContain(`src="${PROVIDER_ORIGIN}"`);
    expect(page).toContain('allow="tools"');
    expect(page).toContain('/consumer.js');
  });

  it('keeps a normal provider website surface alongside genuine registration', () => {
    const page = renderProviderPage();

    expect(page).toContain('This normal provider page works independently of WebMCP.');
    expect(page).toContain('Check website availability');
    expect(page).toContain('/provider.js');
  });
});
