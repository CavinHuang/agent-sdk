/**
 * Runtime types for SDK compatibility layer.
 *
 * These types are derived from @anthropic-ai/claude-agent-sdk@0.2.90 sdk.d.ts
 * to ensure API-level compatibility. Users should be able to import these
 * and use them interchangeably with the official SDK.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolAnnotations, CallToolResult } from '@modelcontextprotocol/sdk/types.js'

import type {
  AgentDefinition,
  AgentInfo,
  AccountInfo,
  CanUseTool,
  EffortLevel,
  HookCallbackMatcher,
  HookEvent,
  McpServerConfig,
  McpServerStatus,
  McpSetServersResult,
  ModelInfo,
  OnElicitation,
  OutputFormat,
  PermissionMode,
  RewindFilesResult,
  SdkBeta,
  SdkPluginConfig,
  SDKControlGetContextUsageResponse,
  SDKMessage,
  SDKUserMessage,
  SlashCommand,
  ThinkingConfig,
  SettingSource,
  ToolConfig,
} from './coreTypes.generated.js'

import type { SandboxSettings } from './coreTypes.js'

import type {
  SDKControlInitializeResponse,
  SDKControlReloadPluginsResponse,
} from './controlTypes.js'

import type { Settings } from './settingsTypes.generated.js'

export type { EffortLevel } from './coreTypes.generated.js'

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
// Process / transport (official SDK)
// ---------------------------------------------------------------------------

export class AbortError extends Error {}

export interface SpawnedProcess {
  stdin: import('stream').Writable
  stdout: import('stream').Readable
  readonly killed: boolean
  readonly exitCode: number | null
  kill(signal: NodeJS.Signals): boolean
  on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): void
  on(event: 'error', listener: (error: Error) => void): void
  once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): void
  once(event: 'error', listener: (error: Error) => void): void
  off(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): void
  off(event: 'error', listener: (error: Error) => void): void
}

export interface SpawnOptions {
  command: string
  args: string[]
  cwd?: string
  env: { [envVar: string]: string | undefined }
  signal: AbortSignal
}

export interface Transport {
  write(data: string): void | Promise<void>
  close(): void
  isReady(): boolean
  readMessages(): AsyncGenerator<any, void, unknown>
  endInput(): void
}

// ---------------------------------------------------------------------------
// Query / Options (official SDK's main API types)
// ---------------------------------------------------------------------------

export type Options = {
  abortController?: AbortController
  additionalDirectories?: string[]
  agent?: string
  agents?: Record<string, AgentDefinition>
  allowedTools?: string[]
  canUseTool?: CanUseTool
  continue?: boolean
  cwd?: string
  disallowedTools?: string[]
  tools?: string[] | { type: 'preset'; preset: 'claude_code' }
  env?: { [envVar: string]: string | undefined }
  executable?: 'bun' | 'deno' | 'node'
  executableArgs?: string[]
  extraArgs?: Record<string, string | null>
  fallbackModel?: string
  enableFileCheckpointing?: boolean
  toolConfig?: ToolConfig
  forkSession?: boolean
  betas?: SdkBeta[]
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>
  onElicitation?: OnElicitation
  persistSession?: boolean
  includeHookEvents?: boolean
  includePartialMessages?: boolean
  thinking?: ThinkingConfig
  effort?: EffortLevel
  maxThinkingTokens?: number
  maxTurns?: number
  maxBudgetUsd?: number
  taskBudget?: { total: number }
  mcpServers?: Record<string, McpServerConfig>
  model?: string
  outputFormat?: OutputFormat
  pathToClaudeCodeExecutable?: string
  permissionMode?: PermissionMode
  allowDangerouslySkipPermissions?: boolean
  permissionPromptToolName?: string
  plugins?: SdkPluginConfig[]
  promptSuggestions?: boolean
  agentProgressSummaries?: boolean
  resume?: string
  sessionId?: string
  resumeSessionAt?: string
  sandbox?: SandboxSettings
  settings?: string | Settings
  settingSources?: SettingSource[]
  debug?: boolean
  debugFile?: string
  stderr?: (data: string) => void
  strictMcpConfig?: boolean
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string }
  spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess
}

export interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>
  setPermissionMode(mode: PermissionMode): Promise<void>
  setModel(model?: string): Promise<void>
  setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>
  applyFlagSettings(settings: Settings): Promise<void>
  initializationResult(): Promise<SDKControlInitializeResponse>
  supportedCommands(): Promise<SlashCommand[]>
  supportedModels(): Promise<ModelInfo[]>
  supportedAgents(): Promise<AgentInfo[]>
  mcpServerStatus(): Promise<McpServerStatus[]>
  getContextUsage(): Promise<SDKControlGetContextUsageResponse>
  reloadPlugins(): Promise<SDKControlReloadPluginsResponse>
  accountInfo(): Promise<AccountInfo>
  rewindFiles(userMessageId: string, options?: { dryRun?: boolean }): Promise<RewindFilesResult>
  seedReadState(path: string, mtime: number): Promise<void>
  reconnectMcpServer(serverName: string): Promise<void>
  toggleMcpServer(serverName: string, enabled: boolean): Promise<void>
  setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>
  streamInput(stream: AsyncIterable<SDKUserMessage>): Promise<void>
  stopTask(taskId: string): Promise<void>
  close(): void
}

// ---------------------------------------------------------------------------
// V2 Session API (unstable)
// ---------------------------------------------------------------------------

export type SDKSessionOptions = {
  model: string
  pathToClaudeCodeExecutable?: string
  executable?: 'node' | 'bun'
  executableArgs?: string[]
  env?: { [envVar: string]: string | undefined }
  allowedTools?: string[]
  disallowedTools?: string[]
  canUseTool?: CanUseTool
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>
  permissionMode?: PermissionMode
  cwd?: string
  apiKey?: string
}

export interface SDKSession {
  readonly sessionId: string
  send(message: string | SDKUserMessage): Promise<void>
  stream(): AsyncGenerator<SDKMessage, void>
  close(): void
  [Symbol.asyncDispose](): Promise<void>
}
