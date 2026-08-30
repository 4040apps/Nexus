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

export {
  MISSION_DASHBOARD_STYLES,
  assertCanonicalStatusPresentation,
  deriveMissionMode,
  renderAgentActivityTimeline,
  renderGoalGraph,
  renderIntentHandoff,
  renderMissionDashboard,
  renderOfficeProRuntime,
  renderTechSupplyRuntime,
  renderMissionProgress,
  renderMissionSummary,
  renderRequirementCard,
  renderRequirementStatus,
} from './dashboard.js';

export type { MissionMode, OfficeProRuntimeView, TechSupplyRuntimeView } from './dashboard.js';

export {
  OFFICEPRO_BRAND_TOOL_NAMES,
  OfficeProBrandModeError,
  runOfficeProBrandMode,
} from './officepro-brand-mode.js';

export type {
  OfficeProBrandModeErrorCode,
  OfficeProBrandModeOptions,
  OfficeProBrandModeResult,
  OfficeProBrandToolName,
  OfficeProToolInvoker,
} from './officepro-brand-mode.js';

export {
  OFFICEPRO_HANDOFF_ID,
  authorizeOfficeProIntentHandoff,
  executeOfficeProIntentHandoff,
  proposeOfficeProIntentHandoff,
} from './officepro-intent-handoff.js';

export {
  TECHSUPPLY_BROKER_TOOL_NAMES,
  TECHSUPPLY_DISCOVERY_METADATA,
  TECHSUPPLY_PROVIDER_ORIGIN,
  TechSupplyBrokerModeError,
  discoverComputerProvider,
  runTechSupplyBrokerMode,
} from './techsupply-broker-mode.js';
export type {
  TechSupplyBrokerModeErrorCode,
  TechSupplyBrokerModeResult,
  TechSupplyBrokerToolName,
  TechSupplyToolInvoker,
  ThinProviderMetadata,
} from './techsupply-broker-mode.js';

export {
  HERO_DASHBOARD_STATE_NAMES,
  HERO_MISSION,
  createHeroDashboardStates,
  createInitialHeroGoalState,
} from './dashboard-fixtures.js';

export type {
  HeroDashboardStateName,
  HeroDashboardStates,
} from './dashboard-fixtures.js';

export {
  NEXUS_READINESS_ROUTES,
  createNexusReadinessSurfaces,
  getNexusReadinessResponse,
  validateNexusReadinessSurfaces,
} from './readiness.js';

export type {
  NexusReadinessConfig,
  NexusReadinessResponse,
  NexusReadinessRoute,
  NexusReadinessSurfaces,
  NexusReadinessValidation,
  NexusStructuredData,
} from './readiness.js';
