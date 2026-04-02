// @ts-nocheck
/**
 * Open Agent SDK - High-level Agent API
 *
 * Provides a simple createAgent() interface that wraps the full
 * Claude Code engine (QueryEngine, tools, services).
 *
 * Usage:
 *   import { createAgent } from '@shipany/open-agent-sdk'
 *
 *   const agent = createAgent({
 *     model: 'claude-sonnet-4-6',
 *     apiKey: process.env.ANTHROPIC_API_KEY,
 *   })
 *
 *   // Streaming
 *   for await (const event of agent.query('Analyze this codebase')) {
 *     if (event.type === 'assistant') console.log(event)
 *   }
 *
 *   // Simple
 *   const result = await agent.prompt('What does this code do?')
 *   console.log(result.text)
 */

import './setup-globals.js'

import { ask, type SDKMessage } from './QueryEngine.js'
import { getAllBaseTools } from './tools.js'
import { getCommands } from './commands.js'
import { getDefaultAppState, type AppState } from './state/AppStateStore.js'
import { createFileStateCacheWithSizeLimit, type FileStateCache } from './utils/fileStateCache.js'
import type { Tool, Tools } from './Tool.js'
import type { Message } from './types/message.js'
import type { CanUseToolFn } from './hooks/useCanUseTool.js'
import type { ThinkingConfig } from './utils/thinking.js'
import type { HookEvent, HookInput, HookJSONOutput, HookCallback, HookCallbackMatcher } from './types/hooks.js'
import {
  registerHookCallbacks,
  setSdkBetas,
  switchSession,
  setSessionPersistenceDisabled,
  setAllowedSettingSources,
  setAdditionalDirectoriesForClaudeMd,
  setQuestionPreviewFormat,
  setSdkAgentProgressSummariesEnabled,
  setFlagSettingsPath,
  setFlagSettingsInline,
  setInlinePlugins,
} from './bootstrap/state.js'
import { filterAllowedSdkBetas } from './utils/betas.js'
import { setAllHookEventsEnabled } from './utils/hooks/hookEvents.js'
import { parseEffortValue, type EffortValue } from './utils/effort.js'
import type { PermissionMode } from './utils/permissions/types.js'
import type { AgentMemoryScope } from './components/agents/types.js'

// ============================================================================
// Types
// ============================================================================

/**
 * SDK-compatible hook callback.
 * Matches official @anthropic-ai/claude-agent-sdk HookCallback signature exactly.
 */
export type SDKHookCallback = (
  input: HookInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal },
) => Promise<HookJSONOutput>

/**
 * SDK-compatible hook callback matcher.
 * Matches official @anthropic-ai/claude-agent-sdk HookCallbackMatcher interface.
 */
export type SDKHookMatcher = {
  matcher?: string
  hooks: SDKHookCallback[]
  timeout?: number
}

/**
 * SDK-compatible permission result.
 * Matches official @anthropic-ai/claude-agent-sdk PermissionResult.
 */
export type SDKPermissionResult = {
  behavior: 'allow'
  updatedInput?: Record<string, unknown>
  updatedPermissions?: any[]
  toolUseID?: string
} | {
  behavior: 'deny'
  message: string
  interrupt?: boolean
  toolUseID?: string
}

/**
 * SDK-compatible canUseTool callback.
 * Matches official @anthropic-ai/claude-agent-sdk CanUseTool signature exactly:
 *   (toolName, input, options) => Promise<PermissionResult>
 *
 * options includes: signal, suggestions?, blockedPath?, decisionReason?,
 *   title?, displayName?, description?, toolUseID, agentID?
 */
export type SDKCanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal
    suggestions?: any[]
    blockedPath?: string
    decisionReason?: string
    title?: string
    displayName?: string
    description?: string
    toolUseID: string
    agentID?: string
  },
) => Promise<SDKPermissionResult>

/**
 * Subagent definition compatible with official Claude Agent SDK.
 * All fields from the official AgentDefinition are supported.
 */
