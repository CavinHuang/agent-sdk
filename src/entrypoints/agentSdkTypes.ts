/**
 * Main entrypoint for Claude Code Agent SDK types.
 *
 * This file re-exports the public SDK API from:
 * - sdk/coreTypes.ts - Common serializable types (messages, configs)
 * - sdk/runtimeTypes.ts - Non-serializable types (callbacks, interfaces)
 *
 * SDK builders who need control protocol types should import from
 * sdk/controlTypes.ts directly.
 */

import type {
  CallToolResult,
  ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js'

// Control protocol types for SDK builders (bridge subpath consumers)
/** @alpha */
export type {
  SDKControlRequest,
  SDKControlResponse,
  SDKControlInitializeResponse,
  SDKControlReloadPluginsResponse,
} from './sdk/controlTypes.js'
// Re-export core types (common serializable types)
export * from './sdk/coreTypes.js'
// Re-export runtime types (callbacks, interfaces with methods)
export * from './sdk/runtimeTypes.js'

// Re-export settings types (generated from settings JSON schema)
export type { Settings } from './sdk/settingsTypes.generated.js'
// Re-export tool types (all marked @internal until SDK API stabilizes)
export * from './sdk/toolTypes.js'

// ============================================================================
// Functions
// ============================================================================

import type {
  SDKMessage,
  SDKResultMessage,
  SDKSessionInfo,
  SDKUserMessage,
} from './sdk/coreTypes.js'
// Import types needed for function signatures
import type {
  AnyZodRawShape,
  ForkSessionOptions,
  ForkSessionResult,
  GetSessionInfoOptions,
  GetSessionMessagesOptions,
  InferShape,
  InternalOptions,
  InternalQuery,
  ListSessionsOptions,
  McpSdkServerConfigWithInstance,
  Options,
  Query,
  SDKSession,
  SDKSessionOptions,
  SdkMcpToolDefinition,
  SessionMessage,
  SessionMutationOptions,
} from './sdk/runtimeTypes.js'

// These types are already re-exported via `export *` from coreTypes.js / runtimeTypes.js:
//   ListSessionsOptions, GetSessionInfoOptions, SessionMutationOptions,
//   ForkSessionOptions, ForkSessionResult, SDKSessionInfo

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
  return {
    name,
    description,
    inputSchema,
    annotations: extras?.annotations,
    handler,
  }
}

type CreateSdkMcpServerOptions = {
  name: string
  version?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Array<SdkMcpToolDefinition<any>>
}

/**
 * Creates an MCP server instance that can be used with the SDK transport.
 * This allows SDK users to define custom tools that run in the same process.
 *
 * Returns an McpSdkServerConfigWithInstance containing a real McpServer
 * instance from @modelcontextprotocol/sdk. Tools are registered on the
 * McpServer via server.tool().
 *
 * If your SDK MCP calls will run longer than 60s, override CLAUDE_CODE_STREAM_CLOSE_TIMEOUT
 */
export function createSdkMcpServer(
  options: CreateSdkMcpServerOptions,
): McpSdkServerConfigWithInstance {
  // Import McpServer from @modelcontextprotocol/sdk
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
  const server = new McpServer({
    name: options.name,
    version: options.version ?? '1.0.0',
  })

  // Register each tool definition on the McpServer
  if (options.tools) {
    for (const def of options.tools) {
      server.tool(
        def.name,
        def.description,
        def.inputSchema ?? {},
        async (args: any, extra: any) => def.handler(args, extra),
      )
    }
  }

  return {
    type: 'sdk' as const,
    name: options.name,
    instance: server,
  }
}

/**
 * Convert SdkMcpToolDefinition[] from createSdkMcpServer into native Tool objects
 * that can be passed directly to createAgent({ tools: [...] }).
 *
 * This is an Open Agent SDK convenience — the official SDK routes these through
 * the MCP transport, but since we run in-process, direct conversion is simpler.
 */
