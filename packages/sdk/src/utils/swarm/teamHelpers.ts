// SDK stub — module not needed in SDK build

export type TeamMember = {
  name: string
  agentId?: string
  agentType?: string
  model?: string
  prompt?: string
  color?: string
  planModeRequired?: boolean
  joinedAt?: number
  tmuxPaneId?: string
  cwd?: string
  worktreePath?: string
  subscriptions?: unknown[]
  backendType?: string
  isActive?: boolean
  mode?: string
}

export type TeamFile = {
  name: string
  description?: string
  createdAt: number
  leadAgentId: string
  leadSessionId: string
  members: TeamMember[]
  hiddenPaneIds?: string[]
}

export function readTeamFile(_teamName?: string): TeamFile | null {
  return { name: '', createdAt: 0, leadAgentId: '', leadSessionId: '', members: [] }
}

export async function readTeamFileAsync(_teamName?: string): Promise<TeamFile | null> {
  return { name: '', createdAt: 0, leadAgentId: '', leadSessionId: '', members: [] }
}

export async function writeTeamFileAsync(
  _teamName: string,
  _data: TeamFile,
): Promise<void> {}

export function sanitizeAgentName(name: string): string {
  return name
}

export function sanitizeName(name: string): string {
  return name
}

export function removeTeammateFromTeamFile(..._args: unknown[]): void {}

export function setMemberMode(..._args: unknown[]): void {}

export function cleanupTeamDirectories(..._args: unknown[]): void {}

export function unregisterTeamForSessionCleanup(..._args: unknown[]): void {}

export function getTeamFilePath(..._args: unknown[]): string {
  return ''
}

export function registerTeamForSessionCleanup(..._args: unknown[]): void {}
