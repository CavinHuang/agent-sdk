/**
 * Setup global variables that are normally injected by Bun at build time.
 * Must be imported before any other module.
 */

import { createRequire } from 'module'

const _global = globalThis as any
const _require = createRequire(import.meta.url)

if (!_global.MACRO) {
  _global.MACRO = {
    VERSION: '0.1.0',
    VERSION_CHANGELOG: '',
    ISSUES_EXPLAINER: 'report the issue at https://github.com/shipany-ai/open-agent-sdk/issues',
    BUILD_TIME: new Date().toISOString(),
    COMMIT_HASH: 'dev',
  }
}

if (!_global.Gates) {
  _global.Gates = new Proxy({}, { get: () => false })
}

if (typeof _global.Bun === 'undefined') {
  // Lazy-load npm semver for the Bun.semver polyfill
  let _npmSemver: typeof import('semver') | undefined
  function requireSemver(): typeof import('semver') {
    if (!_npmSemver) {
      _npmSemver = _require('semver') as typeof import('semver')
    }
    return _npmSemver
  }

  _global.Bun = {
    env: process.env,
    version: '0.0.0',
    sleep: (ms: number) => new Promise(r => setTimeout(r, ms)),
    semver: {
      satisfies: (version: string, range: string) =>
        requireSemver().satisfies(version, range, { loose: true }),
      order: (a: string, b: string) =>
        requireSemver().compare(a, b, { loose: true }),
    },
  }
}

// Initialize config system (must be called before any config access)
import { enableConfigs } from './utils/config.js'
enableConfigs()

// Initialize bootstrap state with current working directory
import { setOriginalCwd, setCwdState, setProjectRoot } from './bootstrap/state.js'
const _cwd = process.cwd()
try { setOriginalCwd(_cwd) } catch {}
try { setCwdState(_cwd) } catch {}
try { setProjectRoot(_cwd) } catch {}
