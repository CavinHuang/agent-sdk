import { createRequire } from 'module'

const _require = createRequire(import.meta.url)

function readPackageVersion(): string {
  try {
    const pkg = _require('../../package.json')
    return pkg.version ?? '0.0.1'
  } catch {
    return '0.0.1'
  }
}

export const VERSION = readPackageVersion()
export const BUILD_TIME = ''
export const COMMIT_HASH = 'dev'
export const VERSION_CHANGELOG = ''
export const ISSUES_EXPLAINER =
  'report the issue at https://github.com/anthropics/claude-code/issues'
export const FEEDBACK_CHANNEL =
  'https://github.com/anthropics/claude-code/issues'
