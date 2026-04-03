/**
 * Shim for bun:bundle imports.
 * In the original Claude Code, these are Bun build-time macros
 * that get replaced at compile time. In Node.js runtime,
 * feature() always returns false (all features disabled by default).
 */

export function feature(_name: string): boolean {
  return false
}

export function embed(_path: string): any {
  return null
}