export type SDKAgentDefinition = {
  description: string
  prompt: string
  tools?: string[]
  disallowedTools?: string[]
  model?: string
  mcpServers?: Array<string | Record<string, McpServerConfig>>
  skills?: string[]
  initialPrompt?: string
  maxTurns?: number
  background?: boolean
  memory?: AgentMemoryScope
  effort?: EffortValue
  permissionMode?: PermissionMode
  criticalSystemReminder_EXPERIMENTAL?: string
}

export type AgentOptions = {
  /** Model ID (e.g. 'claude-sonnet-4-6', 'claude-opus-4-6') */
  model?: string
  /** Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
  apiKey?: string
  /** API base URL override (for third-party providers) */
  baseURL?: string
  /** Working directory for file/shell tools */
  cwd?: string

  // --- System Prompt ---
  /** System prompt override. String or preset object. */
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string }
  /** Append to default system prompt */
  appendSystemPrompt?: string

  // --- Tools ---
  /** Available tools as Tool objects. Defaults to all built-in tools. */
  tools?: Tools | string[] | { type: 'preset'; preset: 'claude_code' }
  /** Tool names to pre-approve without prompting. */
  allowedTools?: string[]
  /** Tool names to explicitly disallow. */
  disallowedTools?: string[]

  // --- Model / Reasoning ---
  /** Maximum number of agentic turns per query */
  maxTurns?: number
  /** Maximum USD budget per query */
  maxBudgetUsd?: number
  /** Extended thinking configuration */
  thinking?: ThinkingConfig
  /**
   * Effort level controlling reasoning depth.
   * 'low' | 'medium' | 'high' | 'max' or a numeric value.
   */
  effort?: EffortValue
  /** Fallback model if primary is unavailable */
  fallbackModel?: string
  /** API-side task budget in tokens (alpha) */
  taskBudget?: { total: number }
  /** Beta features (e.g. 'context-1m-2025-08-07') */
  betas?: string[]

  // --- Output ---
  /** Structured output JSON schema (Open Agent SDK style) */
  jsonSchema?: Record<string, unknown>
  /** Structured output format (official SDK style) */
  outputFormat?: { type: 'json_schema'; schema: Record<string, unknown> }

  // --- Permissions ---
  /**
   * Permission handler callback.
   * Accepts BOTH the official SDK signature (toolName, input, options)
   * and the engine internal signature.
   */
  canUseTool?: SDKCanUseTool | CanUseToolFn
  /**
   * Permission mode controlling tool approval behavior.
   * - 'default': use canUseTool callback for approval decisions
   * - 'acceptEdits': auto-approve file edits, ask for other actions
   * - 'bypassPermissions': run every tool without prompts
   * - 'plan': require explicit approval for all actions
   * - 'dontAsk': deny if not pre-approved, never prompt
   */
  permissionMode?: PermissionMode
  /** Safety flag: must be true when using permissionMode: 'bypassPermissions' */
  allowDangerouslySkipPermissions?: boolean

  // --- Streaming / Control ---
  /** Abort signal for cancellation (Open Agent SDK style) */
  abortSignal?: AbortSignal
  /** Abort controller (official SDK style — takes precedence over abortSignal) */
  abortController?: AbortController
  /** Whether to include partial streaming events */
  includePartialMessages?: boolean
  /** Include hook lifecycle events in output stream */
  includeHookEvents?: boolean

  // --- Environment ---
  /**
   * Environment variables (compatible with @anthropic-ai/claude-agent-sdk).
   * Supports: ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL,
   * ANTHROPIC_MODEL, etc.
   */
  env?: Record<string, string | undefined>

  // --- MCP ---
  /**
   * MCP server configurations. Supports stdio, SSE, and streamable HTTP transports.
   */
  mcpServers?: Record<string, McpServerConfig>
  /** Callback for handling MCP elicitation requests */
  onElicitation?: (request: any, options: { signal: AbortSignal }) => Promise<any>

  // --- Subagents ---
  /**
   * Custom subagent definitions. Full AgentDefinition fields supported.
   */
  agents?: Record<string, SDKAgentDefinition>
  /** Named agent for the main thread (must be defined in `agents`) */
  agent?: string

  // --- Hooks ---
  /**
   * Lifecycle hooks for intercepting agent behavior.
   * Supports all 26 hook events from the official SDK.
   *
   * @example
   * ```typescript
   * hooks: {
   *   PostToolUse: [{ matcher: 'Edit|Write', hooks: [logFileChange] }],
   *   PreToolUse: [{ hooks: [auditAllCalls] }],
   *   Stop: [{ hooks: [onSessionEnd] }],
   * }
   * ```
   */
  hooks?: Partial<Record<HookEvent, SDKHookMatcher[]>>

  // --- Session ---
  /** Resume a previous session by ID */
  resume?: string
  /** Continue the most recent conversation in the current directory */
  continue?: boolean
  /** Custom session ID (must be valid UUID) */
  sessionId?: string
  /** Control session persistence to disk */
  persistSession?: boolean
  /**
   * Load project settings from filesystem (CLAUDE.md, .claude/ directory).
   * Set to ['project'] to enable.
   */
  settingSources?: string[]
  /** Additional directories Claude can access beyond cwd */
  additionalDirectories?: string[]

  // --- Settings / Plugins ---
  /** Additional settings (object or path to JSON file) */
  settings?: string | Record<string, any>
  /** Plugin configurations */
  plugins?: Array<{ type: 'local'; path: string }>
  /** Sandbox settings for command execution isolation */
  sandbox?: Record<string, any>
  /** Enforce strict MCP server config validation */
  strictMcpConfig?: boolean
  /** Per-tool configuration */
  toolConfig?: Record<string, any>
  /** Enable prompt suggestions after each turn */
  promptSuggestions?: boolean
  /** Enable periodic AI-generated progress summaries for subagents */
  agentProgressSummaries?: boolean
  /** Enable file checkpointing for rewindFiles() */
  enableFileCheckpointing?: boolean
  /** When resuming, fork to a new session instead of continuing */
  forkSession?: boolean
  /** Resume only up to this message UUID */
  resumeSessionAt?: string
  /** Callback for stderr output */
  stderr?: (data: string) => void

  // --- Debug ---
  /** Enable debug logging */
  debug?: boolean
  /** Write debug logs to file */
  debugFile?: string
}

