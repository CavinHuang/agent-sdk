/**
 * Web Feature Demo Server
 *
 * This example exposes a browser-based playground for the SDK's major features:
 * - streaming chat and tool events
 * - feature presets mapped to the examples/ directory
 * - Query control methods (context usage, initialization, MCP controls, etc.)
 * - interactive AskUserQuestion flows
 * - sessions, rewind, plugins, and demo MCP servers
 *
 * Run: npx tsx examples/web/server.ts
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { readFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import {
  clearQuestionHandler,
  createAgent,
  getAllBaseTools,
  getSessionInfo,
  listSessions,
  setQuestionHandler,
  type Agent,
  type AgentOptions,
  type AskUserQuestionRequest,
  type AskUserQuestionResponse,
  type Query as QueryHandle,
  type SDKMessage,
} from '../../src/index.js'
import {
  buildFeatureAgentOptions,
  getDemoMcpServer,
  getExtraDemoTools,
  getWebFeatureCatalog,
  type FeatureContext,
  type WebFeatureDefinition,
} from './feature-catalog.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '8081', 10)
const PROJECT_ROOT = resolve(__dirname, '../../')
const PLUGIN_DIR = resolve(__dirname, './plugins/demo-plugin')

dotenv.config({ path: resolve(PROJECT_ROOT, '.env') })

type PendingQuestion = {
  request: AskUserQuestionRequest
  resolve: (response: AskUserQuestionResponse | string) => void
  reject: (error: Error) => void
}

const featureContext: FeatureContext = {
  pluginDir: PLUGIN_DIR,
  openAI: {
    available: Boolean(
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_BASE_URL ||
      process.env.CODEANY_API_TYPE === 'openai-completions',
    ),
    apiKey: process.env.OPENAI_API_KEY || process.env.CODEANY_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || process.env.CODEANY_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || process.env.CODEANY_MODEL || 'gpt-4o-mini',
  },
}

let agent: Agent | null = null
let activeFeatureId = 'playground'
let currentRun: QueryHandle | null = null
let lastRun: QueryHandle | null = null
let pendingQuestion: PendingQuestion | null = null

function getFeatureCatalog(): WebFeatureDefinition[] {
  return getWebFeatureCatalog(featureContext)
}

function getFeatureById(featureId: string | undefined): WebFeatureDefinition {
  const feature = getFeatureCatalog().find((entry) => entry.id === featureId)
  return feature || getFeatureCatalog().find((entry) => entry.id === 'playground')!
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function respondJSON(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function normalizeAskUserRequest(
  input: AskUserQuestionRequest | string,
  options?: string[],
): AskUserQuestionRequest {
  if (typeof input !== 'string' && Array.isArray(input.questions)) {
    return input
  }

  return {
    questions: [
      {
        question: typeof input === 'string' ? input : 'Question',
        header: 'Question',
        options: (options || ['Continue', 'Stop']).map((option) => ({
          label: option,
          description: option,
        })),
      },
    ],
  }
}

function clearPendingQuestion(reason = 'cancelled'): void {
  if (!pendingQuestion) return
  pendingQuestion.reject(new Error(reason))
  pendingQuestion = null
}

function installQuestionHandler(
  send: (event: string, data: unknown) => void,
): void {
  setQuestionHandler(async (input: AskUserQuestionRequest | string, options?: string[]) => {
    const request = normalizeAskUserRequest(input, options)
    clearPendingQuestion('superseded by a new question')
    send('ask_user', request)

    return await new Promise<AskUserQuestionResponse | string>((resolveQuestion, rejectQuestion) => {
      pendingQuestion = {
        request,
        resolve: resolveQuestion,
        reject: rejectQuestion,
      }
    })
  })
}

async function closeAgent(): Promise<void> {
  if (!agent) return
  try {
    await agent.close()
  } catch {
    // Ignore cleanup errors in the demo server.
  } finally {
    agent = null
  }
}

async function resetState(): Promise<void> {
  clearPendingQuestion('session reset')
  clearQuestionHandler()
  if (currentRun) {
    try {
      await currentRun.interrupt()
    } catch {
      // Ignore interrupt errors during reset.
    }
  }
  currentRun = null
  lastRun = null
  await closeAgent()
}

function buildAgentOptions(
  featureId: string,
  overrides: Partial<AgentOptions> = {},
): AgentOptions {
  const featureOptions = buildFeatureAgentOptions(featureId, featureContext)

  if (featureId === 'custom-tools') {
    return {
      ...featureOptions,
      ...overrides,
      tools: [...getAllBaseTools(), ...getExtraDemoTools()],
    }
  }

  return {
    ...featureOptions,
    ...overrides,
  }
}

async function ensureAgent(
  featureId: string,
  forceReset = false,
  overrides: Partial<AgentOptions> = {},
): Promise<Agent> {
  if (!agent || forceReset || activeFeatureId !== featureId) {
    await resetState()
    agent = createAgent(buildAgentOptions(featureId, overrides))
    activeFeatureId = featureId
  }
  return agent
}

function getControlTarget(): QueryHandle | null {
  return currentRun || lastRun
}

function getLastUserMessageId(): string | undefined {
  if (!agent) return undefined
  const messages = agent.getMessages()
  return [...messages].reverse().find((message) => message.type === 'user')?.uuid
}

function serializeEvent(ev: SDKMessage): unknown {
  return ev
}

async function handleFeatures(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  respondJSON(res, 200, {
    features: getFeatureCatalog(),
    projectRoot: PROJECT_ROOT,
  })
}

async function handleAnswer(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!pendingQuestion) {
    respondJSON(res, 409, { error: 'No pending AskUserQuestion request' })
    return
  }

  const body = JSON.parse(await readBody(req) || '{}')
  const request = pendingQuestion.request
  const answers =
    body.answers && typeof body.answers === 'object'
      ? body.answers
      : Object.fromEntries(
          request.questions.map((question) => [
            question.question,
            Array.isArray(body.selected?.[question.question])
              ? body.selected[question.question].join(', ')
              : body.selected?.[question.question] ||
                question.options[0]?.label ||
                '',
          ]),
        )

  const response: AskUserQuestionResponse = {
    questions: request.questions,
    answers,
    annotations:
      body.annotations && typeof body.annotations === 'object'
        ? body.annotations
        : undefined,
  }

  pendingQuestion.resolve(response)
  pendingQuestion = null
  respondJSON(res, 200, { ok: true })
}

async function handleControl(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = JSON.parse(await readBody(req) || '{}')
  const action = body.action as string | undefined
  const featureId = body.featureId || activeFeatureId

  try {
    switch (action) {
      case 'interrupt': {
        if (!currentRun) return respondJSON(res, 409, { error: 'No active run to interrupt' })
        await currentRun.interrupt()
        return respondJSON(res, 200, { ok: true })
      }

      case 'stream_input': {
        if (!currentRun) return respondJSON(res, 409, { error: 'No active run to stream into' })
        const message = String(body.message || '').trim()
        if (!message) return respondJSON(res, 400, { error: 'Empty stream input' })
        await currentRun.streamInput(message)
        return respondJSON(res, 200, { ok: true })
      }

      case 'get_initialization': {
        const target = getControlTarget()
        if (!target) return respondJSON(res, 409, { error: 'No run available yet' })
        return respondJSON(res, 200, await target.getInitializationResult())
      }

      case 'get_context_usage': {
        const target = getControlTarget()
        if (!target) return respondJSON(res, 409, { error: 'No run available yet' })
        return respondJSON(res, 200, await target.getContextUsage())
      }

      case 'mcp_status': {
        const target = getControlTarget()
        if (!target) return respondJSON(res, 409, { error: 'No run available yet' })
        return respondJSON(res, 200, await target.mcpServerStatus())
      }

      case 'attach_demo_mcp': {
        const target = getControlTarget()
        if (!target) return respondJSON(res, 409, { error: 'No run available yet' })
        return respondJSON(
          res,
          200,
          await target.setMcpServers({ utilities: getDemoMcpServer() as any }),
        )
      }

      case 'detach_demo_mcp': {
        const target = getControlTarget()
        if (!target) return respondJSON(res, 409, { error: 'No run available yet' })
        return respondJSON(res, 200, await target.setMcpServers({}))
      }

      case 'reload_plugins': {
        const target = getControlTarget()
        if (!target) return respondJSON(res, 409, { error: 'No run available yet' })
        return respondJSON(res, 200, await target.reloadPlugins())
      }

      case 'rewind_last': {
        const target = getControlTarget()
        if (!target) return respondJSON(res, 409, { error: 'No run available yet' })
        const userMessageId = getLastUserMessageId()
        if (!userMessageId) {
          return respondJSON(res, 409, { error: 'No user message available for rewind' })
        }
        return respondJSON(res, 200, await target.rewindFiles(userMessageId, Boolean(body.dryRun)))
      }

      case 'set_model': {
        const target = getControlTarget()
        if (!target) return respondJSON(res, 409, { error: 'No run available yet' })
        await target.setModel(String(body.value || '').trim() || undefined)
        return respondJSON(res, 200, { ok: true })
      }

      case 'set_permission_mode': {
        const target = getControlTarget()
        if (!target) return respondJSON(res, 409, { error: 'No run available yet' })
        await target.setPermissionMode(body.value)
        return respondJSON(res, 200, { ok: true })
      }

      case 'set_max_thinking_tokens': {
        const target = getControlTarget()
        if (!target) return respondJSON(res, 409, { error: 'No run available yet' })
        await target.setMaxThinkingTokens(body.value === null ? null : Number(body.value))
        return respondJSON(res, 200, { ok: true })
      }

      case 'set_cwd': {
        const target = getControlTarget()
        if (!target) return respondJSON(res, 409, { error: 'No run available yet' })
        await target.setCwd(resolve(PROJECT_ROOT, String(body.value || '.')))
        return respondJSON(res, 200, { ok: true })
      }

      case 'list_sessions': {
        return respondJSON(res, 200, await listSessions({ limit: 20 }))
      }

      case 'get_session_info': {
        const sessionId = String(body.sessionId || '').trim()
        if (!sessionId) return respondJSON(res, 400, { error: 'sessionId is required' })
        return respondJSON(res, 200, await getSessionInfo(sessionId))
      }

      case 'resume_latest': {
        const latest = await listSessions({ limit: 1 })
        if (!latest[0]?.id) {
          return respondJSON(res, 404, { error: 'No sessions available to resume' })
        }
        await ensureAgent(featureId, true, { resume: latest[0].id })
        return respondJSON(res, 200, { ok: true, resumed: latest[0].id })
      }

      default:
        return respondJSON(res, 400, { error: `Unknown control action: ${String(action)}` })
    }
  } catch (err: any) {
    return respondJSON(res, 500, { error: err.message })
  }
}

async function handleNewSession(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  await resetState()
  activeFeatureId = 'playground'
  respondJSON(res, 200, { ok: true })
}

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (currentRun) {
    respondJSON(res, 409, { error: 'A run is already active. Use stream input or interrupt first.' })
    return
  }

  const body = JSON.parse(await readBody(req) || '{}')
  const feature = getFeatureById(body.featureId)
  if (feature.disabledReason) {
    respondJSON(res, 400, { error: feature.disabledReason })
    return
  }

  const prompt = String(body.message || feature.prompt || '').trim()
  if (!prompt) {
    respondJSON(res, 400, { error: 'Prompt is empty' })
    return
  }

  const ag = await ensureAgent(feature.id, Boolean(body.reset))
  const run = ag.query(prompt)
  currentRun = run
  lastRun = run

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()

  let closed = false
  let streamedTextForCurrentAssistant = false
  const startMs = Date.now()

  const send = (event: string, data: unknown) => {
    if (closed || res.writableEnded) return
    res.write(`data: ${JSON.stringify({ event, data })}\n\n`)
  }

  const cleanup = async () => {
    clearQuestionHandler()
    clearPendingQuestion('chat stream closed')
    if (currentRun === run) currentRun = null
    if (!closed && !res.writableEnded) {
      send('done', null)
      res.end()
    }
  }

  installQuestionHandler(send)

  req.on('close', () => {
    closed = true
    void run.interrupt().catch(() => {})
    void cleanup()
  })

  send('meta', {
    featureId: feature.id,
    featureTitle: feature.title,
    sessionId: ag.getSessionId(),
  })

  try {
    for await (const ev of run) {
      send('sdk_event', serializeEvent(ev))

      switch (ev.type) {
        case 'stream_event': {
          const delta = (ev.event as any)?.delta
          if (delta?.type === 'text_delta' && delta.text) {
            streamedTextForCurrentAssistant = true
            send('text', { text: delta.text })
          }
          break
        }

        case 'partial_message':
          if (ev.partial.type === 'text' && ev.partial.text) {
            streamedTextForCurrentAssistant = true
            send('text', { text: ev.partial.text })
          }
          break

        case 'assistant': {
          for (const block of ev.message.content) {
            if (block.type === 'text') {
              if (!streamedTextForCurrentAssistant) {
                send('text', { text: block.text })
              }
            } else if (block.type === 'tool_use') {
              send('tool_use', {
                id: block.id,
                name: block.name,
                input: block.input,
              })
            } else if ('thinking' in block) {
              send('thinking', { thinking: (block as any).thinking })
            }
          }
          streamedTextForCurrentAssistant = false
          break
        }

        case 'tool_result':
          send('tool_result', ev.result)
          break

        case 'prompt_suggestion':
          send('prompt_suggestion', ev)
          break

        case 'tool_use_summary':
          send('tool_use_summary', ev)
          break

        case 'tool_progress':
          send('tool_progress', ev)
          break

        case 'auth_status':
          send('auth_status', ev)
          break

        case 'system':
          send(ev.subtype, ev)
          break

        case 'result': {
          const isError = Boolean(ev.is_error || ev.subtype?.startsWith('error'))
          send('result', {
            ok: !isError,
            subtype: ev.subtype,
            is_error: isError,
            message:
              ev.errors?.[0] ||
              (typeof ev.result === 'string' && ev.result.trim() ? ev.result : undefined) ||
              (isError ? `Request failed (${ev.subtype})` : undefined),
            errors: ev.errors ?? [],
            num_turns: ev.num_turns ?? 0,
            input_tokens: ev.usage?.input_tokens ?? 0,
            output_tokens: ev.usage?.output_tokens ?? 0,
            cost: ev.total_cost_usd ?? ev.cost ?? 0,
            duration_ms: Date.now() - startMs,
            structured_output: ev.structured_output,
          })
          break
        }
      }
    }
  } catch (err: any) {
    send('error', { message: err.message })
  } finally {
    await cleanup()
  }
}

async function serveIndex(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const html = await readFile(join(__dirname, 'index.html'), 'utf-8')
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
}

const server = createServer(async (req, res) => {
  const url = req.url || '/'
  const method = req.method || 'GET'

  try {
    if (url === '/' && method === 'GET') return await serveIndex(req, res)
    if (url === '/api/features' && method === 'GET') return await handleFeatures(req, res)
    if (url === '/api/chat' && method === 'POST') return await handleChat(req, res)
    if (url === '/api/new' && method === 'POST') return await handleNewSession(req, res)
    if (url === '/api/control' && method === 'POST') return await handleControl(req, res)
    if (url === '/api/answer' && method === 'POST') return await handleAnswer(req, res)

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
  } catch (err: any) {
    console.error(err)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
    }
    res.end(JSON.stringify({ error: err.message }))
  }
})

server.listen(PORT, () => {
  console.log('\n  Open Agent SDK — Feature Web Demo')
  console.log(`  http://localhost:${PORT}\n`)
})