export function sdkMcpToolsToNativeTools(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolDefs: Array<SdkMcpToolDefinition<any>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  return toolDefs.map(def => ({
    name: def.name,
    description: def.description,
    inputJSONSchema: {
      type: 'object' as const,
      properties: Object.fromEntries(
        Object.entries(def.inputSchema || {}).map(([k, v]: [string, any]) => [
          k,
          { type: 'string', description: v?.description || k },
        ]),
      ),
    },
    get inputSchema() {
      return { safeParse: (v: any) => ({ success: true, data: v }), parse: (v: any) => v }
    },
    async prompt() { return def.description },
    userFacingName: () => def.name,
    async call(input: any) {
      try {
        const result = await def.handler(input, {})
        const text = result.content
          ?.map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
          .join('\n') ?? ''
        return { data: text }
      } catch (e: any) {
        return { data: `Error: ${e.message}` }
      }
    },
    isReadOnly: () => (def.annotations as any)?.readOnly ?? (def.annotations as any)?.readOnlyHint ?? false,
    isConcurrencySafe: () => (def.annotations as any)?.readOnly ?? (def.annotations as any)?.readOnlyHint ?? false,
    isEnabled: () => true,
    renderToolUseMessage: () => null,
    renderToolResultMessage: () => null,
    mapToolResultToToolResultBlockParam: (data: any, id: string) => ({
      type: 'tool_result',
      tool_use_id: id,
      content: typeof data === 'string' ? data : JSON.stringify(data),
    }),
  }))
}

export class AbortError extends Error {}

/**
 * Official SDK-compatible query() function.
 *
 * Returns an AsyncIterable of SDKMessage events with control methods (abort, interrupt).
 * Wraps createAgent() internally for full in-process execution.
 */