type McpServerConfig =
  | { command: string; args?: string[]; env?: Record<string, string>; type?: 'stdio' }
  | { type: 'sse'; url: string; headers?: Record<string, string> }
  | { type: 'http'; url: string; headers?: Record<string, string> }

export type QueryResult = {
  /** Final text output from the assistant */
  text: string
  /** Token usage */
  usage: { input_tokens: number; output_tokens: number }
  /** Number of agentic turns */
  num_turns: number
  /** Duration in milliseconds */
  duration_ms: number
  /** All conversation messages */
  messages: Message[]
  /** Session ID (for resume) */
  session_id: string
  /** Total cost in USD */
  total_cost_usd: number
}

// ============================================================================
// Agent class
// ============================================================================

export class Agent {
  private options: AgentOptions
  private appState: AppState
  private readFileCache: FileStateCache
  private mutableMessages: Message[]
  private tools: Tools
  private resolvedModel: string
  private mcpClients: any[]
  private _initialized: Promise<void>
  private _hooksRegistered = false

  constructor(options: AgentOptions) {
    this.options = options
    this.appState = getDefaultAppState()
    this.readFileCache = createFileStateCacheWithSizeLimit(5000)
    this.mutableMessages = []
    this.mcpClients = []

    this.resolveEnvOptions()
    this.resolvedModel = this.options.model || 'claude-sonnet-4-6'

    if (this.options.apiKey) {
      process.env.ANTHROPIC_API_KEY = this.options.apiKey
      // Clear ANTHROPIC_AUTH_TOKEN to prevent it from overriding x-api-key
      // authentication when a third-party API endpoint is used.
      // The internal configureApiKeyHeaders() prefers ANTHROPIC_AUTH_TOKEN
      // over ANTHROPIC_API_KEY, which causes 401 errors with providers
      // that don't recognize the token.
      delete process.env.ANTHROPIC_AUTH_TOKEN
    }
    if (this.options.baseURL) {
      process.env.ANTHROPIC_BASE_URL = this.options.baseURL
    }

    // Resolve tools — support string[], preset, or Tool objects
    this.tools = this.resolveTools(this.options.tools)

    this._initialized = this._init()
  }

