// SDK stub — module not needed in SDK build

export function assignTeammateColor(_teammateId: string): string {
  return '#888888'
}

export async function createTeammatePaneInSwarmView(
  _sanitizedName: string,
  _teammateColor: string,
): Promise<{ paneId: string; isFirstTeammate: boolean }> {
  return { paneId: 'stub-pane', isFirstTeammate: false }
}

export async function enablePaneBorderStatus(): Promise<void> {}

export function isInsideTmux(): boolean {
  return false
}

export async function sendCommandToPane(
  _paneId: string,
  _command: string,
  _useSwarmSocket?: boolean,
): Promise<void> {}

export function clearTeammateColors(): void {}
