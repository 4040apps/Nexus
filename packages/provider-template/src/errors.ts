import type { JsonValue, StructuredToolError } from '@nexus/webmcp';

export const PROVIDER_ERROR_CODES = [
  'INVALID_INPUT',
  'REQUIRES_HUMAN',
  'NOT_FOUND',
  'UNAVAILABLE',
  'CONSTRAINT_VIOLATION',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'WEBMCP_UNSUPPORTED',
  'TOOL_REGISTRATION_FAILED',
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export function createProviderError(
  code: ProviderErrorCode,
  message: string,
  options: {
    retryable?: boolean;
    details?: Readonly<Record<string, JsonValue>>;
  } = {},
): StructuredToolError {
  return {
    ok: false,
    code,
    message,
    retryable: options.retryable ?? false,
    ...(options.details ? { details: options.details } : {}),
  };
}

export const PROVIDER_TEMPLATE_ERROR_CODES = [
  'INVALID_PROVIDER_METADATA',
  'INVALID_TOOL_DEFINITION',
  'DUPLICATE_TOOL_NAME',
] as const;

export type ProviderTemplateErrorCode = (typeof PROVIDER_TEMPLATE_ERROR_CODES)[number];

export class ProviderTemplateError extends Error {
  readonly code: ProviderTemplateErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: ProviderTemplateErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'ProviderTemplateError';
    this.code = code;
    this.details = details;
  }
}