/** @internal */
export function query(_params: {
  prompt: string | AsyncIterable<SDKUserMessage>
  options?: InternalOptions
}): InternalQuery
export function query(_params: {
  prompt: string | AsyncIterable<SDKUserMessage>
  options?: Options
}): Query
export function query(params?: any): any {
  if (!params) throw new Error('query() requires { prompt, options? }')
  const { prompt, options = {} } = params

  const { createAgent: createAgentFn } = require('../agent.js')

  const abortController = options.abortController ?? new AbortController()

  const agent = createAgentFn({
    model: options.model,
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    cwd: options.cwd,
    systemPrompt: options.systemPrompt,
    appendSystemPrompt: options.appendSystemPrompt,
    maxTurns: options.maxTurns,
    maxBudgetUsd: options.maxBudgetUsd,
    taskBudget: options.taskBudget,
    thinking: options.thinking,
    effort: options.effort,
    fallbackModel: options.fallbackModel,
    jsonSchema: options.jsonSchema,
    outputFormat: options.outputFormat,
    canUseTool: options.canUseTool,
    permissionMode: options.permissionMode ?? 'bypassPermissions',
    allowDangerouslySkipPermissions: options.allowDangerouslySkipPermissions ?? true,
    allowedTools: options.allowedTools,
    disallowedTools: options.disallowedTools,
    tools: options.tools,
    mcpServers: options.mcpServers,
    hooks: options.hooks,
    onElicitation: options.onElicitation,
    agents: options.agents,
    agent: options.agent,
    env: options.env,
    abortController,
    includePartialMessages: options.includePartialMessages,
    includeHookEvents: options.includeHookEvents,
    resume: options.resume,
    continue: options.continue,
    sessionId: options.sessionId,
    persistSession: options.persistSession,
    settingSources: options.settingSources,
    settings: options.settings,
    plugins: options.plugins,
    sandbox: options.sandbox,
    additionalDirectories: options.additionalDirectories,
    betas: options.betas,
    debug: options.debug,
    debugFile: options.debugFile,
    toolConfig: options.toolConfig,
    promptSuggestions: options.promptSuggestions,
    agentProgressSummaries: options.agentProgressSummaries,
    enableFileCheckpointing: options.enableFileCheckpointing,
    forkSession: options.forkSession,
    resumeSessionAt: options.resumeSessionAt,
    strictMcpConfig: options.strictMcpConfig,
  })

  // Handle AsyncIterable<SDKUserMessage> prompt
  // Since query() is synchronous, we use a wrapper async generator that
  // extracts the first message from the iterable, then processes the rest.
  const isAsyncPrompt = typeof prompt !== 'string' && prompt != null && Symbol.asyncIterator in prompt

  // For string prompts, query directly
  // For async iterable prompts, wrap in a generator that processes them
  function createGen() {
    if (!isAsyncPrompt) {
      return agent.query(prompt as string)
    }
    // Return an async generator that first extracts the initial message,
    // then yields events, then processes follow-ups
    return (async function* () {
      const iter = (prompt as AsyncIterable<SDKUserMessage>)[Symbol.asyncIterator]()
      const first = await iter.next()
      if (first.done || !first.value) return
      const firstMsg = first.value as any
      const firstText = typeof firstMsg === 'string' ? firstMsg : (firstMsg.content ?? firstMsg.message ?? JSON.stringify(firstMsg))
      yield* agent.query(firstText)
      // Process remaining messages as follow-up turns
      for (let next = await iter.next(); !next.done; next = await iter.next()) {
        const msg = next.value as any
        const text = typeof msg === 'string' ? msg : (msg.content ?? JSON.stringify(msg))
        yield* agent.query(text)
      }
    })()
  }
  const gen = createGen()

  // Build a Query-like object matching the official SDK's Query interface
  // Official: Query extends AsyncGenerator<SDKMessage, void>
  const queryObj: any = {
    // AsyncGenerator protocol
    next: (...args: any[]) => gen.next(...args),
    return: (...args: any[]) => gen.return(...args),
    throw: (...args: any[]) => gen.throw(...args),
    [Symbol.asyncIterator]() { return this },

    // Control methods matching official SDK's Query interface
    abort() { abortController.abort() },
    close() { abortController.abort() },
    async interrupt() { abortController.abort() },

    async setModel(_model?: string) {
      agent.setModel?.(_model)
    },
    async setPermissionMode(_mode: string) {
      agent.setPermissionMode?.(_mode as any)
    },
    async setMaxThinkingTokens(_tokens: number | null) {
      agent.setMaxThinkingTokens?.(_tokens)
    },
    async applyFlagSettings(_settings: any) {
      const { setFlagSettingsInline } = await import('../bootstrap/state.js')
      setFlagSettingsInline(_settings)
    },
    async initializationResult() {
      return {}
    },
    async supportedCommands() {
      try {
        const { getCommands } = await import('../commands.js')
        const cmds = await getCommands(options.cwd || process.cwd())
        return cmds.map((c: any) => ({
          name: c.name,
          description: c.description || '',
          aliases: c.aliases || [],
        }))
      } catch { return [] }
    },
    async supportedModels() {
      return []
    },
    async supportedAgents() {
      if (!options.agents) return []
      return Object.entries(options.agents).map(([name, def]: [string, any]) => ({
        name,
        description: def.description || '',
        model: def.model,
        tools: def.tools,
      }))
    },
    async mcpServerStatus() {
      return agent.getMcpStatus?.() ?? []
    },
    async getContextUsage() {
      return { categories: [], totalTokens: 0, maxTokens: 0, rawMaxTokens: 0, percentage: 0 }
    },
    async reloadPlugins() { return {} },
    async accountInfo() { return {} },
    async rewindFiles(_userMessageId?: string, _opts?: { dryRun?: boolean }) {
      if (!_userMessageId) return { canRewind: false }
      try {
        const { fileHistoryCanRestore, fileHistoryRewind, fileHistoryGetDiffStats } = await import('../utils/fileHistory.js')
        const appState = agent.getAppState?.()
        if (!appState?.fileHistory) return { canRewind: false }
        const canRewind = fileHistoryCanRestore(appState.fileHistory, _userMessageId as any)
        if (!canRewind) return { canRewind: false }
        if (_opts?.dryRun) {
          const stats = await fileHistoryGetDiffStats(appState.fileHistory, _userMessageId as any)
          return { canRewind: true, filesChanged: stats?.filesChanged ?? [], insertions: stats?.insertions ?? 0, deletions: stats?.deletions ?? 0 }
        }
        await fileHistoryRewind(
          (updater: any) => agent.setAppState?.((prev: any) => ({ ...prev, fileHistory: updater(prev.fileHistory) })),
          _userMessageId as any,
        )
        return { canRewind: true }
      } catch { return { canRewind: false } }
    },
    async seedReadState(_path: string, _mtime: number) {
      // In-process agents share the file state cache directly via the agent instance;
      // this is a no-op unless the agent exposes a cache seeding method.
    },
    async reconnectMcpServer(_name: string) {
      await agent.reconnectMcpServer?.(_name)
    },
    async toggleMcpServer(_name: string, _enabled: boolean) {
      await agent.toggleMcpServer?.(_name, _enabled)
    },
    async setMcpServers(_servers: Record<string, any>) {
      return agent.setMcpServers?.(_servers) ?? {}
    },
    async streamInput(_stream: AsyncIterable<SDKUserMessage>) {
      // Consume the stream: each message becomes a follow-up query on the agent
      ;(async () => {
        try {
          for await (const msg of _stream) {
            const text = typeof msg === 'string' ? msg : ((msg as any).content ?? JSON.stringify(msg))
            const followUp = agent.query(text)
            for await (const _ of followUp) { /* processed */ }
          }
        } catch { /* stream ended or aborted */ }
      })()
    },
    async stopTask() {},
  }

  return queryObj
}

