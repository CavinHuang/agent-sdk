/**
 * SDK initialization — must be imported before any other module.
 * Initializes config system and bootstrap state.
 */

import { enableConfigs } from './utils/config.js'
enableConfigs()

import { setOriginalCwd, setCwdState, setProjectRoot } from './bootstrap/state.js'
const _cwd = process.cwd()
try { setOriginalCwd(_cwd) } catch {}
try { setCwdState(_cwd) } catch {}
try { setProjectRoot(_cwd) } catch {}