  private resolveTools(toolsOption?: AgentOptions['tools']): Tools {
    if (!toolsOption) return getAllBaseTools()
    if (Array.isArray(toolsOption)) {
      if (toolsOption.length === 0) return []
      // If first element is string, resolve by name from built-in tools
      if (typeof toolsOption[0] === 'string') {
        const nameSet = new Set(toolsOption as string[])
        return getAllBaseTools().filter(t => nameSet.has(t.name))
      }
      return toolsOption as Tools
    }
    if ('type' in toolsOption && toolsOption.type === 'preset') {
      return getAllBaseTools()
    }
    return getAllBaseTools()
  }

  private async _init(): Promise<void> {
    if (this.options.mcpServers) {
      try {
        const { connectToServer } = await import('./services/mcp/client.js')

        for (const [name, config] of Object.entries(this.options.mcpServers)) {
          try {
            const scopedConfig = { ...config, scope: 'dynamic' as const }
            const connection = await connectToServer(name, scopedConfig as any)
            this.mcpClients.push(connection)

            if (connection.status === 'connected' && connection.client) {
              const { fetchToolsForClient } = await import('./services/mcp/client.js')
              const mcpTools = await fetchToolsForClient(connection)
              if (mcpTools?.length) {
                this.tools = [...this.tools, ...mcpTools]
              }
            }
          } catch (err: any) {
            console.error(`[MCP] Failed to connect to "${name}": ${err.message}`)
          }
        }
      } catch (err: any) {
        console.error(`[MCP] MCP client initialization failed: ${err.message}`)
      }
    }
  }

  private resolveEnvOptions(): void {
    const env = this.options.env

    if (!this.options.apiKey) {
      this.options.apiKey =
        env?.ANTHROPIC_API_KEY || env?.ANTHROPIC_AUTH_TOKEN ||
        process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
    }
    if (!this.options.baseURL) {
      this.options.baseURL =
        env?.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL
    }
    if (!this.options.model) {
      this.options.model =
        env?.ANTHROPIC_MODEL || process.env.ANTHROPIC_MODEL
    }
  }

  /**
   * Register SDK hook callbacks into the engine's global hook registry.
   * Converts user-facing SDKHookCallback into engine HookCallback format.
   */
  private registerHooks(hooks: Partial<Record<HookEvent, SDKHookMatcher[]>>): void {
    const engineHooks: Partial<Record<HookEvent, HookCallbackMatcher[]>> = {}

    for (const [event, matchers] of Object.entries(hooks)) {
      if (!matchers) continue
      engineHooks[event as HookEvent] = matchers.map(m => ({
        matcher: m.matcher,
        hooks: m.hooks.map(fn => ({
          type: 'callback' as const,
          callback: async (
            input: HookInput,
            toolUseID: string | null,
            signal: AbortSignal | undefined,
          ): Promise<HookJSONOutput> => {
            return fn(input, toolUseID ?? undefined, { signal: signal ?? new AbortController().signal })
          },
        })),
      }))
    }

    registerHookCallbacks(engineHooks)
    this._hooksRegistered = true
  }

  /**
   * Resolve systemPrompt option: supports string or preset object.
   */
  private resolveSystemPrompt(opts: AgentOptions): { custom?: string; append?: string } {
    const sp = opts.systemPrompt
    if (!sp) return { append: opts.appendSystemPrompt }
    if (typeof sp === 'string') return { custom: sp, append: opts.appendSystemPrompt }
    // Preset object: { type: 'preset', preset: 'claude_code', append?: string }
    if (sp.type === 'preset' && sp.preset === 'claude_code') {
      return { append: [opts.appendSystemPrompt, sp.append].filter(Boolean).join('\n') || undefined }
    }
    return { append: opts.appendSystemPrompt }
  }

