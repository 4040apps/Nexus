export const GOAL_STATE_ERROR_CODES = [
  'REQUIREMENT_NOT_FOUND',
  'INVALID_TRANSITION',
  'PROVIDER_REQUIRED',
  'BLOCKER_REQUIRED',
  'APPROVAL_REQUIRED',
  'INVALID_ESTIMATED_COST',
  'DUPLICATE_ACTIVITY_EVENT',
  'DUPLICATE_REQUIREMENT',
] as const;

export type GoalStateErrorCode = (typeof GOAL_STATE_ERROR_CODES)[number];

export class GoalStateError extends Error {
  readonly code: GoalStateErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: GoalStateErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'GoalStateError';
    this.code = code;
    this.details = details;
  }
}