/**
 * V2 API - UNSTABLE
 * Create a persistent session for multi-turn conversations.
 * @alpha
 */
export function unstable_v2_createSession(
  _options: SDKSessionOptions,
): SDKSession {
  const { createAgent: createAgentFn } = require('../agent.js')
  const agent = createAgentFn({
    model: _options.model,
    apiKey: _options.apiKey,
    cwd: _options.cwd,
    env: _options.env,
    allowedTools: _options.allowedTools,
    disallowedTools: _options.disallowedTools,
    canUseTool: _options.canUseTool,
    hooks: _options.hooks,
    permissionMode: _options.permissionMode ?? 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    persistSession: true,
  })

  const sessionId = require('crypto').randomUUID()
  let currentGen: AsyncGenerator<any, void> | null = null
  let closed = false

  return {
    get sessionId() { return sessionId },
    async send(message: string | any) {
      if (closed) throw new Error('Session is closed')
      const prompt = typeof message === 'string' ? message : message?.content ?? JSON.stringify(message)
      currentGen = agent.query(prompt)
    },
    async *stream() {
      if (!currentGen) return
      yield* currentGen
      currentGen = null
    },
    close() {
      closed = true
      agent.abort?.()
    },
    async [Symbol.asyncDispose]() {
      this.close()
    },
  } satisfies SDKSession
}

/**
 * V2 API - UNSTABLE
 * Resume an existing session by ID.
 * @alpha
 */
export function unstable_v2_resumeSession(
  _sessionId: string,
  _options: SDKSessionOptions,
): SDKSession {
  const { createAgent: createAgentFn } = require('../agent.js')
  const agent = createAgentFn({
    model: _options.model,
    apiKey: _options.apiKey,
    cwd: _options.cwd,
    env: _options.env,
    allowedTools: _options.allowedTools,
    disallowedTools: _options.disallowedTools,
    canUseTool: _options.canUseTool,
    hooks: _options.hooks,
    permissionMode: _options.permissionMode ?? 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    resume: _sessionId,
    persistSession: true,
  })

  let currentGen: AsyncGenerator<any, void> | null = null
  let closed = false

  return {
    get sessionId() { return _sessionId },
    async send(message: string | any) {
      if (closed) throw new Error('Session is closed')
      const prompt = typeof message === 'string' ? message : message?.content ?? JSON.stringify(message)
      currentGen = agent.query(prompt)
    },
    async *stream() {
      if (!currentGen) return
      yield* currentGen
      currentGen = null
    },
    close() {
      closed = true
      agent.abort?.()
    },
    async [Symbol.asyncDispose]() {
      this.close()
    },
  } satisfies SDKSession
}

/**
 * V2 API - UNSTABLE
 * One-shot convenience function for single prompts.
 * @alpha
 */
export async function unstable_v2_prompt(
  _message: string,
  _options: SDKSessionOptions,
): Promise<SDKResultMessage> {
  const { createAgent: createAgentFn } = await import('../agent.js')
  const agent = createAgentFn({
    model: _options.model,
    apiKey: _options.apiKey,
    permissionMode: _options.permissionMode ?? 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    cwd: _options.cwd,
    allowedTools: _options.allowedTools,
    disallowedTools: _options.disallowedTools,
    canUseTool: _options.canUseTool,
    hooks: _options.hooks,
    env: _options.env,
  })
  const result = await agent.prompt(_message)
  return {
    type: 'result',
    subtype: 'success',
    result: result.text,
    is_error: false,
    duration_ms: result.duration_ms,
    duration_api_ms: result.duration_ms,
    num_turns: result.num_turns,
    stop_reason: null,
    total_cost_usd: result.total_cost_usd,
    usage: {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 },
      server_tool_use: { web_search_requests: 0 },
      service_tier: 'standard' as const,
    },
    modelUsage: {},
    permission_denials: [],
    uuid: result.session_id || '',
    session_id: result.session_id || '',
  } as SDKResultMessage
}