  async *query(
    prompt: string,
    overrides?: Partial<AgentOptions>,
  ): AsyncGenerator<SDKMessage, void> {
    await this._initialized

    const opts = { ...this.options, ...overrides }
    const cwd = opts.cwd || process.cwd()

    // Safety check for bypassPermissions
    if (opts.permissionMode === 'bypassPermissions' && opts.allowDangerouslySkipPermissions === false) {
      throw new Error('permissionMode "bypassPermissions" requires allowDangerouslySkipPermissions: true')
    }

    // Register hooks (once per agent, or if overrides provide new hooks)
    if (opts.hooks && !this._hooksRegistered) {
      this.registerHooks(opts.hooks)
    }
    if (overrides?.hooks) {
      this.registerHooks(overrides.hooks)
    }

    // ---- Wire-through: effort → appState.effortValue ----
    if (opts.effort !== undefined) {
      const parsed = typeof opts.effort === 'string' || typeof opts.effort === 'number'
        ? parseEffortValue(opts.effort)
        : opts.effort
      if (parsed !== undefined) {
        this.appState = { ...this.appState, effortValue: parsed }
      }
    }

    // ---- Wire-through: betas → SDK betas registry ----
    if (opts.betas?.length) {
      setSdkBetas(filterAllowedSdkBetas(opts.betas))
    }

    // ---- Wire-through: sessionId → engine session identity ----
    if (opts.sessionId) {
      switchSession(opts.sessionId, cwd)
    }

    // ---- Wire-through: persistSession → session storage flag ----
    if (opts.persistSession !== undefined) {
      setSessionPersistenceDisabled(!opts.persistSession)
    }

    // ---- Wire-through: settingSources → settings loader ----
    if (opts.settingSources?.length) {
      setAllowedSettingSources(opts.settingSources as any)
    }

    // ---- Wire-through: additionalDirectories → CLAUDE.md + permissions ----
    if (opts.additionalDirectories?.length) {
      setAdditionalDirectoriesForClaudeMd(opts.additionalDirectories)
    }

    // ---- Wire-through: includeHookEvents → hook event streaming ----
    if (opts.includeHookEvents) {
      setAllHookEventsEnabled(true)
    }

    // ---- Wire-through: toolConfig → per-tool configuration ----
    if (opts.toolConfig?.askUserQuestion?.previewFormat) {
      setQuestionPreviewFormat(opts.toolConfig.askUserQuestion.previewFormat)
    }

    // ---- Wire-through: promptSuggestions → appState ----
    if (opts.promptSuggestions !== undefined) {
      this.appState = { ...this.appState, promptSuggestionEnabled: opts.promptSuggestions }
    }

    // ---- Wire-through: agentProgressSummaries → bootstrap state ----
    if (opts.agentProgressSummaries) {
      setSdkAgentProgressSummariesEnabled(true)
    }

    // ---- Wire-through: settings → flag settings layer ----
    if (opts.settings) {
      if (typeof opts.settings === 'string') {
        setFlagSettingsPath(opts.settings)
      } else {
        setFlagSettingsInline(opts.settings)
      }
    }

    // ---- Wire-through: plugins → inline plugin paths ----
    if (opts.plugins?.length) {
      const paths = opts.plugins.map(p => p.path)
      setInlinePlugins(paths)
      try {
        const { clearPluginCache } = await import('./utils/plugins/pluginLoader.js')
        clearPluginCache('Agent plugins option')
      } catch { /* best-effort */ }
    }

    // ---- Wire-through: sandbox → SandboxManager ----
    if (opts.sandbox) {
      try {
        const { SandboxManager } = await import('./utils/sandbox/sandbox-adapter.js')
        SandboxManager.setSandboxSettings?.(opts.sandbox)
        if (opts.sandbox.enabled) {
          await SandboxManager.initialize?.()
        }
      } catch { /* sandbox runtime may not be available */ }
    }

    // ---- Wire-through: enableFileCheckpointing → env var ----
    if (opts.enableFileCheckpointing) {
      process.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING = '1'
    }

    // ---- Wire-through: resume → load previous session messages ----
    if (opts.resume && this.mutableMessages.length === 0) {
      try {
        const { getTranscriptPathForSession } = await import('./utils/sessionStorage.js')
        const { loadTranscriptFromFile } = await import('./utils/sessionStorage.js')
        switchSession(opts.resume, cwd)
        const transcriptPath = getTranscriptPathForSession(opts.resume)
        const loaded = await loadTranscriptFromFile(transcriptPath)
        if (loaded?.messages?.length) {
          this.mutableMessages.push(...loaded.messages)
        }
      } catch {
        // Session not found or corrupted — start fresh
      }
    }

    // ---- Wire-through: continue → resume most recent session ----
    if (opts.continue && !opts.resume && this.mutableMessages.length === 0) {
      try {
        const { listSessionsImpl } = await import('./utils/listSessionsImpl.js')
        const sessions = await listSessionsImpl({ dir: cwd, limit: 1 })
        if (sessions.length > 0) {
          const lastSession = sessions[0]
          const sid = (lastSession as any).sessionId
          if (sid) {
            const { getTranscriptPathForSession } = await import('./utils/sessionStorage.js')
            const { loadTranscriptFromFile } = await import('./utils/sessionStorage.js')
            switchSession(sid, cwd)
            const transcriptPath = getTranscriptPathForSession(sid)
            const loaded = await loadTranscriptFromFile(transcriptPath)
            if (loaded?.messages?.length) {
              this.mutableMessages.push(...loaded.messages)
            }
          }
        }
      } catch {
        // No previous session — start fresh
      }
    }

    // ---- Wire-through: debugFile → env var for debug output ----
    if (opts.debugFile) {
      process.env.CLAUDE_CODE_DEBUG_FILE = opts.debugFile
    }

    // Resolve JSON schema from either jsonSchema or outputFormat
    const jsonSchema = opts.jsonSchema ?? opts.outputFormat?.schema

    const allowedToolSet = opts.allowedTools ? new Set(opts.allowedTools) : null
    const disallowedToolSet = opts.disallowedTools ? new Set(opts.disallowedTools) : null
    const permMode = opts.permissionMode ?? 'bypassPermissions'

    // Build canUseTool — adapt from SDK-style (toolName, input, options) to engine-style
    const userCanUseTool = opts.canUseTool
    const canUseTool: CanUseToolFn = userCanUseTool
      ? (async (tool, input, _toolUseContext, _assistantMessage, toolUseID) => {
          // Detect if user passed the official SDK-style callback (3 args: toolName, input, options)
          // vs the engine-style callback (5+ args)
          // Official SDK signature: (toolName: string, input, options: { signal, ... })
          // We try calling it as SDK-style first — toolName is string, 3rd arg is options object
          try {
            const result = await (userCanUseTool as any)(
              tool.name,
              input,
              {
                signal: new AbortController().signal,
                toolUseID: toolUseID || '',
              },
            )
            return result
          } catch {
            // Fallback: try calling as engine-style
            return await (userCanUseTool as any)(tool, input, _toolUseContext, _assistantMessage, toolUseID)
          }
        })
      : (async (tool: any, _input: any) => {
          if (disallowedToolSet?.has(tool.name)) {
            return { behavior: 'deny' as const, message: 'Tool is disallowed', decisionReason: { type: 'mode' as const, mode: permMode } }
          }
          if (allowedToolSet && !allowedToolSet.has(tool.name)) {
            if (permMode === 'bypassPermissions') {
              return { behavior: 'allow' as const, updatedInput: undefined }
            }
            return { behavior: 'deny' as const, message: 'Tool not in allowedTools', decisionReason: { type: 'mode' as const, mode: permMode } }
          }

          switch (permMode) {
            case 'bypassPermissions':
            case 'acceptEdits':
              return { behavior: 'allow' as const, updatedInput: undefined }
            case 'plan':
              return { behavior: 'allow' as const, updatedInput: undefined }
            case 'dontAsk':
              if (allowedToolSet?.has(tool.name)) {
                return { behavior: 'allow' as const, updatedInput: undefined }
              }
              return { behavior: 'deny' as const, message: 'dontAsk mode — tool not pre-approved', decisionReason: { type: 'mode' as const, mode: 'dontAsk' } }
            default:
              return { behavior: 'allow' as const, updatedInput: undefined }
          }
        })

    let commands: any[] = []
    try {
      commands = await getCommands(cwd)
    } catch {
      // Commands may fail in some environments
    }

    // Support both official SDK (abortController) and our own (abortSignal)
    const abortController = opts.abortController ?? new AbortController()
    this._activeAbortController = abortController
    if (opts.abortSignal) {
      opts.abortSignal.addEventListener('abort', () => abortController.abort(), { once: true })
    }

    // Filter tools by allowedTools/disallowedTools
    let tools = this.tools
    if (disallowedToolSet) {
      tools = tools.filter(t => !disallowedToolSet.has(t.name))
    }
    if (allowedToolSet) {
      tools = tools.filter(t => allowedToolSet.has(t.name))
    }

    // Build full agent definitions from options
    const agents = opts.agents
      ? Object.entries(opts.agents).map(([name, def]) => ({
          agentType: name,
          whenToUse: def.description,
          getSystemPrompt: () => def.prompt,
          source: 'flagSettings' as const,
          tools: def.tools,
          disallowedTools: def.disallowedTools,
          model: def.model,
          skills: def.skills,
          initialPrompt: def.initialPrompt,
          maxTurns: def.maxTurns,
          background: def.background,
          memory: def.memory,
          effort: def.effort,
          permissionMode: def.permissionMode,
          criticalSystemReminder_EXPERIMENTAL: def.criticalSystemReminder_EXPERIMENTAL,
        }))
      : []

    const { custom: customSystemPrompt, append: appendSystemPrompt } = this.resolveSystemPrompt(opts)

    const generator = ask({
      commands,
      prompt,
      cwd,
      tools,
      mcpClients: this.mcpClients,
      verbose: opts.debug ?? false,
      thinkingConfig: opts.thinking,
      maxTurns: opts.maxTurns,
      maxBudgetUsd: opts.maxBudgetUsd,
      taskBudget: opts.taskBudget,
      canUseTool,
      mutableMessages: this.mutableMessages,
      getReadFileCache: () => this.readFileCache,
      setReadFileCache: (cache: FileStateCache) => { this.readFileCache = cache },
      customSystemPrompt,
      appendSystemPrompt,
      userSpecifiedModel: this.resolvedModel,
      fallbackModel: opts.fallbackModel,
      getAppState: () => this.appState,
      setAppState: (fn: (prev: AppState) => AppState) => {
        this.appState = fn(this.appState)
      },
      abortController,
      replayUserMessages: false,
      includePartialMessages: opts.includePartialMessages ?? false,
      agents: agents as any,
      jsonSchema,
      handleElicitation: opts.onElicitation,
    })

    yield* generator
  }

