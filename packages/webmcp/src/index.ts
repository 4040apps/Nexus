export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type JsonSchema = Readonly<Record<string, JsonValue>>;

export type WebMcpToolDefinition<TInput, TOutput> = {
  name: string;
  title?: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (input: TInput) => TOutput | Promise<TOutput>;
};

export type WebMcpRegisterToolOptions = {
  signal?: AbortSignal;
  exposedTo?: readonly string[];
};

export type WebMcpGetToolsOptions = {
  fromOrigins?: readonly string[];
};

export type WebMcpExecuteToolOptions = {
  signal?: AbortSignal;
};

export type WebMcpRemoteTool = {
  name: string;
  origin: string;
  title?: string;
  description?: string;
  inputSchema?: JsonSchema;
  readonly [key: string]: unknown;
};

export type WebMcpModelContext = {
  registerTool: (
    tool: WebMcpToolDefinition<unknown, unknown>,
    options?: WebMcpRegisterToolOptions,
  ) => Promise<void>;
  getTools?: (options?: WebMcpGetToolsOptions) => Promise<readonly WebMcpRemoteTool[]>;
  executeTool?: (
    tool: WebMcpRemoteTool,
    input: string,
    options?: WebMcpExecuteToolOptions,
  ) => Promise<unknown>;
};

export type WebMcpDocument = {
  readonly modelContext?: WebMcpModelContext;
};

export type StructuredToolError = {
  ok: false;
  code: string;
  message: string;
  retryable: boolean;
  details?: Readonly<Record<string, JsonValue>>;
};

export type ToolSuccess<TData> = {
  ok: true;
  data: TData;
};

export type ToolResult<TData> = ToolSuccess<TData> | StructuredToolError;
