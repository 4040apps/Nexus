import type {
  JsonSchema,
  StructuredToolError,
  ToolResult,
  WebMcpToolDefinition,
} from '@nexus/webmcp';

export type ProviderDescriptor = {
  id: string;
  name: string;
  categories: readonly string[];
  serviceAreas: readonly string[];
  capabilities: readonly string[];
};

export type AgentReadyProviderMetadata = Omit<ProviderDescriptor, 'capabilities'> & {
  description: string;
  origin: string;
};

export type ProviderToolOperation = 'READ' | 'PLAN' | 'COMMIT';

export type HumanApproval = {
  approved: true;
  approvalId: string;
  approvedAt: string;
};

export type ProviderTool<TOutput = unknown> = WebMcpToolDefinition<
  unknown,
  ToolResult<TOutput>
> & {
  operation: ProviderToolOperation;
  requiresHumanApproval: boolean;
};

export type ToolValidationResult<TInput> =
  | { ok: true; value: TInput }
  | { ok: false; error: StructuredToolError };

type ProviderToolConfigBase<TInput, TOutput> = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  validate: (input: unknown) => ToolValidationResult<TInput>;
  execute: (input: TInput) => ToolResult<TOutput> | Promise<ToolResult<TOutput>>;
};

export type ReadOrPlanProviderToolConfig<TInput, TOutput> = ProviderToolConfigBase<
  TInput,
  TOutput
> & {
  operation: 'READ' | 'PLAN';
  requiresHumanApproval: false;
};

export type CommitmentProviderToolConfig<TInput, TOutput> = ProviderToolConfigBase<
  TInput,
  TOutput
> & {
  operation: 'COMMIT';
  requiresHumanApproval: true;
  getApproval: (input: TInput) => HumanApproval | undefined;
};

export type ProviderToolConfig<TInput, TOutput> =
  | ReadOrPlanProviderToolConfig<TInput, TOutput>
  | CommitmentProviderToolConfig<TInput, TOutput>;

export type AgentReadyProvider = {
  metadata: AgentReadyProviderMetadata;
  tools: readonly ProviderTool[];
};

export type ProviderDiscoveryMetadata = ProviderDescriptor & {
  description: string;
  origin: string;
  operations: Readonly<Record<string, ProviderToolOperation>>;
};

export type ProviderRegistrationStatus =
  | 'REGISTERED'
  | 'PARTIAL'
  | 'FAILED'
  | 'UNSUPPORTED';

export type ProviderRegistrationResult = {
  status: ProviderRegistrationStatus;
  registeredTools: string[];
  errors: StructuredToolError[];
};

export type ProviderReadinessSurfaces = {
  robotsTxt: string;
  sitemapXml: string;
  llmsTxt: string;
  structuredData: Readonly<Record<string, unknown>>;
};

export type ProviderToolDefinition = ProviderTool;
