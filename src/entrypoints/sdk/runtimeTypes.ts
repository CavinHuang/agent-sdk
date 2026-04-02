/**
 * Runtime types for SDK compatibility layer.
 *
 * These types are derived from @anthropic-ai/claude-agent-sdk@0.2.89 sdk.d.ts
 * to ensure API-level compatibility. Users should be able to import these
 * and use them interchangeably with the official SDK.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolAnnotations, CallToolResult } from '@modelcontextprotocol/sdk/types.js'

// ---------------------------------------------------------------------------
// Effort
// ---------------------------------------------------------------------------

export type EffortLevel = 'low' | 'medium' | 'high' | 'max'

// ---------------------------------------------------------------------------
// Zod interop
// ---------------------------------------------------------------------------

export type AnyZodRawShape = Record<string, any>

export type InferShape<T extends AnyZodRawShape> = {
  [K in keyof T]: T[K] extends { _output: infer O } ? O : any
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export type SessionMutationOptions = {
  dir?: string
}

export type ForkSessionOptions = SessionMutationOptions & {
  upToMessageId?: string
  title?: string
}

export type ForkSessionResult = {
  sessionId: string
}

export type GetSessionInfoOptions = {
  dir?: string
}

export type GetSessionMessagesOptions = {
  dir?: string
  limit?: number
  offset?: number
  includeSystemMessages?: boolean
}

export type ListSessionsOptions = {
  dir?: string
  limit?: number
  offset?: number
  includeWorktrees?: boolean
}

export type SessionMessage = {
  type: 'user' | 'assistant' | 'system'
  uuid: string
  session_id: string
  message: unknown
  parent_tool_use_id: null
}

// ---------------------------------------------------------------------------
// MCP
// ---------------------------------------------------------------------------

export type McpSdkServerConfig = {
  type: 'sdk'
  name: string
}

export type McpSdkServerConfigWithInstance = McpSdkServerConfig & {
  instance: McpServer
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export type SdkMcpToolDefinition<Schema extends AnyZodRawShape = AnyZodRawShape> = {
  name: string
  description: string
  inputSchema: Schema
  annotations?: ToolAnnotations
  _meta?: Record<string, unknown>
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>
}

// ---------------------------------------------------------------------------
// Query / Options (official SDK's main API types)
// ---------------------------------------------------------------------------

/**
 * Options type — matches official @anthropic-ai/claude-agent-sdk Options.
 * Only the most commonly-used fields are declared here; the full set is in
 * AgentOptions (agent.ts) and sdk.d.ts.
 */
export type Options = Record<string, any>

/** @internal */
export type InternalOptions = Options & { _internal?: boolean }

/**
 * Query interface — matches official SDK's Query extends AsyncGenerator<SDKMessage, void>.
 * In Open Agent SDK, this is the return type of query().
 */
export type Query = AsyncGenerator<any, void, unknown> & {
  abort(): void
  close(): void
  interrupt(): Promise<void>
  setModel(model?: string): Promise<void>
  setPermissionMode(mode: string): Promise<void>
  setMaxThinkingTokens(tokens: number | null): Promise<void>
  applyFlagSettings(settings: any): Promise<void>
  initializationResult(): Promise<any>
  supportedCommands(): Promise<any[]>
  supportedModels(): Promise<any[]>
  supportedAgents(): Promise<any[]>
  mcpServerStatus(): Promise<any[]>
  getContextUsage(): Promise<any>
  reloadPlugins(): Promise<any>
  accountInfo(): Promise<any>
  rewindFiles(userMessageId: string, options?: { dryRun?: boolean }): Promise<any>
  seedReadState(path: string, mtime: number): Promise<void>
  reconnectMcpServer(serverName: string): Promise<void>
  toggleMcpServer(serverName: string, enabled: boolean): Promise<void>
  setMcpServers(servers: Record<string, any>): Promise<any>
  streamInput(stream: AsyncIterable<any>): Promise<void>
  stopTask(taskId: string): Promise<void>
}

/** @internal */
export type InternalQuery = Query

// ---------------------------------------------------------------------------
// V2 Session API (unstable)
// ---------------------------------------------------------------------------

export type SDKSessionOptions = {
  model: string
  pathToClaudeCodeExecutable?: string
  executable?: 'node' | 'bun'
  executableArgs?: string[]
  env?: Record<string, string | undefined>
  allowedTools?: string[]
  disallowedTools?: string[]
  canUseTool?: any
  hooks?: any
  permissionMode?: string
  cwd?: string
  apiKey?: string
}

export interface SDKSession {
  readonly sessionId: string
  send(message: string | any): Promise<void>
  stream(): AsyncGenerator<any, void>
  close(): void
  [Symbol.asyncDispose](): Promise<void>
}
