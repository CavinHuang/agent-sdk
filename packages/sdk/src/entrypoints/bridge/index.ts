import type {
  PermissionMode,
  SDKControlRequest,
  SDKControlResponse,
  SDKMessage,
} from '../agentSdkTypes.js'

export type SessionState = 'idle' | 'running' | 'requires_action'

export type BridgeSessionHandle = {
  readonly sessionId: string
  getSequenceNum(): number
  isConnected(): boolean
  write(msg: SDKMessage): void
  sendResult(): void
  sendControlRequest(req: SDKControlRequest): void
  sendControlResponse(res: SDKControlResponse): void
  sendControlCancelRequest(requestId: string): void
  reconnectTransport(opts: {
    ingressToken: string
    apiBaseUrl: string
    epoch?: number
  }): Promise<void>
  reportState(state: SessionState): void
  reportMetadata(metadata: Record<string, unknown>): void
  reportDelivery(eventId: string, status: 'processing' | 'processed'): void
  flush(): Promise<void>
  close(): void
}

export type AttachBridgeSessionOptions = {
  sessionId: string
  ingressToken: string
  apiBaseUrl: string
  epoch?: number
  initialSequenceNum?: number
  heartbeatIntervalMs?: number
  outboundOnly?: boolean
  onInboundMessage?: (msg: SDKMessage) => void | Promise<void>
  onPermissionResponse?: (res: SDKControlResponse) => void
  onInterrupt?: () => void
  onSetModel?: (model: string | undefined) => void
  onSetMaxThinkingTokens?: (tokens: number | null) => void
  onSetPermissionMode?: (
    mode: PermissionMode,
  ) => { ok: true } | { ok: false; error: string }
  onClose?: (code?: number) => void
}

export type RemoteCredentials = {
  worker_jwt: string
  api_base_url: string
  expires_in: number
  worker_epoch: number
}

function notImplemented(name: string): never {
  throw new Error(
    `${name} is not implemented in this package build yet.`,
  )
}

export async function attachBridgeSession(
  _opts: AttachBridgeSessionOptions,
): Promise<BridgeSessionHandle> {
  return notImplemented('attachBridgeSession')
}

export async function createCodeSession(
  _baseUrl: string,
  _accessToken: string,
  _title: string,
  _timeoutMs: number,
  _tags?: string[],
): Promise<string | null> {
  return notImplemented('createCodeSession')
}

export async function fetchRemoteCredentials(
  _sessionId: string,
  _baseUrl: string,
  _accessToken: string,
  _timeoutMs: number,
  _trustedDeviceToken?: string,
): Promise<RemoteCredentials | null> {
  return notImplemented('fetchRemoteCredentials')
}
