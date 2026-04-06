import { z } from 'zod'
import {
  createSdkMcpServer,
  defineTool,
  registerSkill,
  type AgentOptions,
  type ToolDefinition,
  tool,
} from '../../src/index.js'

export type WebFeatureCategory =
  | 'Core'
  | 'Extensibility'
  | 'Coordination'
  | 'Providers'
  | 'Control Surface'

export interface WebFeatureDefinition {
  id: string
  title: string
  category: WebFeatureCategory
  description: string
  prompt: string
  tags: string[]
  details?: string[]
  disabledReason?: string
}

export interface FeatureContext {
  pluginDir: string
  openAI: {
    available: boolean
    apiKey?: string
    baseURL?: string
    model?: string
  }
}

const CalculatorTool = defineTool({
  name: 'Calculator',
  description: 'Evaluate a simple math expression.',
  inputSchema: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'JavaScript-compatible math expression' },
    },
    required: ['expression'],
  },
  isReadOnly: true,
  isConcurrencySafe: true,
  async call(input) {
    // Demo-only helper. Do not use eval on untrusted network inputs in production.
    const result = Function(`'use strict'; return (${String(input.expression)})`)()
    return {
      data: {
        expression: input.expression,
        result,
      },
    }
  },
})

const ProjectPulseTool = defineTool({
  name: 'ProjectPulse',
  description: 'Return a compact synthetic project status for demo purposes.',
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Topic to summarize' },
    },
    required: ['topic'],
  },
  isReadOnly: true,
  isConcurrencySafe: true,
  async call(input) {
    return {
      data: {
        topic: input.topic,
        status: 'healthy',
        notes: [
          'The codebase is TypeScript-first.',
          'The SDK centers around Agent, QueryEngine, tools, MCP, and sessions.',
          'The web example can stream tool and system events.',
        ],
      },
    }
  },
})

const UtilityMcpServer = createSdkMcpServer({
  name: 'utilities',
  version: '1.0.0',
  tools: [
    tool(
      'get_temperature',
      'Get the current temperature at a location',
      {
        city: z.string().describe('City name'),
        unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
      },
      async ({ city, unit }) => {
        const temps: Record<string, number> = {
          tokyo: 22,
          london: 14,
          paris: 16,
          'new york': 18,
          shanghai: 25,
        }
        const tempC = temps[city.toLowerCase()] ?? 20
        const temp = unit === 'fahrenheit' ? tempC * 9 / 5 + 32 : tempC
        const symbol = unit === 'fahrenheit' ? '°F' : '°C'
        return {
          content: [{ type: 'text', text: `Temperature in ${city}: ${temp}${symbol}` }],
        }
      },
      { annotations: { readOnlyHint: true } },
    ),
    tool(
      'convert_units',
      'Convert between measurement units',
      {
        value: z.number(),
        from_unit: z.string(),
        to_unit: z.string(),
      },
      async ({ value, from_unit, to_unit }) => {
        const conversions: Record<string, Record<string, (v: number) => number>> = {
          km: { miles: (v) => v * 0.621371 },
          miles: { km: (v) => v * 1.60934 },
          kg: { lbs: (v) => v * 2.20462 },
          lbs: { kg: (v) => v * 0.453592 },
        }
        const fn = conversions[from_unit]?.[to_unit]
        if (!fn) {
          return {
            content: [{ type: 'text', text: `Cannot convert ${from_unit} to ${to_unit}` }],
            isError: true,
          }
        }
        return {
          content: [{ type: 'text', text: `${value} ${from_unit} = ${fn(value).toFixed(2)} ${to_unit}` }],
        }
      },
    ),
  ],
})

let demoSkillRegistered = false

function ensureDemoSkillRegistered(): void {
  if (demoSkillRegistered) return
  demoSkillRegistered = true
  registerSkill({
    name: 'demo-explain',
    description: 'Explain a repository concept in plain language',
    userInvocable: true,
    whenToUse: 'Use when the user asks for a plain-language explanation.',
    async getPrompt(args) {
      return [
        {
          type: 'text',
          text: `Explain this concept in plain language and keep it practical: ${args || 'the repository architecture'}`,
        },
      ]
    },
  })
}

export function getDemoMcpServer() {
  return UtilityMcpServer
}

export function getExtraDemoTools(): ToolDefinition[] {
  return [CalculatorTool, ProjectPulseTool]
}