/**
 * Reads a session's conversation messages from its JSONL transcript file.
 *
 * Searches the ~/.claude/projects/ directory for the session transcript,
 * then parses it. Falls back to empty array on any error.
 */
export async function getSessionMessages(
  _sessionId: string,
  _options?: GetSessionMessagesOptions,
): Promise<SessionMessage[]> {
  try {
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')
    const { getProjectDir } = await import('../utils/sessionStoragePortable.js')
    const projectDir = getProjectDir(_options?.dir || process.cwd())
    const filePath = join(projectDir, `${_sessionId}.jsonl`)
    const content = await readFile(filePath, 'utf-8')
    const entries = content.trim().split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line) } catch { return null } })
      .filter(Boolean)
    const msgs = entries
      .filter((e: any) => {
        if (_options?.includeSystemMessages) return true
        return e.type === 'user' || e.type === 'assistant'
      })
      .slice(_options?.offset ?? 0, _options?.limit ? (_options.offset ?? 0) + _options.limit : undefined)
    return msgs as SessionMessage[]
  } catch {
    return []
  }
}

/**
 * List sessions with metadata.
 */
export async function listSessions(
  options?: ListSessionsOptions,
): Promise<SDKSessionInfo[]> {
  try {
    const { listSessionsImpl } = await import('../utils/listSessionsImpl.js')
    return await listSessionsImpl(options) as any
  } catch {
    return []
  }
}

/**
 * Reads metadata for a single session by ID.
 */
export async function getSessionInfo(
  sessionId: string,
  _options?: GetSessionInfoOptions,
): Promise<SDKSessionInfo | undefined> {
  try {
    const sessions = await listSessions({ dir: _options?.dir, limit: 1000 })
    return sessions.find((s: any) => s.sessionId === sessionId)
  } catch {
    return undefined
  }
}

/**
 * Rename a session. Appends a custom-title entry to the session JSONL.
 */
export async function renameSession(
  _sessionId: string,
  _title: string,
  _options?: SessionMutationOptions,
): Promise<void> {
  try {
    const { appendFile } = await import('fs/promises')
    const { join } = await import('path')
    const { getProjectDir } = await import('../utils/sessionStoragePortable.js')
    const projectDir = getProjectDir(_options?.dir || process.cwd())
    const filePath = join(projectDir, `${_sessionId}.jsonl`)
    await appendFile(filePath, JSON.stringify({ type: 'custom-title', title: _title }) + '\n')
  } catch {
    // Best-effort
  }
}

/**
 * Tag a session. Pass null to clear.
 */
export async function tagSession(
  _sessionId: string,
  _tag: string | null,
  _options?: SessionMutationOptions,
): Promise<void> {
  try {
    const { appendFile } = await import('fs/promises')
    const { join } = await import('path')
    const { getProjectDir } = await import('../utils/sessionStoragePortable.js')
    const projectDir = getProjectDir(_options?.dir || process.cwd())
    const filePath = join(projectDir, `${_sessionId}.jsonl`)
    await appendFile(filePath, JSON.stringify({ type: 'custom-tag', tag: _tag }) + '\n')
  } catch {
    // Best-effort
  }
}

/**
 * Fork a session by copying its JSONL transcript to a new session ID.
 *
 * If upToMessageId is provided, only entries up to (and including) that UUID
 * are copied. Otherwise the entire transcript is duplicated.
 */
