// SDK stub — module not needed in SDK build

export type OAuthClientConfig = Record<string, unknown>

export class OAuthClient {
  constructor(_config?: OAuthClientConfig) {}
}

export function isOAuthTokenExpired(_token?: unknown): boolean {
  return false
}

export async function refreshOAuthToken(): Promise<void> {}

export function shouldUseClaudeAIAuth(): boolean {
  return false
}

export function getOrganizationUUID(): string | undefined {
  return undefined
}
