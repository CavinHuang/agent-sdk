/**
 * Example 12: Custom Tools (MCP-Style) — Official SDK Pattern
 *
 * The official Claude Agent SDK defines custom tools via createSdkMcpServer().
 * Open Agent SDK supports MCP servers natively, so you can use any MCP server.
 *
 * This example shows TWO approaches:
 *   A) Native function tools (Open Agent SDK exclusive — simpler)
 *   B) External MCP server (compatible with official SDK pattern)
 *
 * Official SDK equivalent:
 *   https://platform.claude.com/docs/en/agent-sdk/custom-tools
 *
 * Run: npx tsx examples/12-custom-tools-mcp-style.ts
 */
import { createAgent, getAllBaseTools } from '@shipany/open-agent-sdk'

// ─── Approach A: Native function tools (Open Agent SDK exclusive) ───
// No MCP overhead. Just implement the tool interface directly.

function nativeTool(config: {
  name: string
  description: string
  properties: Record<string, unknown>
  required?: string[]
  readOnly?: boolean
  handler: (input: any) => Promise<string>
}) {
  return {
    name: config.name,
    description: config.description,
    inputJSONSchema: {
      type: 'object' as const,
      properties: config.properties,
      required: config.required || [],
    },
    get inputSchema() {
      return { safeParse: (v: any) => ({ success: true, data: v }), parse: (v: any) => v }
    },
    async prompt() { return config.description },
    userFacingName: () => config.name,
    async call(input: any) {
      try {
        const output = await config.handler(input)
        return { data: output }
      } catch (e: any) {
        // Return error as data so the agent loop continues (like isError: true)
        return { data: `Error: ${e.message}` }
      }
    },
    isReadOnly: () => config.readOnly ?? true,
    isConcurrencySafe: () => config.readOnly ?? true,
    isEnabled: () => true,
    renderToolUseMessage: () => null,
    renderToolResultMessage: () => null,
    mapToolResultToToolResultBlockParam: (data: any, id: string) => ({
      type: 'tool_result',
      tool_use_id: id,
      content: typeof data === 'string' ? data : JSON.stringify(data),
    }),
  } as any
}

// Temperature converter — matches the official SDK's example
const convertUnitsTool = nativeTool({
  name: 'ConvertUnits',
  description:
    'Convert between units of length (km/mi), temperature (°C/°F), and weight (kg/lb). ' +
    'Specify unit_type, from_unit, to_unit, and value.',
  properties: {
    unit_type: {
      type: 'string',
      description: 'Type of unit: "length", "temperature", or "weight"',
    },
    from_unit: { type: 'string', description: 'Source unit (e.g. "km", "celsius", "kg")' },
    to_unit: { type: 'string', description: 'Target unit (e.g. "mi", "fahrenheit", "lb")' },
    value: { type: 'number', description: 'The numeric value to convert' },
  },
  required: ['unit_type', 'from_unit', 'to_unit', 'value'],
  async handler(input) {
    const { unit_type, from_unit, to_unit, value } = input
    const conversions: Record<string, (v: number) => number> = {
      'length:km:mi': v => v * 0.621371,
      'length:mi:km': v => v * 1.60934,
      'temperature:celsius:fahrenheit': v => v * 9 / 5 + 32,
      'temperature:fahrenheit:celsius': v => (v - 32) * 5 / 9,
      'weight:kg:lb': v => v * 2.20462,
      'weight:lb:kg': v => v * 0.453592,
    }
    const key = `${unit_type}:${from_unit}:${to_unit}`
    const fn = conversions[key]
    if (!fn) {
      throw new Error(`Unsupported conversion: ${key}`)
    }
    const result = fn(value)
    return `${value} ${from_unit} = ${result.toFixed(4)} ${to_unit}`
  },
})

// Database lookup — simulates an external API call
const lookupUserTool = nativeTool({
  name: 'LookupUser',
  description: 'Look up a user by ID. Returns user profile data.',
  properties: {
    user_id: { type: 'string', description: 'User ID (e.g. "user_123")' },
  },
  required: ['user_id'],
  async handler(input) {
    // Simulated database lookup
    const users: Record<string, any> = {
      user_123: { name: 'Alice', email: 'alice@example.com', plan: 'pro' },
      user_456: { name: 'Bob', email: 'bob@example.com', plan: 'free' },
    }
    const user = users[input.user_id]
    if (!user) throw new Error(`User not found: ${input.user_id}`)
    return JSON.stringify(user)
  },
})

async function main() {
  console.log('--- Example 12: Custom Tools (MCP-Style vs Native) ---\n')

  // ─── Approach A: Native tools ───
  console.log('=== Approach A: Native Function Tools ===\n')

  const agent = createAgent({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    maxTurns: 10,
    tools: [...getAllBaseTools(), convertUnitsTool, lookupUserTool],
  })

  const r1 = await agent.prompt(
    'Convert 100 km to miles, then convert 72°F to Celsius. Be brief.',
  )
  console.log(`Result: ${r1.text}\n`)

  const r2 = await agent.prompt('Look up user_123 and tell me their plan. Be brief.')
  console.log(`Result: ${r2.text}\n`)

  // ─── Approach B: External MCP Server ───
  console.log('=== Approach B: External MCP Server (same as official SDK) ===\n')
  console.log('(Requires @modelcontextprotocol/server-filesystem installed)')
  console.log('See example 06-mcp-server.ts for the full pattern.\n')
  console.log(
    'Official SDK uses createSdkMcpServer() for in-process MCP.\n' +
    'Open Agent SDK supports external MCP servers via mcpServers option.\n' +
    'For in-process tools, Approach A (native) is simpler and faster.\n',
  )
}

main().catch(console.error)