export function getWebFeatureCatalog(ctx: FeatureContext): WebFeatureDefinition[] {
  return [
    {
      id: 'playground',
      title: 'Playground',
      category: 'Core',
      description: 'Default streaming chat with tool usage and persistent agent state.',
      prompt: 'Read package.json and summarize this project in three bullets.',
      tags: ['streaming', 'chat', 'tools'],
    },
    {
      id: 'simple-query',
      title: 'Simple Query',
      category: 'Core',
      description: 'Basic streaming query with assistant text and tool events.',
      prompt: 'Read package.json and tell me the project name and version in one sentence.',
      tags: ['streaming', 'assistant'],
    },
    {
      id: 'multi-tool',
      title: 'Multi Tool',
      category: 'Core',
      description: 'Uses multiple read/search tools in one answer.',
      prompt: 'Use Glob, Grep, and Read to identify the main entrypoints of this repository.',
      tags: ['glob', 'grep', 'read'],
    },
    {
      id: 'multi-turn',
      title: 'Multi Turn',
      category: 'Core',
      description: 'Demonstrates reuse of the same agent across turns.',
      prompt: 'Remember that the codename for this web demo is Aurora and reply only with "stored".',
      tags: ['session', 'memory'],
      details: ['Send a follow-up prompt after running this preset to verify the remembered codename.'],
    },
    {
      id: 'custom-system-prompt',
      title: 'Custom System Prompt',
      category: 'Core',
      description: 'Overrides the assistant style with a custom system prompt.',
      prompt: 'Describe this repository like a terse senior engineer.',
      tags: ['systemPrompt', 'style'],
    },
    {
      id: 'structured-output',
      title: 'Structured Output',
      category: 'Core',
      description: 'Returns JSON matching an explicit schema.',
      prompt: 'Inspect this repository and return a release checklist with title, risk, and nextStep fields.',
      tags: ['json', 'schema'],
    },
    {
      id: 'mcp-server',
      title: 'SDK MCP Server',
      category: 'Extensibility',
      description: 'Attaches an in-process MCP server with utility tools.',
      prompt: 'Use the MCP utility tools to get the temperature in Tokyo and convert 10 km to miles.',
      tags: ['mcp', 'sdkServer'],
    },
    {
      id: 'custom-tools',
      title: 'Custom Tools',
      category: 'Extensibility',
      description: 'Adds custom low-level tools via defineTool().',
      prompt: 'Use Calculator to compute 2**10 * 3 and ProjectPulse to summarize the repo architecture.',
      tags: ['defineTool', 'extensibility'],
    },
    {
      id: 'official-query-api',
      title: 'Query Controls',
      category: 'Control Surface',
      description: 'Use the side controls to inspect initialization, context usage, MCP status, and runtime mutations.',
      prompt: 'Read README.md and summarize how the SDK is organized internally.',
      tags: ['query', 'controls'],
      details: ['After sending, use the control panel to call getInitializationResult(), getContextUsage(), reloadPlugins(), and MCP actions.'],
    },
    {
      id: 'subagents',
      title: 'Subagents',
      category: 'Coordination',
      description: 'Uses the Agent tool and custom agent definitions.',
      prompt: 'Use the code-reviewer agent to inspect src/index.ts and highlight the main exported surfaces.',
      tags: ['Agent', 'subagent'],
    },
    {
      id: 'permissions',
      title: 'Permissions',
      category: 'Coordination',
      description: 'Exercises permission mode behavior and safe tool restrictions.',
      prompt: 'Review the repository with read-only tools and explain what would need approval before making changes.',
      tags: ['permissions', 'plan'],
    },
    {
      id: 'skills',
      title: 'Skills',
      category: 'Extensibility',
      description: 'Invokes bundled and custom skills.',
      prompt: 'Use the demo-explain skill to explain the SDK architecture in plain language.',
      tags: ['skills', 'prompt templates'],
    },
    {
      id: 'hooks',
      title: 'Hooks',
      category: 'Extensibility',
      description: 'Emits hook lifecycle events around tool execution.',
      prompt: 'List the top-level files in this project and be brief.',
      tags: ['hooks', 'events'],
    },
    {
      id: 'ask-user',
      title: 'Ask User',
      category: 'Coordination',
      description: 'Uses AskUserQuestion and waits for interactive answers from the browser.',
      prompt: 'Before answering, ask me which answer style I want using AskUserQuestion, then follow it.',
      tags: ['AskUserQuestion', 'interactive'],
    },
    {
      id: 'prompt-suggestions',
      title: 'Prompt Suggestions',
      category: 'Control Surface',
      description: 'Emits prompt suggestion events after each turn.',
      prompt: 'Find one small refactor opportunity in this repo and explain it briefly.',
      tags: ['suggestions', 'follow-up'],
    },
    {
      id: 'plugin',
      title: 'Plugin Demo',
      category: 'Extensibility',
      description: 'Loads a local demo plugin with a tool, agent, and skill.',
      prompt: 'Use the plugin echo tool or plugin guide agent to prove the plugin loaded.',
      tags: ['plugins', 'reloadPlugins'],
      details: [`Plugin path: ${ctx.pluginDir}`],
    },
    {
      id: 'dynamic-mcp',
      title: 'Dynamic MCP',
      category: 'Control Surface',
      description: 'Starts without demo MCP tools; attach them live from the control panel.',
      prompt: 'Tell me which MCP tools are currently available, then wait for me to attach more.',
      tags: ['dynamic MCP', 'setMcpServers'],
      details: ['Use "Attach Demo MCP" in the control panel, then send a follow-up prompt in the same session.'],
    },
    {
      id: 'session-controls',
      title: 'Session Controls',
      category: 'Control Surface',
      description: 'Creates session history and file edits so you can test listSessions(), rewindFiles(), and resume.',
      prompt: 'Create a file named examples/web/session-demo.txt containing "web session demo", then tell me the file path.',
      tags: ['sessions', 'rewind', 'resume'],
    },
    {
      id: 'openai-compat',
      title: 'OpenAI Compatible',
      category: 'Providers',
      description: 'Runs against an OpenAI-compatible endpoint when credentials are configured.',
      prompt: 'What files are in this project? Reply in one sentence.',
      tags: ['openai', 'providers'],
      disabledReason: ctx.openAI.available ? undefined : 'Set OPENAI_API_KEY or CODEANY_API_TYPE=openai-completions to enable this demo.',
    },
  ]
}