  async prompt(
    text: string,
    overrides?: Partial<AgentOptions>,
  ): Promise<QueryResult> {
    const startTime = Date.now()
    let resultText = ''
    let usage = { input_tokens: 0, output_tokens: 0 }
    let numTurns = 0
    let sessionId = ''
    let totalCostUsd = 0

    for await (const event of this.query(text, overrides)) {
      const msg = event as any

      if (msg.type === 'system' && msg.subtype === 'init') {
        sessionId = msg.session_id || ''
      }

      if (msg.type === 'assistant') {
        const textBlocks = (msg.message?.content || [])
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
        resultText = textBlocks.join('')
      }

      if (msg.type === 'result') {
        if (msg.usage) {
          usage = {
            input_tokens: msg.usage.input_tokens || 0,
            output_tokens: msg.usage.output_tokens || 0,
          }
        }
        numTurns = msg.num_turns || 0
        totalCostUsd = msg.total_cost_usd || 0
        sessionId = msg.session_id || sessionId
      }
    }

    return {
      text: resultText,
      usage,
      num_turns: numTurns,
      duration_ms: Date.now() - startTime,
      messages: [...this.mutableMessages],
      session_id: sessionId,
      total_cost_usd: totalCostUsd,
    }
  }

  getMessages(): Message[] {
    return [...this.mutableMessages]
  }