export async function forkSession(
  _sessionId: string,
  _options?: ForkSessionOptions,
): Promise<ForkSessionResult> {
  const { readFile, writeFile, appendFile } = await import('fs/promises')
  const { join } = await import('path')
  const { randomUUID } = await import('crypto')
  const { getProjectDir } = await import('../utils/sessionStoragePortable.js')

  const projectDir = getProjectDir(_options?.dir || process.cwd())
  const srcPath = join(projectDir, `${_sessionId}.jsonl`)
  const newSessionId = randomUUID()
  const dstPath = join(projectDir, `${newSessionId}.jsonl`)

  const content = await readFile(srcPath, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)

  let selectedLines = lines
  if (_options?.upToMessageId) {
    const cutoff = lines.findIndex(line => {
      try {
        const entry = JSON.parse(line)
        return entry.uuid === _options.upToMessageId
      } catch { return false }
    })
    if (cutoff >= 0) {
      selectedLines = lines.slice(0, cutoff + 1)
    }
  }

  await writeFile(dstPath, selectedLines.join('\n') + '\n')

  const title = _options?.title ?? `Fork of ${_sessionId}`
  await appendFile(dstPath, JSON.stringify({ type: 'custom-title', title }) + '\n')

  return { sessionId: newSessionId }
}

/**
 * Options for retrieving subagent messages.
 */
export type GetSubagentMessagesOptions = {
  dir?: string
  limit?: number
  offset?: number
}

/**
 * Options for listing subagents.
 */
export type ListSubagentsOptions = {
  dir?: string
}

/**
 * Reads a subagent's conversation messages from its JSONL transcript.
 *
 * Subagent transcripts are stored at:
 *   <projectDir>/<sessionId>/subagents/agent-<agentId>.jsonl
 */
export async function getSubagentMessages(
  _sessionId: string,
  _agentId: string,
  _options?: GetSubagentMessagesOptions,
): Promise<SessionMessage[]> {
  try {
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')
    const { getProjectDir } = await import('../utils/sessionStoragePortable.js')
    const projectDir = getProjectDir(_options?.dir || process.cwd())
    const filePath = join(projectDir, _sessionId, 'subagents', `agent-${_agentId}.jsonl`)
    const content = await readFile(filePath, 'utf-8')
    const entries = content.trim().split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line) } catch { return null } })
      .filter(Boolean)
    return entries
      .slice(_options?.offset ?? 0, _options?.limit ? (_options.offset ?? 0) + _options.limit : undefined) as SessionMessage[]
  } catch {
    return []
  }
}

/**
 * List subagent IDs for a session.
 *
 * Scans <projectDir>/<sessionId>/subagents/ for agent-*.jsonl files,
 * returns agent IDs.
 */
export async function listSubagents(
  _sessionId: string,
  _options?: ListSubagentsOptions,
): Promise<string[]> {
  try {
    const { readdir } = await import('fs/promises')
    const { join } = await import('path')
    const { getProjectDir } = await import('../utils/sessionStoragePortable.js')
    const projectDir = getProjectDir(_options?.dir || process.cwd())
    const subagentsDir = join(projectDir, _sessionId, 'subagents')
    const entries = await readdir(subagentsDir)
    return entries
      .filter(f => f.startsWith('agent-') && f.endsWith('.jsonl'))
      .map(f => f.replace(/^agent-/, '').replace(/\.jsonl$/, ''))
  } catch {
    return []
  }
}

// ============================================================================
// Assistant daemon primitives (internal)
// ============================================================================

/**
 * A scheduled task from `<dir>/.claude/scheduled_tasks.json`.
 * @internal
 */
export type CronTask = {
  id: string
  cron: string
  prompt: string
  createdAt: number
  recurring?: boolean
}

/**
 * Cron scheduler tuning knobs (jitter + expiry). Sourced at runtime from the
 * `tengu_kairos_cron_config` GrowthBook config in CLI sessions; daemon hosts
 * pass this through `watchScheduledTasks({ getJitterConfig })` to get the
 * same tuning.
 * @internal
 */
export type CronJitterConfig = {
  recurringFrac: number
  recurringCapMs: number
  oneShotMaxMs: number
  oneShotFloorMs: number
  oneShotMinuteMod: number
  recurringMaxAgeMs: number
}

/**
 * Event yielded by `watchScheduledTasks()`.
 * @internal
 */
export type ScheduledTaskEvent =
  | { type: 'fire'; task: CronTask }
  | { type: 'missed'; tasks: CronTask[] }

/**
 * Handle returned by `watchScheduledTasks()`.
 * @internal
 */
