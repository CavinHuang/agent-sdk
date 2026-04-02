/**
 * Web Chat Server — full SDK event support with streaming
 *
 * Run: bun run examples/web/server.ts
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { readFile } from 'fs/promises'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createAgent, type Agent } from '../../src/sdk.js'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '8081')

dotenv.config({ path: resolve(__dirname, '../../.env') })

let agent: Agent | null = null

function getOrCreateAgent(): Agent {
  if (!agent) {
    agent = createAgent({
      model: process.env.CODEANY_MODEL || 'claude-sonnet-4-6',
      baseURL: process.env.CODEANY_BASE_URL || 'https://open.bigmodel.cn/api/anthropic',
      apiKey: process.env.CODEANY_API_KEY || '',
      maxTurns: 20,
      includePartialMessages: true,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Agent'],
      agents: {
        'code-reviewer': {
          description: 'Expert code reviewer. Dispatched to review code quality, security, and maintainability.',
          prompt: 'You are a senior code reviewer. Analyze code for bugs, security issues, performance problems, and style. Be concise and actionable.',
          tools: ['Read', 'Glob', 'Grep'],
        },
        'researcher': {
          description: 'Research agent for exploring codebases, searching files, and gathering information.',
          prompt: 'You are a research assistant. Explore the codebase to answer questions. Use Glob to find files, Grep to search content, and Read to examine code. Summarize findings clearly.',
          tools: ['Read', 'Glob', 'Grep'],
        },
        'writer': {
          description: 'Code writing agent for creating and editing files.',
          prompt: 'You are a code writing assistant. Write clean, well-documented code. Follow existing project conventions.',
          tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
        },
      },
    })
  }
  return agent
}

function resetAgent(): void {
  agent?.close().catch(() => {})
  agent = null
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

async function handleChat(req: IncomingMessage, res: ServerResponse) {
  const body = JSON.parse(await readBody(req))
  const prompt = body.message?.trim()
  if (!prompt) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'empty message' }))
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const send = (event: string, data: unknown) => {
    res.write(`data: ${JSON.stringify({ event, data })}\n\n`)
  }

  const ag = getOrCreateAgent()
  const startMs = Date.now()

  try {
    for await (const ev of ag.query(prompt)) {
      const t = ev.type as string
      const s = (ev as any).subtype as string | undefined

      // parent_tool_use_id: non-null when message comes from a subagent
      const pid = (ev as any).parent_tool_use_id || null

      // --- streaming deltas ---
      if (t === 'stream_event') {
        const se = (ev as any).event
        if (se.type === 'content_block_delta') {
          const d = se.delta
          if (d.type === 'text_delta') send('text_delta', { text: d.text, parent: pid })
          else if (d.type === 'thinking_delta') send('thinking_delta', { thinking: d.thinking, parent: pid })
          else if (d.type === 'input_json_delta') send('input_json_delta', { partial_json: d.partial_json, parent: pid })
        } else if (se.type === 'content_block_start' && se.content_block?.type === 'tool_use') {
          send('tool_use_start', { id: se.content_block.id, name: se.content_block.name, parent: pid })
        }
        continue
      }

      // --- complete assistant ---
      if (t === 'assistant') {
        for (const block of (ev as any).message.content) {
          if (block.type === 'text') send('text', { text: block.text, parent: pid })
          else if (block.type === 'tool_use') send('tool_use', { id: block.id, name: block.name, input: block.input, parent: pid })
          else if ('thinking' in block) send('thinking', { thinking: block.thinking, parent: pid })
        }
        continue
      }

      // --- user (tool_result inside) ---
      if (t === 'user') {
        const msg = (ev as any).message
        if (msg?.content && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'tool_result') {
              send('tool_result', {
                tool_use_id: block.tool_use_id,
                content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
                is_error: block.is_error ?? false,
                parent: pid,
              })
            }
          }
        }
        continue
      }

      // --- result ---
      if (t === 'result') {
        const e = ev as any
        send('result', {
          subtype: s,
          is_error: e.is_error ?? false,
          num_turns: e.num_turns ?? 0,
          input_tokens: e.usage?.input_tokens ?? 0,
          output_tokens: e.usage?.output_tokens ?? 0,
          cost: e.total_cost_usd ?? 0,
          duration_ms: Date.now() - startMs,
          errors: e.errors,
        })
        continue
      }

      // --- system subtypes ---
      if (t === 'system') {
        if (s === 'init') {
          send('system_init', { model: (ev as any).model, tools: (ev as any).tools, cwd: (ev as any).cwd })
        } else if (s === 'api_retry') {
          const e = ev as any
          send('api_retry', { attempt: e.attempt, max_retries: e.max_retries, delay_ms: e.retry_delay_ms, error: e.error })
        } else if (s === 'hook_started') {
          send('hook_started', { hook_id: (ev as any).hook_id, hook_name: (ev as any).hook_name })
        } else if (s === 'hook_progress') {
          send('hook_progress', { hook_id: (ev as any).hook_id, output: (ev as any).output })
        } else if (s === 'hook_response') {
          const e = ev as any
          send('hook_response', { hook_id: e.hook_id, outcome: e.outcome, output: e.output })
        } else if (s === 'task_started') {
          const e = ev as any
          send('task_started', {
            task_id: e.task_id, description: e.description,
            task_type: e.task_type, workflow_name: e.workflow_name,
            tool_use_id: e.tool_use_id,
          })
        } else if (s === 'task_progress') {
          const e = ev as any
          send('task_progress', {
            task_id: e.task_id, description: e.description, summary: e.summary,
            usage: e.usage,
          })
        } else if (s === 'task_notification') {
          const e = ev as any
          send('task_notification', {
            task_id: e.task_id, status: e.status, summary: e.summary,
            usage: e.usage,
          })
        }
        continue
      }

      // --- tool progress ---
      if (t === 'tool_progress') {
        const e = ev as any
        send('tool_progress', { tool_use_id: e.tool_use_id, tool_name: e.tool_name, elapsed: e.elapsed_time_seconds })
        continue
      }

      // --- tool use summary ---
      if (t === 'tool_use_summary') {
        send('tool_use_summary', { summary: (ev as any).summary })
        continue
      }

      // --- rate limit ---
      if (t === 'rate_limit_event') {
        send('rate_limit', { info: (ev as any).rate_limit_info })
        continue
      }
    }
  } catch (err: any) {
    send('error', { message: err.message })
  }

  send('done', null)
  res.end()
}

function handleNewSession(_req: IncomingMessage, res: ServerResponse) {
  resetAgent()
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: true }))
}

async function serveIndex(_req: IncomingMessage, res: ServerResponse) {
  const html = await readFile(join(__dirname, 'index.html'), 'utf-8')
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
}

const server = createServer(async (req, res) => {
  const url = req.url || '/'
  const method = req.method || 'GET'
  try {
    if (url === '/' && method === 'GET') return await serveIndex(req, res)
    if (url === '/api/chat' && method === 'POST') return await handleChat(req, res)
    if (url === '/api/new' && method === 'POST') return handleNewSession(req, res)
    res.writeHead(404)
    res.end('Not Found')
  } catch (err: any) {
    console.error(err)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err.message }))
  }
})

server.listen(PORT, () => {
  console.log(`\n  Open Agent SDK — Web Chat\n  http://localhost:${PORT}\n`)
})
