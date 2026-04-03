// SDK stub — module not needed in SDK build

export const DANGEROUS_CMDLETS: any[] = []

export const DANGEROUS_SCRIPT_BLOCK_CMDLETS = new Set<string>()

export const FILEPATH_EXECUTION_CMDLETS = new Set<string>()

export const MODULE_LOADING_CMDLETS = new Set<string>()

export function isDangerousCmdlet(..._args: any[]): any {
  return false as any
}