export type ScheduledTasksHandle = {
  /** Async stream of fire/missed events. Drain with `for await`. */
  events(): AsyncGenerator<ScheduledTaskEvent>
  /**
   * Epoch ms of the soonest scheduled fire across all loaded tasks, or null
   * if nothing is scheduled. Useful for deciding whether to tear down an
   * idle agent subprocess or keep it warm for an imminent fire.
   */
  getNextFireTime(): number | null
}

/**
 * Watch `<dir>/.claude/scheduled_tasks.json` and yield events as tasks fire.
 *
 * Acquires the per-directory scheduler lock (PID-based liveness) so a REPL
 * session in the same dir won't double-fire. Releases the lock and closes
 * the file watcher when the signal aborts.
 *
 * - `fire` — a task whose cron schedule was met. One-shot tasks are already
 *   deleted from the file when this yields; recurring tasks are rescheduled
 *   (or deleted if aged out).
 * - `missed` — one-shot tasks whose window passed while the daemon was down.
 *   Yielded once on initial load; a background delete removes them from the
 *   file shortly after.
 *
 * Intended for daemon architectures that own the scheduler externally and
 * spawn the agent via `query()`; the agent subprocess (`-p` mode) does not
 * run its own scheduler.
 *
 * @internal
 */
export function watchScheduledTasks(_opts: {
  dir: string
  signal: AbortSignal
  getJitterConfig?: () => CronJitterConfig
}): ScheduledTasksHandle {
  throw new Error('watchScheduledTasks is a Claude Code CLI feature and is not applicable to Open Agent SDK (in-process execution)')
}

/**
 * Format missed one-shot tasks into a prompt that asks the model to confirm
 * with the user (via AskUserQuestion) before executing.
 * @internal
 */
export function buildMissedTaskNotification(_missed: CronTask[]): string {
  throw new Error('buildMissedTaskNotification is a Claude Code CLI feature and is not applicable to Open Agent SDK')
}

/**
 * A user message typed on claude.ai, extracted from the bridge WS.
 * @internal
 */
export type InboundPrompt = {
  content: string | unknown[]
  uuid?: string
}

/**
 * Options for connectRemoteControl.
 * @internal
 */
export type ConnectRemoteControlOptions = {
  dir: string
  name?: string
  workerType?: string
  branch?: string
  gitRepoUrl?: string | null
  getAccessToken: () => string | undefined
  baseUrl: string
  orgUUID: string
  model: string
}

/**
 * Handle returned by connectRemoteControl. Write query() yields in,
 * read inbound prompts out. See src/assistant/daemonBridge.ts for full
 * field documentation.
 * @internal
 */
export type RemoteControlHandle = {
  sessionUrl: string
  environmentId: string
  bridgeSessionId: string
  write(msg: SDKMessage): void
  sendResult(): void
  sendControlRequest(req: unknown): void
  sendControlResponse(res: unknown): void
  sendControlCancelRequest(requestId: string): void
  inboundPrompts(): AsyncGenerator<InboundPrompt>
  controlRequests(): AsyncGenerator<unknown>
  permissionResponses(): AsyncGenerator<unknown>
  onStateChange(
    cb: (
      state: 'ready' | 'connected' | 'reconnecting' | 'failed',
      detail?: string,
    ) => void,
  ): void
  teardown(): Promise<void>
}

/**
 * Hold a claude.ai remote-control bridge connection from a daemon process.
 *
 * The daemon owns the WebSocket in the PARENT process — if the agent
 * subprocess (spawned via `query()`) crashes, the daemon respawns it while
 * claude.ai keeps the same session. Contrast with `query.enableRemoteControl`
 * which puts the WS in the CHILD process (dies with the agent).
 *
 * Pipe `query()` yields through `write()` + `sendResult()`. Read
 * `inboundPrompts()` (user typed on claude.ai) into `query()`'s input
 * stream. Handle `controlRequests()` locally (interrupt → abort, set_model
 * → reconfigure).
 *
 * Skips the `tengu_ccr_bridge` gate and policy-limits check — @internal
 * caller is pre-entitled. OAuth is still required (env var or keychain).
 *
 * Returns null on no-OAuth or registration failure.
 *
 * @internal
 */
export async function connectRemoteControl(
  _opts: ConnectRemoteControlOptions,
): Promise<RemoteControlHandle | null> {
  throw new Error('connectRemoteControl is a Claude Code CLI feature and is not applicable to Open Agent SDK')
}
