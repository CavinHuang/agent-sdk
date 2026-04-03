// SDK stub — module not needed in SDK build

export function ensureBackendsRegistered(): void {}

const stubBackend = {
  killPane(_paneId: string, _externalSession?: boolean): void {},
}

export function getBackendByType(_type: unknown): typeof stubBackend {
  return stubBackend
}

export async function detectAndGetBackend(): Promise<{
  needsIt2Setup: boolean
  backend: { type: string }
}> {
  return { needsIt2Setup: false, backend: { type: 'tmux' } }
}

export function isInProcessEnabled(): boolean {
  return false
}

export function markInProcessFallback(): void {}

export function resetBackendDetection(): void {}

export function getResolvedTeammateMode(): string {
  return 'auto'
}
