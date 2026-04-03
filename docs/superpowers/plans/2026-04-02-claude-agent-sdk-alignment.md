# Claude Agent SDK Alignment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align `packages/sdk` to the reference Claude Agent SDK package in `.ref-sdk/package`, including package exports, public type surface, runtime entrypoints, and removal of extra SDK-only functionality.

**Architecture:** Drive the migration from the reference package contract inward. First lock the target entrypoints and public declaration surface, then rebuild `packages/sdk` around those entrypoints using local `src` implementations where available and narrow reconstructed adapters where not. Delete code that is not reachable from the target public contract.

**Tech Stack:** TypeScript, tsup, Node ESM, Node built-in test runner, zod, existing monorepo source reuse from `src/`

---

## Chunk 1: Contract Inventory And Baseline Fixtures

### Task 1: Capture the reference package contract as local fixtures

**Files:**
- Create: `packages/sdk/scripts/extract-reference-contract.ts`
- Create: `packages/sdk/reference/exports.json`
- Create: `packages/sdk/reference/public-api/sdk.json`
- Create: `packages/sdk/reference/public-api/browser.json`
- Create: `packages/sdk/reference/public-api/bridge.json`
- Create: `packages/sdk/reference/public-api/embed.json`
- Create: `packages/sdk/reference/public-api/sdk-tools.json`
- Modify: `packages/sdk/package.json`

- [ ] **Step 1: Write the failing contract snapshot test**

```js
// packages/sdk/tests/reference-contract.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('reference contract fixtures exist for all target entrypoints', async () => {
  const exportsJson = JSON.parse(
    await readFile(new URL('../reference/exports.json', import.meta.url), 'utf8'),
  )

  assert.deepEqual(Object.keys(exportsJson).sort(), [
    '.',
    './browser',
    './bridge',
    './embed',
    './sdk-tools',
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/sdk/tests/reference-contract.test.mjs`
Expected: FAIL because `packages/sdk/reference/exports.json` does not exist yet.

- [ ] **Step 3: Implement the minimal extractor and fixtures**

```ts
// packages/sdk/scripts/extract-reference-contract.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(process.cwd(), 'packages/sdk')
const refRoot = resolve(process.cwd(), '.ref-sdk/package')

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(value, null, 2) + '\n')
}

const pkg = JSON.parse(await readFile(resolve(refRoot, 'package.json'), 'utf8'))
await writeJson(resolve(root, 'reference/exports.json'), pkg.exports)
```

- [ ] **Step 4: Extend the extractor to record public API inventories**

Implementation details:
- Parse `.ref-sdk/package/sdk.d.ts`
- Parse `.ref-sdk/package/browser-sdk.d.ts`
- Parse `.ref-sdk/package/bridge.d.ts`
- Parse `.ref-sdk/package/embed.d.ts`
- Parse `.ref-sdk/package/sdk-tools.d.ts`
- Record top-level exported symbols or declaration names into the matching `packages/sdk/reference/public-api/*.json` files

- [ ] **Step 5: Add a package script for refreshing fixtures**

Modify `packages/sdk/package.json` to add:

```json
{
  "scripts": {
    "refresh:reference-contract": "node ./scripts/extract-reference-contract.ts"
  }
}
```

- [ ] **Step 6: Run the extractor**

Run: `node packages/sdk/scripts/extract-reference-contract.ts`
Expected: fixture JSON files appear under `packages/sdk/reference/`

- [ ] **Step 7: Re-run the contract snapshot test**

Run: `node --test packages/sdk/tests/reference-contract.test.mjs`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/sdk/scripts/extract-reference-contract.ts packages/sdk/reference packages/sdk/tests/reference-contract.test.mjs packages/sdk/package.json
git commit -m "test: capture claude agent sdk reference contract"
```

### Task 2: Record the current SDK export mismatch against the reference

**Files:**
- Create: `packages/sdk/tests/current-package-shape.test.mjs`
- Create: `packages/sdk/docs/current-package-gap.md`
- Modify: `packages/sdk/package.json`

- [ ] **Step 1: Write the failing package-shape test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import pkg from '../package.json' with { type: 'json' }

test('package exports match the reference entrypoint set', () => {
  assert.deepEqual(Object.keys(pkg.exports).sort(), [
    '.',
    './browser',
    './bridge',
    './embed',
    './sdk-tools',
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/sdk/tests/current-package-shape.test.mjs`
Expected: FAIL because the current package only exports `.` and `./types`.

