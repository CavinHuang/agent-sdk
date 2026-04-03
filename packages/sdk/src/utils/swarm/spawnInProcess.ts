// SDK stub — module not needed in SDK build

export type InProcessSpawnConfig = Record<string, unknown>

export type InProcessSpawnResult = {
  success: boolean
  error?: string
  taskId?: string
  teammateContext?: { parentSessionId: string }
  abortController?: AbortController
}

export async function spawnInProcessTeammate(
  _config: InProcessSpawnConfig,
  _context?: unknown,
): Promise<InProcessSpawnResult> {
  return {
    success: true,
    taskId: 'stub-task',
    teammateContext: { parentSessionId: '' },
    abortController: new AbortController(),
  }
}

export function killInProcessTeammate(_taskId: string, _setAppState?: unknown): void {}
