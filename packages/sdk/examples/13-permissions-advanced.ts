/**
 * Example 13: Advanced Permissions
 *
 * Demonstrates the full permission system:
 *   - Permission modes (bypassPermissions, acceptEdits, plan, default)
 *   - allowedTools whitelist
 *   - canUseTool callback for runtime approval
 *   - Combining hooks + permissions
 *
 * Official SDK equivalent:
 *   https://platform.claude.com/docs/en/agent-sdk/permissions
 *
 * Run: npx tsx examples/13-permissions-advanced.ts
 */
import { query, createAgent } from '@shipany/open-agent-sdk'

async function example1_denyByDefault() {
  console.log('=== 1. Locked-down agent: only Read + Grep allowed ===\n')

  for await (const message of query({
    prompt: 'Read package.json and show the project name. Be brief.',
    options: {
      // Only these tools can be used; everything else is denied
      allowedTools: ['Read', 'Grep'],
      permissionMode: 'default',

      // canUseTool is called for any tool NOT in allowedTools
      canUseTool: async (toolName: string, toolInput: any) => {
        console.log(`[canUseTool] ${toolName} → DENIED (not in allowedTools)`)
        return false // deny
      },
    },
  })) {
    const msg = message as any
    if (msg.type === 'assistant') {
      for (const block of msg.message?.content || []) {
        if ('text' in block && block.text?.trim()) console.log(block.text)
        if ('name' in block) console.log(`  [${block.name}]`)
      }
    }
    if (msg.type === 'result') console.log(`\n--- ${msg.subtype} ---\n`)
  }
}

async function example2_acceptEdits() {
  console.log('=== 2. acceptEdits: auto-approve file edits ===\n')

  const agent = createAgent({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    maxTurns: 5,
    permissionMode: 'acceptEdits', // Write/Edit auto-approved
  })

  const result = await agent.prompt(
    'Use Bash to run "echo hello" and read package.json. Be brief.',
  )
  console.log(`Result: ${result.text}\n`)
}

async function example3_planMode() {
  console.log('=== 3. Plan mode: analyze without executing ===\n')

  const agent = createAgent({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    maxTurns: 5,
    permissionMode: 'plan',
    allowedTools: ['Read', 'Glob', 'Grep'],
  })

  const result = await agent.prompt(
    'Analyze the codebase structure and propose a refactoring plan for src/agent.ts. ' +
    'Do NOT make any changes.',
  )
  console.log(`Plan: ${result.text}\n`)
}

async function example4_hooksPlusPermissions() {
  console.log('=== 4. Hooks + Permissions combined ===\n')

  for await (const message of query({
    prompt: 'Read package.json. Be brief.',
    options: {
      allowedTools: ['Read', 'Glob'],
      permissionMode: 'bypassPermissions',
      hooks: {
        // Hooks run BEFORE permission mode checks
        PreToolUse: [
          {
            matcher: 'Bash', // Only match Bash tool
            hooks: [
              async () => {
                console.log('[Hook] Bash blocked by PreToolUse hook')
                return { permissionDecision: 'deny' }
              },
            ],
          },
        ],
      },
    },
  })) {
    const msg = message as any
    if (msg.type === 'assistant') {
      for (const block of msg.message?.content || []) {
        if ('text' in block && block.text?.trim()) console.log(block.text)
      }
    }
    if (msg.type === 'result') console.log(`\n--- ${msg.subtype} ---\n`)
  }
}

async function main() {
  console.log('--- Example 13: Advanced Permissions ---\n')

  await example1_denyByDefault()
  await example2_acceptEdits()
  await example3_planMode()
  await example4_hooksPlusPermissions()
}

main().catch(console.error)
