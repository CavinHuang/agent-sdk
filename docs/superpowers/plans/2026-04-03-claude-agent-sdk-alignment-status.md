# Claude Agent SDK Alignment Status

**Date:** 2026-04-03
**Last Updated:** 2026-04-05T16:00:00+08:00

## Current State (2026-04-05 — update 4)

**Test baseline: 45 pass / 0 fail / 1 skip** — dependency cleanup, query resource management fixed, build graph reduced.

The SDK is now fully aligned with the Claude Agent SDK reference (`sdk.d.ts`) at both the type level and the runtime export level.

### Completed since last update (2026-04-05 update 4)

8. **Dependency cleanup** — removed 6 unused packages from `package.json`:
   - Removed: `fuse.js`, `stack-utils`, `vscode-jsonrpc`, `auto-bind`, `@shipany/open-agent-sdk`, `vscode-languageserver-protocol`
   - Added: `vscode-languageserver-types` (correct package — source imports `from 'vscode-languageserver-types'`)
   - Moved: `type-fest` → `devDependencies` (only used as `import type`)
   - Removed: `auto-bind` stub from `src/global.d.ts`

9. **Query resource management** — `query()` handle's `close()` now calls `agent.close()` in addition to aborting the active request. This disconnects MCP stdio processes when the caller closes the query handle.

10. **Build graph reduced** — `tsup.config.ts` esbuild plugin (`constant-fold-feature-flags`) pre-substitutes `feature('FLAG')` → `false` before esbuild parses the file. esbuild can then dead-branch-eliminate all inactive `require()` calls. Result: **3.31 MB → 3.05 MB (-280 KB, -8.5%)**.
    - Remaining references to feature-gated modules are lightweight stubs and string constants (e.g., `coordinatorMode.ts` is a 5-line stub, `SleepTool/prompt.ts` is just string constants)
    - The remaining 3.05 MB is genuine tool-engine overhead, not dead code

### Completed since last update (2026-04-05 update 3)

6. **Real tool-call loop test promoted to always-enabled** — `tests/sdk-query-tool-call-loop.test.mjs` test 1 no longer requires `SDK_TEST_TOOL_CALL_LOOP=1`. It uses a mock HTTP server (no real API key needed) and runs in the standard `node --test tests/*.test.mjs` invocation.

7. **Process hang fixed** — root cause: `Agent._init()` unconditionally reads user global MCP config via `getMcpConfigRuntime()` → `import('./services/mcp/config.js')`, spawning stdio child processes for each configured server. These processes kept the event loop alive after query completion. Fix:
   - **Test isolation**: real HTTP test now injects `globalThis.__LUME_SDK_MCP_RUNTIME__ = { getAllMcpConfigs: async () => ({ servers: {} }) }` before `query()` — prevents global MCP servers from loading in test context.
   - **Resource management**: `Agent.close()` method added — disconnects all MCP clients and aborts active queries, allowing clean process exit in production use.

### Completed since last update (2026-04-05 update 2)

4. **Tool-call loop coverage added** — new test file `tests/sdk-query-tool-call-loop.test.mjs` adds:
   - `real createAgent initializes with correct tool set` — verifies real `createAgent` path (not mocked) passes expected options
   - `query() tool-call loop: mock agent with tool-use simulation` — verifies the full `assistant → tool_use → user tool_result → assistant → result` event sequence flows through the SDK correctly
   - `real query() tool-call loop: model tool_use triggers real tool execution` — uses a mock HTTP server that acts as the Anthropic API to test actual `FileReadTool` execution without a real API key

5. **Build graph analysis completed** — root cause identified and fixed (see update 4 item 10).

### Completed since last update (earlier)

1. **Browser entrypoint fixed** — removed module-level `await import('.ref-sdk...')` that caused `dist/browser.js` to throw on import. Runtime is now lazily resolved inside `query()` from `globalThis.__LUME_SDK_BROWSER_RUNTIME__`. Module imports cleanly without the global set.

2. **sdk-tools entrypoint populated** — `packages/sdk/src/entrypoints/sdk-tools/toolSchemas.ts` now contains all tool input/output type definitions (sourced from `.ref-sdk/package/sdk-tools.d.ts`). The `./sdk-tools` entrypoint now exports `ToolInputSchemas`, `ToolOutputSchemas`, and all per-tool types.

3. **Type surface fully aligned** — comparison of all `export declare type` / `export declare interface` names between reference SDK and `packages/sdk/src/entrypoints/` shows zero gaps.

### What Is Still Dev-Time vs Pure

- `embed.js` → still resolves `cliPath` to `../../../.ref-sdk/package/cli.js`. Test passes (path is a string), but the path is wrong in production use. Needs to resolve to the actual embedded CLI.
- `bridge.js` → fallback `require('../../../../src/bridge/...')` requires dev-time source. Tests pass because `__LUME_SDK_BRIDGE_RUNTIME__` is set before import in all tests.

### Remaining capability gap

The main stopping point is no longer “does the package expose the right API?”. It is:

