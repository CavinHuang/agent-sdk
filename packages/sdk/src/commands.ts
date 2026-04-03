/**
 * SDK-only commands stub.
 *
 * The full CLI has ~92 slash-commands; the SDK needs none of them.
 * We keep the type re-exports so downstream code that references
 * `Command` / `getCommands` still compiles, but everything returns empty.
 */

// Re-export types from the centralized location
export type {
  Command,
  CommandBase,
  CommandResultDisplay,
  LocalCommandResult,
  LocalJSXCommandContext,
  PromptCommand,
  ResumeEntrypoint,
} from './types/command.js'
export { getCommandName, isCommandEnabled } from './types/command.js'

import type { Command } from './types/command.js'

/** INTERNAL_ONLY_COMMANDS — empty in SDK build */
export const INTERNAL_ONLY_COMMANDS: Command[] = []

/** Returns an empty command list — the SDK has no slash-commands. */
export async function getCommands(_cwd: string): Promise<Command[]> {
  return []
}

export const builtInCommandNames = (): Set<string> => new Set()

export function clearCommandMemoizationCaches(): void {}
export function clearCommandsCache(): void {}

export function getMcpSkillCommands(
  _mcpCommands: readonly Command[],
): readonly Command[] {
  return []
}

export const getSkillToolCommands = async (
  _cwd: string,
): Promise<Command[]> => []

export const getSlashCommandToolSkills = async (
  _cwd: string,
): Promise<Command[]> => []

export const REMOTE_SAFE_COMMANDS: Set<Command> = new Set()
export const BRIDGE_SAFE_COMMANDS: Set<Command> = new Set()

export function isBridgeSafeCommand(_cmd: Command): boolean {
  return false
}

export function filterCommandsForRemoteMode(commands: Command[]): Command[] {
  return commands
}

export function findCommand(
  commandName: string,
  commands: Command[],
): Command | undefined {
  return commands.find(
    _ => _.name === commandName || _.aliases?.includes(commandName),
  )
}

export function hasCommand(commandName: string, commands: Command[]): boolean {
  return findCommand(commandName, commands) !== undefined
}

export function getCommand(commandName: string, commands: Command[]): Command {
  const command = findCommand(commandName, commands)
  if (!command) {
    throw ReferenceError(`Command ${commandName} not found.`)
  }
  return command
}

export function meetsAvailabilityRequirement(_cmd: Command): boolean {
  return true
}

export function formatDescriptionWithSource(cmd: Command): string {
  return cmd.description
}
