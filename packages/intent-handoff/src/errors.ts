export const INTENT_HANDOFF_ERROR_CODES = [
  'SOURCE_PROVIDER_REQUIRED',
  'NO_REMAINING_REQUIREMENTS',
  'AUTHORIZATION_REQUIRED',
  'INVALID_HANDOFF_STATE',
  'GOAL_MISMATCH',
  'DUPLICATE_ACTIVITY_EVENT',
  'INVALID_HANDOFF_PAYLOAD',
] as const;

export type IntentHandoffErrorCode = (typeof INTENT_HANDOFF_ERROR_CODES)[number];

export class IntentHandoffError extends Error {
  readonly code: IntentHandoffErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: IntentHandoffErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'IntentHandoffError';
    this.code = code;
    this.details = details;
  }
}