- [ ] **Step 3: Document the known gap**

Write `packages/sdk/docs/current-package-gap.md` with:
- Current `package.json` export map
- Reference export map
- Known missing entrypoints
- Known extra local-only export (`./types`)

- [ ] **Step 4: Keep the failing test in place for the next chunk**

Do not update package exports yet. This test should remain red until the package entrypoints are rebuilt.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/tests/current-package-shape.test.mjs packages/sdk/docs/current-package-gap.md
git commit -m "test: lock current package export gap"
```

## Chunk 2: Package Entry Points And Build Output

### Task 3: Rebuild the package exports and tsup entrypoint graph

**Files:**
- Modify: `packages/sdk/package.json`
- Modify: `packages/sdk/tsup.config.ts`
- Create: `packages/sdk/src/entrypoints/sdk/index.ts`
- Create: `packages/sdk/src/entrypoints/browser/index.ts`
- Create: `packages/sdk/src/entrypoints/bridge/index.ts`
- Create: `packages/sdk/src/entrypoints/embed/index.ts`
- Create: `packages/sdk/src/entrypoints/sdk-tools/index.ts`
- Create: `packages/sdk/tests/package-exports-runtime.test.mjs`

- [ ] **Step 1: Write the failing runtime export-resolution test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

const entrypoints = ['.', './browser', './bridge', './embed', './sdk-tools']

for (const specifier of entrypoints) {
  test(`dist resolves ${specifier}`, async () => {
    const mod = await import(
      new URL(
        specifier === '.'
          ? '../dist/sdk.js'
          : `../dist/${specifier.slice(2).replace(/\\/g, '/')}.js`,
        import.meta.url,
      ).href
    )
    assert.ok(mod)
  })
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/sdk/tests/package-exports-runtime.test.mjs`
Expected: FAIL because only `dist/sdk.js` is built today.

- [ ] **Step 3: Update `package.json` exports to match the reference layout**

Target shape:

```json
{
  "exports": {
    ".": { "types": "./dist/sdk.d.ts", "default": "./dist/sdk.js" },
    "./embed": { "types": "./dist/embed.d.ts", "default": "./dist/embed.js" },
    "./browser": { "types": "./dist/browser.d.ts", "default": "./dist/browser.js" },
    "./bridge": { "types": "./dist/bridge.d.ts", "default": "./dist/bridge.js" },
    "./sdk-tools": { "types": "./dist/sdk-tools.d.ts" },
    "./sdk-tools.js": { "types": "./dist/sdk-tools.d.ts" }
  }
}
```

- [ ] **Step 4: Replace the tsup entry map**

Update `packages/sdk/tsup.config.ts` so the build emits:
- `dist/sdk.js`
- `dist/browser.js`
- `dist/bridge.js`
- `dist/embed.js`
- `dist/sdk-tools.js` if a runtime stub is required

Remove the stub-missing-locals plugin if it is no longer needed after dependency cleanup. If it is still needed temporarily, constrain it to a short-lived migration path and add a TODO comment describing its removal criteria.

- [ ] **Step 5: Create minimal entrypoint wrapper files**

Initial contents should be small:
- `src/entrypoints/sdk/index.ts` re-exports the main public SDK surface
- `src/entrypoints/browser/index.ts` re-exports browser-compatible symbols and `query`
- `src/entrypoints/bridge/index.ts` re-exports bridge APIs
- `src/entrypoints/embed/index.ts` exports the CLI/embed path contract
- `src/entrypoints/sdk-tools/index.ts` exports the tool schema type surface

- [ ] **Step 6: Wire `src/sdk.ts` and related old entrypoints toward the new structure**

Use `src/sdk.ts` as a compatibility barrel or thin re-export only if it still helps the dist layout. The public contract should originate from the new `src/entrypoints/*` files.

- [ ] **Step 7: Build the package**

Run: `pnpm --dir packages/sdk build`
Expected: `dist/` contains artifacts for all target entrypoints.

- [ ] **Step 8: Re-run both package-shape tests**