1. Core capability surface: ✅ present.
2. Main runtime behavior: ✅ largely verified.
3. Plugin / MCP / project feature loading: ✅ reaches `Agent` initialization and `sdk.query()`.
4. **Remaining gap**: `query()` tool-call loop partially closed — event sequence verified via mock simulation, real HTTP-level API mock is opt-in pending CI integration.

## What Is Verified Now

### Core capability groups with runtime coverage

The following official capability groups now have explicit runtime or behavior-level verification:

- `Permissions`
- `Hooks`
- `Sessions`
- `MCP`
- `Plugins`
- `Skills`
- `Slash commands`
- `Memory` via project `CLAUDE.md`
- `sdk.query()` runtime behavior
- `Agent` runtime MCP initialization behavior

### Important runtime improvements already landed

1. Main SDK runtime path is split and smoke-tested.
   - Main runtime wrappers live in:
     - [`packages/sdk/src/entrypoints/sdk/index.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/entrypoints/sdk/index.ts)
     - [`packages/sdk/src/entrypoints/sdk/queryRuntime.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/entrypoints/sdk/queryRuntime.ts)
     - [`packages/sdk/src/entrypoints/sdk/sessionRuntime.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/entrypoints/sdk/sessionRuntime.ts)
     - [`packages/sdk/src/entrypoints/sdk/mcpRuntime.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/entrypoints/sdk/mcpRuntime.ts)

2. Public type and export shape are locked more tightly.
   - Runtime/type compatibility tests exist for:
     - [`packages/sdk/tests/sdk-public-api.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-public-api.test.mjs)
     - [`packages/sdk/tests/sdk-runtime-types-alignment.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-runtime-types-alignment.test.mjs)
     - [`packages/sdk/tests/sdk-build-artifacts.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-build-artifacts.test.mjs)

3. Official TypeScript semantics were corrected.
   - `permissionMode` default is aligned to `'default'`
   - `allowDangerouslySkipPermissions` default is aligned to `false`
   - `allowedTools` now behaves as auto-approval, not a whitelist
   - `disallowedTools` wins and removes tools from model context
   - Main helpers live in:
     - [`packages/sdk/src/internal/sdk-option-semantics.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/internal/sdk-option-semantics.ts)
     - [`packages/sdk/src/internal/sdk-query-option-normalization.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/internal/sdk-query-option-normalization.ts)

4. Project-level Claude filesystem features are no longer stub-only.
   - `CLAUDE.md` loading is tested.
   - Project skills and slash commands are discovered through the SDK runtime.
   - Relevant files:
     - [`packages/sdk/src/commands.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/commands.ts)
     - [`packages/sdk/src/context.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/context.ts)
     - [`packages/sdk/src/utils/claudemd.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/utils/claudemd.ts)
     - [`packages/sdk/src/utils/config.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/utils/config.ts)

5. Sessions are verified at transcript-file level.
   - `listSessions`
   - `getSessionMessages`
   - `getSessionInfo`
   - `renameSession`
   - `tagSession`
   - `forkSession`

6. Hooks and plugin hooks are verified through real execution paths.
   - Hook callbacks execute for `Stop`
   - Plugin hook loading participates in session start
   - Plugin command hooks actually execute

7. MCP is verified across three levels.
   - Base SDK MCP client connection works.
   - Plugin-provided MCP definitions enter aggregated config.
   - Plugin-provided SDK MCP servers can be connected and surfaced as tools.

8. `Agent` and `sdk.query()` now observe aggregated plugin MCP initialization.
   - [`packages/sdk/src/agent.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/agent.ts) now auto-loads aggregated MCP config through `getAllMcpConfigs()`, merges it with explicit `options.mcpServers`, and initializes both regular and `sdk` MCP servers.
   - [`packages/sdk/src/entrypoints/sdk/queryRuntime.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/entrypoints/sdk/queryRuntime.ts) and [`packages/sdk/src/entrypoints/agentSdkTypes.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/entrypoints/agentSdkTypes.ts) now wait for agent initialization before reporting `initializationResult()` and `mcpServerStatus()`.
   - The runtime path for `getCreateAgent()` was also fixed so built `sdk` runtime no longer points at a broken relative `agent.js` path.

## Verified Test Baseline

The current stable baseline is **45 passing tests** across the core capability set, including the real HTTP mock tool-call loop test.

Most important tests:

