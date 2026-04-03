import { createRequire } from 'node:module'

import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

import type {
  SDKResultMessage,
  SDKSessionInfo,
  SDKUserMessage,
} from './coreTypes.js'
import type {
  AnyZodRawShape,
  ForkSessionOptions,
  ForkSessionResult,
  GetSessionInfoOptions,
  GetSessionMessagesOptions,
  InferShape,
  ListSessionsOptions,
  McpSdkServerConfigWithInstance,
  Options,
  Query,
  SDKSession,
  SDKSessionOptions,
  SdkMcpToolDefinition,
  SessionMessage,
  SessionMutationOptions,
} from './runtimeTypes.js'

export type * from './coreTypes.js'
export type * from './runtimeTypes.js'
export type {
  SDKControlInitializeResponse,
  SDKControlReloadPluginsResponse,
  SDKControlRequest,
  SDKControlResponse,
} from './controlTypes.js'
export type { Settings } from './settingsTypes.generated.js'

export { EXIT_REASONS, HOOK_EVENTS } from './coreTypes.js'
export { AbortError } from './runtimeTypes.js'

export type CreateSdkMcpServerOptions = {
  name: string
  version?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Array<SdkMcpToolDefinition<any>>
}

export type GetSubagentMessagesOptions = {
  dir?: string
  limit?: number
  offset?: number
}

export type ListSubagentsOptions = {
  dir?: string
}

type AgentSdkRuntimeModule = {
  tool: <Schema extends AnyZodRawShape>(
    name: string,
    description: string,
    inputSchema: Schema,
    handler: (
      args: InferShape<Schema>,
      extra: unknown,
    ) => Promise<CallToolResult>,
    extras?: {
      annotations?: ToolAnnotations
      searchHint?: string
      alwaysLoad?: boolean
    },
  ) => SdkMcpToolDefinition<Schema>
  createSdkMcpServer: (
    options: CreateSdkMcpServerOptions,
  ) => McpSdkServerConfigWithInstance
  query: (params: {
    prompt: string | AsyncIterable<SDKUserMessage>
    options?: Options
  }) => Query
  unstable_v2_createSession: (options: SDKSessionOptions) => SDKSession
  unstable_v2_resumeSession: (
    sessionId: string,
    options: SDKSessionOptions,
  ) => SDKSession
  unstable_v2_prompt: (
    message: string,
    options: SDKSessionOptions,
  ) => Promise<SDKResultMessage>
  getSessionMessages: (
    sessionId: string,
    options?: GetSessionMessagesOptions,
  ) => Promise<SessionMessage[]>
  listSessions: (options?: ListSessionsOptions) => Promise<SDKSessionInfo[]>
  getSessionInfo: (
    sessionId: string,
    options?: GetSessionInfoOptions,
  ) => Promise<SDKSessionInfo | undefined>
  renameSession: (
    sessionId: string,
    title: string,
    options?: SessionMutationOptions,
  ) => Promise<void>
  tagSession: (
    sessionId: string,
    tag: string | null,
    options?: SessionMutationOptions,
  ) => Promise<void>
  forkSession: (
    sessionId: string,
    options?: ForkSessionOptions,
  ) => Promise<ForkSessionResult>
  getSubagentMessages: (
    sessionId: string,
    agentId: string,
    options?: GetSubagentMessagesOptions,
  ) => Promise<SessionMessage[]>
  listSubagents: (
    sessionId: string,
    options?: ListSubagentsOptions,
  ) => Promise<string[]>
}

const require = createRequire(import.meta.url)
const agentSdkTypesModulePath = './entrypoints/' + 'agentSdkTypes.js'

function loadAgentSdkTypes(): AgentSdkRuntimeModule {
  return require(agentSdkTypesModulePath) as AgentSdkRuntimeModule
}

export function tool<Schema extends AnyZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (
    args: InferShape<Schema>,
    extra: unknown,
  ) => Promise<CallToolResult>,
  extras?: {
    annotations?: ToolAnnotations
    searchHint?: string
    alwaysLoad?: boolean
  },
): SdkMcpToolDefinition<Schema> {
  return loadAgentSdkTypes().tool(
    name,
    description,
    inputSchema,
    handler,
    extras,
  )
}

export function createSdkMcpServer(
  options: CreateSdkMcpServerOptions,
): McpSdkServerConfigWithInstance {
  return loadAgentSdkTypes().createSdkMcpServer(options)
}

export function query(params: {
  prompt: string | AsyncIterable<SDKUserMessage>
  options?: Options
}): Query {
  return loadAgentSdkTypes().query(params)
}

export function unstable_v2_createSession(
  options: SDKSessionOptions,
): SDKSession {
  return loadAgentSdkTypes().unstable_v2_createSession(options)
}

export function unstable_v2_resumeSession(
  sessionId: string,
  options: SDKSessionOptions,
): SDKSession {
  return loadAgentSdkTypes().unstable_v2_resumeSession(sessionId, options)
}

export function unstable_v2_prompt(
  message: string,
  options: SDKSessionOptions,
): Promise<SDKResultMessage> {
  return loadAgentSdkTypes().unstable_v2_prompt(message, options)
}

export function getSessionMessages(
  sessionId: string,
  options?: GetSessionMessagesOptions,
): Promise<SessionMessage[]> {
  return loadAgentSdkTypes().getSessionMessages(sessionId, options)
}

export function listSessions(
  options?: ListSessionsOptions,
): Promise<SDKSessionInfo[]> {
  return loadAgentSdkTypes().listSessions(options)
}

export function getSessionInfo(
  sessionId: string,
  options?: GetSessionInfoOptions,
): Promise<SDKSessionInfo | undefined> {
  return loadAgentSdkTypes().getSessionInfo(sessionId, options)
}

export function renameSession(
  sessionId: string,
  title: string,
  options?: SessionMutationOptions,
): Promise<void> {
  return loadAgentSdkTypes().renameSession(sessionId, title, options)
}

export function tagSession(
  sessionId: string,
  tag: string | null,
  options?: SessionMutationOptions,
): Promise<void> {
  return loadAgentSdkTypes().tagSession(sessionId, tag, options)
}

export function forkSession(
  sessionId: string,
  options?: ForkSessionOptions,
): Promise<ForkSessionResult> {
  return loadAgentSdkTypes().forkSession(sessionId, options)
}

export function getSubagentMessages(
  sessionId: string,
  agentId: string,
  options?: GetSubagentMessagesOptions,
): Promise<SessionMessage[]> {
  return loadAgentSdkTypes().getSubagentMessages(sessionId, agentId, options)
}

export function listSubagents(
  sessionId: string,
  options?: ListSubagentsOptions,
): Promise<string[]> {
  return loadAgentSdkTypes().listSubagents(sessionId, options)
}