Run: `node --test packages/sdk/tests/current-package-shape.test.mjs packages/sdk/tests/package-exports-runtime.test.mjs`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/sdk/package.json packages/sdk/tsup.config.ts packages/sdk/src/entrypoints packages/sdk/tests/package-exports-runtime.test.mjs
git commit -m "feat: align sdk package entrypoints with claude agent sdk"
```

## Chunk 3: Public API And Runtime Alignment

### Task 4: Align the main SDK entrypoint to the reference `sdk.d.ts`

**Files:**
- Modify: `packages/sdk/src/sdk.ts`
- Modify: `packages/sdk/src/entrypoints/agentSdkTypes.ts`
- Modify: `packages/sdk/src/entrypoints/sdk/coreTypes.ts`
- Modify: `packages/sdk/src/entrypoints/sdk/runtimeTypes.ts`
- Modify: `packages/sdk/src/entrypoints/sdk/toolTypes.ts`
- Create: `packages/sdk/tests/sdk-public-api.test.mjs`

- [ ] **Step 1: Write the failing public symbol test for the main entrypoint**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

test('main sdk entrypoint exposes required reference symbols', async () => {
  const sdk = await import('../dist/sdk.js')

  for (const key of ['query', 'tool', 'createSdkMcpServer']) {
    assert.ok(key in sdk, `${key} should be exported`)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/sdk/tests/sdk-public-api.test.mjs`
Expected: FAIL because the current `sdk.ts` is an open-agent barrel with extra exports and likely missing exact reference symbols.

- [ ] **Step 3: Trim `src/sdk.ts` to the reference public surface**

Actions:
- Remove open-agent-specific top-level exports that are not present in the reference SDK
- Re-export only symbols justified by `.ref-sdk/package/sdk.d.ts`
- Keep internal implementation imports private unless they are part of the public contract

- [ ] **Step 4: Align type-entry source files with the reference declarations**

Actions:
- Compare `packages/sdk/src/entrypoints/agentSdkTypes.ts` against `.ref-sdk/package/sdk.d.ts`
- Add missing public types and remove local-only ones not present in the target contract
- Ensure generated or mirrored types flow into the main `sdk` declaration output

- [ ] **Step 5: Rebuild and verify the main entrypoint test**

Run: `pnpm --dir packages/sdk build && node --test packages/sdk/tests/sdk-public-api.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src/sdk.ts packages/sdk/src/entrypoints/agentSdkTypes.ts packages/sdk/src/entrypoints/sdk packages/sdk/tests/sdk-public-api.test.mjs
git commit -m "refactor: align main sdk api with reference contract"
```

### Task 5: Implement and align `browser`, `bridge`, `embed`, and `sdk-tools`

**Files:**
- Modify: `packages/sdk/src/entrypoints/browser/index.ts`
- Modify: `packages/sdk/src/entrypoints/bridge/index.ts`
- Modify: `packages/sdk/src/entrypoints/embed/index.ts`
- Modify: `packages/sdk/src/entrypoints/sdk-tools/index.ts`
- Create: `packages/sdk/src/browser/query.ts`
- Create: `packages/sdk/src/bridge/sessionHandle.ts`
- Create: `packages/sdk/src/sdk-tools/types.ts`
- Create: `packages/sdk/tests/browser-entrypoint.test.mjs`
- Create: `packages/sdk/tests/bridge-entrypoint.test.mjs`
- Create: `packages/sdk/tests/embed-entrypoint.test.mjs`
- Create: `packages/sdk/tests/sdk-tools-entrypoint.test.mjs`

- [ ] **Step 1: Write failing tests for each secondary entrypoint**

Examples:

```js
test('embed entrypoint exports a default string path', async () => {
  const mod = await import('../dist/embed.js')
  assert.equal(typeof mod.default, 'string')
})
```

```js
test('bridge entrypoint exports attachBridgeSession', async () => {
  const mod = await import('../dist/bridge.js')
  assert.equal(typeof mod.attachBridgeSession, 'function')
})
```

```js
test('browser entrypoint exports query', async () => {
  const mod = await import('../dist/browser.js')
  assert.equal(typeof mod.query, 'function')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test packages/sdk/tests/browser-entrypoint.test.mjs packages/sdk/tests/bridge-entrypoint.test.mjs packages/sdk/tests/embed-entrypoint.test.mjs packages/sdk/tests/sdk-tools-entrypoint.test.mjs`
Expected: FAIL until the entrypoints are implemented.

- [ ] **Step 3: Implement `embed`**

Actions:
- Mirror the `default string` contract from `.ref-sdk/package/embed.d.ts`
- If the runtime semantics are “path to bundled CLI”, implement a local equivalent that resolves the built CLI/embed asset path from this package
- If no CLI asset exists yet, add the smallest possible adapter and document the follow-up dependency

- [ ] **Step 4: Implement `browser`**

