export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonSchema = Readonly<Record<string, JsonValue>>;

export type WebMcpToolDefinition<TInput, TOutput> = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (input: TInput) => Promise<TOutput>;
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