export function buildFeatureAgentOptions(
  featureId: string,
  ctx: FeatureContext,
): AgentOptions {
  ensureDemoSkillRegistered()

  const base: AgentOptions = {
    model: process.env.CODEANY_MODEL || 'claude-sonnet-4-6',
    maxTurns: 20,
    includePartialMessages: true,
    persistSession: true,
    promptSuggestions: false,
  }

  switch (featureId) {
    case 'custom-system-prompt':
      return {
        ...base,
        systemPrompt:
          'You are a terse repository analyst. Prefer compact answers, cite concrete files, and skip padding.',
      }

    case 'structured-output':
      return {
        ...base,
        outputFormat: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              risk: { type: 'string' },
              nextStep: { type: 'string' },
            },
            required: ['title', 'risk', 'nextStep'],
            additionalProperties: false,
          },
        },
      }

    case 'mcp-server':
      return {
        ...base,
        mcpServers: {
          utilities: UtilityMcpServer as any,
        },
      }

    case 'custom-tools':
      return {
        ...base,
        tools: undefined,
        allowedTools: undefined,
      }

    case 'subagents':
      return {
        ...base,
        agents: {
          'code-reviewer': {
            description: 'Focused reviewer for repository structure and exported APIs.',
            prompt:
              'Review the target files for architecture, exports, and risks. Be concise and concrete.',
            tools: ['Read', 'Glob', 'Grep'],
            maxTurns: 6,
          },
        },
      }

    case 'permissions':
      return {
        ...base,
        permissionMode: 'default',
        allowedTools: ['Read', 'Glob', 'Grep', 'AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode', 'TodoWrite'],
      }

    case 'hooks':
      return {
        ...base,
        hooks: {
          SessionStart: [
            {
              hooks: [
                async () => ({
                  message: 'Hook demo session started.',
                }),
              ],
            },
          ],
          PreToolUse: [
            {
              hooks: [
                async (input) => ({
                  message: `About to use ${String(input.toolName || 'tool')}`,
                }),
              ],
            },
          ],
          PostToolUse: [
            {
              hooks: [
                async (input) => ({
                  message: `Finished ${String(input.toolName || 'tool')}`,
                }),
              ],
            },
          ],
        },
      }

    case 'ask-user':
      return {
        ...base,
        allowedTools: ['Read', 'Glob', 'Grep', 'AskUserQuestion'],
        toolConfig: {
          askUserQuestion: {
            previewFormat: 'html',
          },
        },
      }

    case 'prompt-suggestions':
      return {
        ...base,
        promptSuggestions: true,
      }

    case 'plugin':
      return {
        ...base,
        plugins: [
          {
            name: 'demo-plugin',
            path: ctx.pluginDir,
          },
        ],
      }

    case 'openai-compat':
      return {
        ...base,
        apiType: 'openai-completions',
        apiKey: ctx.openAI.apiKey,
        baseURL: ctx.openAI.baseURL,
        model: ctx.openAI.model || 'gpt-4o-mini',
      }

    default:
      return base
  }
}