Actions:
- Follow `.ref-sdk/package/browser-sdk.d.ts` exactly for exported types and functions
- Reuse existing query pipeline code where browser-safe
- Add adapters for WebSocket/browser transport if current `packages/sdk` only has node-centric plumbing

- [ ] **Step 5: Implement `bridge`**

Actions:
- Follow `.ref-sdk/package/bridge.d.ts` for exported functions and types
- Prefer local source extraction from `src/bridge` if corresponding implementation exists
- Reconstruct missing pieces from `.ref-sdk/package/bridge.mjs` only where local source is absent

- [ ] **Step 6: Implement `sdk-tools`**

Actions:
- Generate or derive tool schema type exports from the retained tool input/output schema source
- Keep the generated type-only surface aligned with the reference package

- [ ] **Step 7: Build and rerun the secondary entrypoint tests**

Run: `pnpm --dir packages/sdk build && node --test packages/sdk/tests/browser-entrypoint.test.mjs packages/sdk/tests/bridge-entrypoint.test.mjs packages/sdk/tests/embed-entrypoint.test.mjs packages/sdk/tests/sdk-tools-entrypoint.test.mjs`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/sdk/src/entrypoints packages/sdk/src/browser packages/sdk/src/bridge packages/sdk/src/sdk-tools packages/sdk/tests/browser-entrypoint.test.mjs packages/sdk/tests/bridge-entrypoint.test.mjs packages/sdk/tests/embed-entrypoint.test.mjs packages/sdk/tests/sdk-tools-entrypoint.test.mjs
git commit -m "feat: implement secondary claude agent sdk entrypoints"
```

## Chunk 4: Extra-Code Removal And End-to-End Verification

### Task 6: Remove non-reference SDK surface and dead internal modules

**Files:**
- Modify: `packages/sdk/README.md`
- Modify: `packages/sdk/examples/COMPARISON.md`
- Modify: `packages/sdk/examples/08-official-api-compat.ts`
- Delete: any `packages/sdk/src/**` modules proven unreachable from the target public entrypoints
- Modify: `packages/sdk/src/tools.ts`
- Modify: `packages/sdk/src/tasks.ts`
- Modify: `packages/sdk/src/commands.ts`

- [ ] **Step 1: Write the failing dead-surface test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'

test('main sdk entrypoint does not expose open-agent-only exports', async () => {
  const sdk = await import('../dist/sdk.js')
  assert.equal('Agent' in sdk, false)
  assert.equal('createAgent' in sdk, false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/sdk/tests/sdk-public-api.test.mjs`
Expected: FAIL while legacy exports such as `Agent` and `createAgent` are still present.

- [ ] **Step 3: Remove local-only public surface**

Actions:
- Delete main-entry exports that are not in the reference package
- Remove compatibility files like stub `commands.ts` if no retained entrypoint requires them
- Delete internal modules that become unreachable after export cleanup

- [ ] **Step 4: Update docs and examples**

Actions:
- Rewrite `packages/sdk/README.md` to describe the package as a Claude Agent SDK aligned distribution
- Update examples so they demonstrate only retained public API
- Remove or rewrite comparison notes that refer to historical open-agent divergence as a feature

- [ ] **Step 5: Build and run the complete verification set**

Run: `pnpm --dir packages/sdk build`
Expected: PASS

Run: `node --test packages/sdk/tests/*.test.mjs`
Expected: PASS

Run: `pnpm --dir packages/sdk lint`
Expected: PASS

- [ ] **Step 6: Manually compare dist outputs against reference package**

Check:
- `dist/sdk.d.ts` vs `.ref-sdk/package/sdk.d.ts`
- `dist/browser.d.ts` vs `.ref-sdk/package/browser-sdk.d.ts`
- `dist/bridge.d.ts` vs `.ref-sdk/package/bridge.d.ts`
- `dist/embed.d.ts` vs `.ref-sdk/package/embed.d.ts`
- `dist/sdk-tools.d.ts` vs `.ref-sdk/package/sdk-tools.d.ts`

Record any intentional deviations in `packages/sdk/docs/current-package-gap.md`. The file should end empty or with only explicitly accepted residual differences.

- [ ] **Step 7: Commit**

```bash
git add packages/sdk/README.md packages/sdk/examples packages/sdk/src packages/sdk/tests packages/sdk/docs/current-package-gap.md
git commit -m "refactor: remove extra sdk surface and finalize claude sdk alignment"
```