  clear(): void {
    this.mutableMessages = []
    this.readFileCache = createFileStateCacheWithSizeLimit(5000)
    this._hooksRegistered = false
  }

  private _activeAbortController?: AbortController

  abort(): void {
    this._activeAbortController?.abort()
  }

  setModel(model?: string): void {
    this.resolvedModel = model || this.options.model || 'claude-sonnet-4-6'
    this.options.model = this.resolvedModel
  }

  setPermissionMode(mode: PermissionMode): void {
    this.options.permissionMode = mode
  }

  setMaxThinkingTokens(tokens: number | null): void {
    if (tokens === null || tokens === 0) {
      this.options.thinking = { type: 'disabled' } as any
    } else {
      this.options.thinking = { type: 'enabled', budgetTokens: tokens } as any
    }
  }

  getAppState(): AppState {
    return this.appState
  }

  setAppState(fn: (prev: AppState) => AppState): void {
    this.appState = fn(this.appState)
  }

  getMcpStatus(): any[] {
    return this.mcpClients.map((c: any) => ({
      name: c.name || 'unknown',
      status: c.status || 'unknown',
    }))
  }

  async reconnectMcpServer(name: string): Promise<void> {
    const client = this.mcpClients.find((c: any) => c.name === name)
    if (client?.reconnect) await client.reconnect()
  }

