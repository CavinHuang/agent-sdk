import {
  createSdkMcpServer,
  tool,
} from '../sdk/index.js'

import type {
  CanUseTool,
  ElicitationRequest,
  ElicitationResult,
  HookCallbackMatcher,
  HookEvent,
  McpSdkServerConfigWithInstance,
  McpServerConfig,
  OnElicitation,
  Query,
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKUserMessage,
} from '../agentSdkTypes.js'

export { createSdkMcpServer, tool }

export type {
  CanUseTool,
  ElicitationRequest,
  ElicitationResult,
  HookCallbackMatcher,
  HookEvent,
  McpSdkServerConfigWithInstance,
  McpServerConfig,
  OnElicitation,
  Query,
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKUserMessage,
}

export type OAuthCredential = {
  type: 'oauth'
  token: string
}

export type AuthMessage = {
  type: 'auth'
  credential: OAuthCredential
}

export type WebSocketOptions = {
  url: string
  headers?: Record<string, string>
  authMessage?: AuthMessage
}

export type BrowserQueryOptions = {
  prompt: AsyncIterable<SDKUserMessage>
  websocket: WebSocketOptions
  abortController?: AbortController
  canUseTool?: CanUseTool
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>
  mcpServers?: Record<string, McpServerConfig>
  jsonSchema?: Record<string, unknown>
  onElicitation?: OnElicitation
}

export function query(_options: BrowserQueryOptions): Query {
  throw new Error(
    'The browser entrypoint runtime is not implemented in this package build yet.',
  )
}
