/**
 * Example 11: Hooks — Lifecycle Interception
 *
 * Demonstrates PreToolUse / PostToolUse hooks for:
 *   - Auditing every tool call
 *   - Blocking dangerous operations (e.g. writing to .env files)
 *   - Modifying tool inputs
 *
 * Official SDK equivalent:
 *   https://platform.claude.com/docs/en/agent-sdk/hooks
 *
 * Run: npx tsx examples/11-hooks.ts
 */
import { query } from '@shipany/open-agent-sdk'

async function main() {
  console.log('--- Example 11: Hooks ---\n')

  for await (const message of query({
    prompt:
      'Create a file /tmp/oas-hook-test.txt with "Hello from hooks", ' +
      'then read it back. Be brief.',
    options: {
      allowedTools: ['Bash', 'Read', 'Write'],
      permissionMode: 'bypassPermissions',
      hooks: {
        /**
         * PreToolUse: fires before a tool is executed.
         * Return { permissionDecision: 'deny' } to block.
         * Return { updatedInput: {...} } to modify arguments.
         * Return {} to allow normally.
         */
        PreToolUse: [
          {
            // Match all tools — no matcher means "every tool"
            hooks: [
              async (input: any) => {
                const toolName = input.tool_name
                const toolInput = input.tool_input || {}

                console.log(`[PreToolUse] ${toolName}`)

                // Block writing to .env files
                if (
                  (toolName === 'Write' || toolName === 'Edit') &&
                  toolInput.file_path?.endsWith('.env')
                ) {
                  console.log(`  ⛔ BLOCKED: cannot write to .env files`)
                  return { permissionDecision: 'deny' }
                }

                return {} // allow
              },
            ],
          },
        ],

        /**
         * PostToolUse: fires after a tool returns.
         * Great for auditing / logging.
         */
        PostToolUse: [
          {
            hooks: [
              async (input: any) => {
                const toolName = input.tool_name
                const output = input.tool_result
                const preview =
                  typeof output === 'string'
                    ? output.slice(0, 80)
                    : JSON.stringify(output).slice(0, 80)
                console.log(`[PostToolUse] ${toolName} → ${preview}`)
                return {}
              },
            ],
          },
        ],

        /**
         * Stop: fires when the agent session is about to end.
         */
        Stop: [
          {
            hooks: [
              async (input: any) => {
                console.log(`\n[Stop] Session ended. Reason: ${input.stop_hook_reason || 'unknown'}`)
                return {}
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
        if ('text' in block && block.text?.trim()) {
          console.log(`\nAssistant: ${block.text}`)
        }
      }
    }
    if (msg.type === 'result') {
      console.log(`\n--- ${msg.subtype} ---`)
    }
  }
}

main().catch(console.error)