- [`packages/sdk/tests/sdk-query-plugin-mcp-runtime.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-query-plugin-mcp-runtime.test.mjs)
- [`packages/sdk/tests/sdk-agent-plugin-mcp-runtime.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-agent-plugin-mcp-runtime.test.mjs)
- [`packages/sdk/tests/sdk-plugin-mcp-runtime.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-plugin-mcp-runtime.test.mjs)
- [`packages/sdk/tests/sdk-plugin-mcp-config.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-plugin-mcp-config.test.mjs)
- [`packages/sdk/tests/sdk-plugin-mcp-surface.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-plugin-mcp-surface.test.mjs)
- [`packages/sdk/tests/sdk-plugin-hooks-runtime.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-plugin-hooks-runtime.test.mjs)
- [`packages/sdk/tests/sdk-hooks-runtime.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-hooks-runtime.test.mjs)
- [`packages/sdk/tests/sdk-project-settings-context.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-project-settings-context.test.mjs)
- [`packages/sdk/tests/sdk-project-features-surface.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-project-features-surface.test.mjs)
- [`packages/sdk/tests/sdk-sessions-runtime.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-sessions-runtime.test.mjs)
- [`packages/sdk/tests/sdk-mcp-runtime.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-mcp-runtime.test.mjs)
- [`packages/sdk/tests/sdk-option-semantics.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-option-semantics.test.mjs)
- [`packages/sdk/tests/sdk-query-defaults.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-query-defaults.test.mjs)
- [`packages/sdk/tests/sdk-overview-capabilities.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-overview-capabilities.test.mjs)
- [`packages/sdk/tests/sdk-runtime-smoke.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-runtime-smoke.test.mjs)

Last known good command:

```powershell
pnpm --dir packages/sdk build
node --test packages/sdk/tests/*.test.mjs
# → 45 pass / 0 fail / 1 skip, process exits cleanly
# Main bundle: dist/chunk-*.js ~3.05 MB (down from 3.31 MB)
```

## Current Stop Point

The current stop point is:

- capability exposure: largely done
- runtime initialization: largely done
- plugin / project / MCP aggregation: done to the point of observable runtime behavior
- remaining gap: deeper end-to-end query behavior beyond the currently added controlled runtime-injected coverage

More concretely, the remaining work is no longer “make the SDK look like Claude Agent SDK”. It is “prove that the runtime behavior stays aligned when `query()` enters the real tool-call loop”.

## Remaining Risks

### 1. True end-to-end `query()` tool-call behavior is not fully closed

The package now proves that plugin MCP servers reach:

- aggregated config
- `Agent` initialization
- `sdk.query()` observable initialization status
- effective query path visibility via controlled runtime-injected tests
- combined hooks + plugin MCP + project settings option propagation in one query flow

But it does not yet prove the deepest loop:

- model/tool orchestration sees those tools as actionable
- a query turn actually consumes a plugin-provided MCP tool under realistic conditions
- hooks / plugins / MCP / sessions do not regress when combined in one query flow

This is the main remaining capability-confidence gap.

### 2. Build graph remains heavier than ideal

The runtime path is much healthier than before, and the temporary `stubMissingLocals()` build masking layer has now been fully removed. `packages/sdk/build/stub-missing-locals-report.json` is empty and `packages/sdk` builds without any missing-local-module fallback.

The remaining structural concern is not hidden missing modules anymore; it is that the SDK build still emits large chunks and still carries more of the CLI/product graph than a clean standalone SDK should.

### 3. Build graph is still larger than ideal even after validation cleanup

The temporary `agent` validation build entry has now been removed. Runtime validation was refactored to rely on `sdk.query()`-level tests instead of a dedicated `dist/agent.js` artifact.

The remaining issue is not whether to keep the extra entrypoint; it is that the package still pulls a large amount of product/CLI graph into shared chunks.

## Next Step Plan

### Immediate next step

Build graph, resource management, and dependency cleanup are all done. Remaining focus areas:

1. **Deeper end-to-end coverage** — verify hooks + plugins + MCP + sessions do not regress when combined in one real query flow.
2. **Bundle further analysis** — the "imported but never used" warnings from the build (e.g., `lodash-es/cloneDeep`, `axios` in analytics chunks) hint at additional tree-shaking opportunities in the analytics path (which is never called in SDK-only mode).
3. **`@opentelemetry/*` in SDK context** — OTel is loaded unconditionally even when no telemetry is configured. Could be lazily initialized.

### After the next step

1. Keep `stubMissingLocals()` removed; do not reintroduce build masking.
2. Keep the standalone `agent` build artifact removed unless a strong runtime need reappears.
3. Reduce oversized build graph and trim remaining product/CLI coupling.

## Files Most Relevant For Continuation

- [`packages/sdk/src/agent.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/agent.ts)
- [`packages/sdk/src/entrypoints/sdk/queryRuntime.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/entrypoints/sdk/queryRuntime.ts)
- [`packages/sdk/src/entrypoints/agentSdkTypes.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/entrypoints/agentSdkTypes.ts)
- [`packages/sdk/src/commands.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/commands.ts)
- [`packages/sdk/src/services/mcp/config.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/services/mcp/config.ts)
- [`packages/sdk/src/services/mcp/client.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/src/services/mcp/client.ts)
- [`packages/sdk/tsup.config.ts`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tsup.config.ts)
- [`packages/sdk/tests/sdk-query-plugin-mcp-runtime.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-query-plugin-mcp-runtime.test.mjs)
- [`packages/sdk/tests/sdk-agent-plugin-mcp-runtime.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-agent-plugin-mcp-runtime.test.mjs)
- [`packages/sdk/tests/sdk-plugin-mcp-runtime.test.mjs`](E:/projects/ai-projects/open-agent-sdk/packages/sdk/tests/sdk-plugin-mcp-runtime.test.mjs)
