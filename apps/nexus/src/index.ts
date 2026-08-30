import type { GoalState } from '@nexus/goal-state';
import type { IntentHandoff } from '@nexus/intent-handoff';
import type { ToolResult } from '@nexus/webmcp';

export type NexusFoundation = {
  goalState: GoalState;
  acceptedHandoff?: IntentHandoff;
};

export type NexusToolResult<TData> = ToolResult<TData>;

export const NEXUS_CAPABILITIES = [
  'accept_intent_handoff',
  'discover_providers',
  'route_requirement',
  'get_goal_state',
] as const;
