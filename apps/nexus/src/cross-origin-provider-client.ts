import type { WebMcpDocument, WebMcpRemoteTool } from '@nexus/webmcp';

export type ProviderToolTransport = 'WEBMCP' | 'WEBSITE_FALLBACK';

export type CrossOriginProviderInvoker<TToolName extends string> = {
  invoke(toolName: TToolName, input: unknown): Promise<unknown>;
};

export async function createCrossOriginProviderInvoker<TToolName extends string>(config: {
  targetDocument?: WebMcpDocument;
  providerOrigin: string;
  toolNames: readonly TToolName[];
  frame: HTMLIFrameElement | null;
  requestType: string;
  responseType: string;
  requestIdPrefix: string;
  timeoutLabel: string;
}): Promise<{
  invoker: CrossOriginProviderInvoker<TToolName>;
  transport: ProviderToolTransport;
}> {
  const modelContext =
    config.targetDocument?.modelContext ??
    (document as unknown as WebMcpDocument).modelContext;
  if (
    modelContext &&
    typeof modelContext.getTools === 'function' &&
    typeof modelContext.executeTool === 'function'
  ) {
    try {
      const tools = await modelContext.getTools({ fromOrigins: [config.providerOrigin] });
      if (
        config.toolNames.every((name) =>
          tools.some((tool) => tool.name === name && tool.origin === config.providerOrigin),
        )
      ) {
        return {
          invoker: {
            async invoke(toolName, input) {
              const tool = findTool(tools, toolName, config.providerOrigin);
              if (!tool || !modelContext.executeTool) {
                throw new Error(`${toolName} was not discovered on ${config.providerOrigin}.`);
              }
              return modelContext.executeTool(tool, JSON.stringify(input));
            },
          },
          transport: 'WEBMCP',
        };
      }
    } catch {
      // The explicitly labelled normal-site fallback remains available below.
    }
  }

  if (!config.frame?.contentWindow) {
    throw new Error(`The independent ${config.timeoutLabel} provider frame is unavailable.`);
  }
  const providerWindow = config.frame.contentWindow;
  let sequence = 0;
  return {
    invoker: {
      invoke(toolName, input) {
        return new Promise((resolve, reject) => {
          const requestId = `${config.requestIdPrefix}-${++sequence}`;
          const timeout = window.setTimeout(() => {
            window.removeEventListener('message', onMessage);
            reject(new Error(`${config.timeoutLabel}’s normal website did not answer ${toolName}.`));
          }, 5_000);
          const onMessage = (event: MessageEvent<unknown>): void => {
            if (
              event.origin !== config.providerOrigin ||
              event.source !== providerWindow ||
              !isToolResponse(event.data, config.responseType, requestId, toolName)
            ) {
              return;
            }
            window.clearTimeout(timeout);
            window.removeEventListener('message', onMessage);
            resolve(event.data.result);
          };
          window.addEventListener('message', onMessage);
          providerWindow.postMessage(
            { type: config.requestType, requestId, toolName, input },
            config.providerOrigin,
          );
        });
      },
    },
    transport: 'WEBSITE_FALLBACK',
  };
}

function findTool(
  tools: readonly WebMcpRemoteTool[],
  toolName: string,
  providerOrigin: string,
): WebMcpRemoteTool | undefined {
  return tools.find((tool) => tool.name === toolName && tool.origin === providerOrigin);
}

function isToolResponse(
  value: unknown,
  responseType: string,
  requestId: string,
  toolName: string,
): value is { type: string; requestId: string; toolName: string; result: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === responseType &&
    'requestId' in value &&
    value.requestId === requestId &&
    'toolName' in value &&
    value.toolName === toolName &&
    'result' in value
  );
}