  async toggleMcpServer(name: string, enabled: boolean): Promise<void> {
    const client = this.mcpClients.find((c: any) => c.name === name)
    if (client) {
      if (enabled && client.reconnect) await client.reconnect()
      else if (!enabled && client.disconnect) await client.disconnect()
    }
  }

  async setMcpServers(servers: Record<string, any>): Promise<any> {
    const added: string[] = []
    const removed: string[] = []
    const existingNames = new Set(this.mcpClients.map((c: any) => c.name))
    const newNames = new Set(Object.keys(servers))

    for (const name of existingNames) {
      if (!newNames.has(name)) {
        const client = this.mcpClients.find((c: any) => c.name === name)
        if (client?.disconnect) await client.disconnect()
        removed.push(name)
      }
    }
    this.mcpClients = this.mcpClients.filter((c: any) => newNames.has(c.name))

    for (const [name, config] of Object.entries(servers)) {
      if (!existingNames.has(name)) {
        try {
          const { connectToServer, fetchToolsForClient } = await import('./services/mcp/client.js')
          const connection = await connectToServer(name, { ...config, scope: 'dynamic' as const } as any)
          this.mcpClients.push(connection)
          if (connection.status === 'connected' && connection.client) {
            const mcpTools = await fetchToolsForClient(connection)
            if (mcpTools?.length) this.tools = [...this.tools, ...mcpTools]
          }
          added.push(name)
        } catch {
          // skip failed connections
        }
      }
    }

    return { added, removed, errors: [] }
  }
}

// ============================================================================
// Factory function
// ============================================================================

/**
 * Create a new Agent instance.
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   model: 'claude-sonnet-4-6',
 *   tools: getAllBaseTools(),
 * })
 *
 * for await (const event of agent.query('Analyze this project')) {
 *   // handle events
 * }
 * ```
 */
export function createAgent(options: AgentOptions = {}): Agent {
  return new Agent(options)
}

// ============================================================================
// Top-level query() function (compatible with @anthropic-ai/claude-agent-sdk)
// ============================================================================

/**
 * Run a one-shot agent query. Compatible with the official SDK's query() API.
 *
 * @example
 * ```typescript
 * import { query } from '@shipany/open-agent-sdk'
 *
 * for await (const message of query({
 *   prompt: 'Find and fix the bug in auth.py',
 *   options: { allowedTools: ['Read', 'Edit', 'Bash'] }
 * })) {
 *   if (message.type === 'assistant') {
 *     for (const block of message.message.content) {
 *       if ('text' in block) console.log(block.text)
 *     }
 *   }
 * }
 * ```
 */
export async function* query(params: {
  prompt: string
  options?: AgentOptions
}): AsyncGenerator<SDKMessage, void> {
  const agent = new Agent(params.options ?? {})
  yield* agent.query(params.prompt)
}
