# Claude Agent SDK Alignment Design

**Date:** 2026-04-02

## Context

The goal is to align [`packages/sdk`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/packages/sdk) with the reference Claude Agent SDK package in [`.ref-sdk/package`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/.ref-sdk/package).

This is not a loose compatibility effort. The SDK package should converge on the reference package's exported entrypoints, capability surface, and public API shape. Existing functionality in `packages/sdk` that does not belong to the reference Claude Agent SDK should be treated as removable unless it is strictly required as an internal compatibility layer for build/runtime wiring.

The source of truth for alignment is:

- Reference package exports and metadata: [`.ref-sdk/package/package.json`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/.ref-sdk/package/package.json)
- Public type surfaces: [`.ref-sdk/package/sdk.d.ts`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/.ref-sdk/package/sdk.d.ts), [`.ref-sdk/package/browser-sdk.d.ts`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/.ref-sdk/package/browser-sdk.d.ts), [`.ref-sdk/package/bridge.d.ts`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/.ref-sdk/package/bridge.d.ts), [`.ref-sdk/package/embed.d.ts`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/.ref-sdk/package/embed.d.ts), and [`.ref-sdk/package/sdk-tools.d.ts`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/.ref-sdk/package/sdk-tools.d.ts)
- Public runtime behavior when needed: [`.ref-sdk/package/sdk.mjs`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/.ref-sdk/package/sdk.mjs), [`.ref-sdk/package/browser-sdk.js`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/.ref-sdk/package/browser-sdk.js), [`.ref-sdk/package/bridge.mjs`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/.ref-sdk/package/bridge.mjs), [`.ref-sdk/package/embed.js`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/.ref-sdk/package/embed.js)
- Local source implementation where available: [`src`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/src)

If a required behavior is absent from local source, it should be reconstructed as narrowly as possible from the reference package output and type declarations.

## Goals

- Make `packages/sdk` match the Claude Agent SDK package entrypoint layout.
- Make the public type surface and exported symbols match the reference package as closely as practical.
- Reuse local `src` implementations where they are clearly the same capability.
- Remove implementation that is outside the reference SDK capability surface.
- Leave `packages/sdk` as a clean standalone package rather than a broad copy of monorepo internals.

## Non-Goals

- Preserve historical `packages/sdk` extensions just because they already exist.
- Keep internal modules for convenience if they are not needed by the target entrypoints.
- Refactor unrelated monorepo code outside what is needed to support the SDK package.

## Target External Contract

`packages/sdk` should align its package shape to the reference package and expose at least these public entrypoints:

- `.`
- `./embed`
- `./browser`
- `./bridge`
- `./sdk-tools`

The package may retain its local package name, but its external layout and capability surface should match the reference Claude Agent SDK package. Public API decisions should be justified against the reference package rather than current local package structure.

## Internal Design

`packages/sdk` should be organized around public entrypoints instead of around copied monorepo folders.

### Public-entrypoint-first structure

- The main SDK entrypoint should expose only the core agent SDK surface.
- `embed`, `browser`, `bridge`, and `sdk-tools` should each have dedicated entrypoint files with minimal assembly logic.
- Shared internal code should exist only where multiple target entrypoints need it.
- Internal modules that cannot be reached from the target public entrypoints should be considered dead weight and removed.

### Source selection strategy

Each required implementation should be sourced in this order:

1. Existing local source under [`src`](/Users/cavinhuang/workspace/projects/ai-projects/open-agent-sdk/src) when behavior is clearly corresponding.
2. Existing `packages/sdk` implementation if it already matches the target contract and does not pull in unnecessary surface area.
3. Targeted reconstruction from reference `d.ts` and built runtime artifacts when local source is missing.

### Cleanup strategy

Code should be deleted when any of the following is true:

- It is not required by a reference public entrypoint.
- It provides capability not present in the reference Claude Agent SDK package.
- It exists only because of historical extraction from monorepo source.
- A much smaller adapter can replace it without changing the target contract.

Compatibility shims are allowed only when they are:

- Small
- Localized
- Clearly serving the target public contract

## Execution Plan

Implementation should proceed in four phases.

### Phase 1: Contract inventory

- Enumerate the reference package exports and files from `package.json`.
- Extract public symbols and key types from all reference declaration files.
- Record runtime-only behaviors that are not fully inferable from types.

### Phase 2: Current-state mapping

- Map current `packages/sdk` public exports to the reference contract.
- Classify modules into:
  - aligned
  - reusable with adjustment
  - missing
  - extra
- Identify which current modules incorrectly pull in CLI, UI, or monorepo-only concerns.

### Phase 3: Rebuild entrypoints and dependency graph

- Update `packages/sdk/package.json` exports to match the reference package layout.
- Create or rewrite entrypoints for `sdk`, `embed`, `browser`, `bridge`, and `sdk-tools`.
- Rewire internal imports so public entrypoints depend only on retained internal modules.
- Remove extra modules once their dependency edges are gone.

### Phase 4: Verification

- Build the package and verify all target entrypoints emit correctly.
- Verify public declarations match the reference package closely enough for intended consumers.
- Add focused smoke coverage for critical runtime entrypoints and APIs.
- Compare runtime behavior against the reference package where behavior is ambiguous from types alone.

## Testing Strategy

Testing should validate the reference contract rather than current package behavior.

- Export tests: ensure all expected entrypoints resolve.
- Type-shape checks: ensure public symbols and declaration output exist where expected.
- Smoke tests: instantiate core SDK flows and nontrivial secondary entrypoints.
- Regression checks: verify removal of extra code does not break retained public entrypoints.

When a behavior is reconstructed from built artifacts instead of source, add a narrow test to lock the inferred contract down.

## Risks

- The reference package is distributed mostly as compiled artifacts, so some behavior will need careful inference.
- Current `packages/sdk` likely includes many modules with accidental dependencies on monorepo-only code paths.
- Entry-point cleanup may expose hidden coupling that requires targeted extraction from local `src`.

## Success Criteria

The work is complete when:

- `packages/sdk` exports the same top-level entrypoints as the reference Claude Agent SDK package.
- The public type surface is intentionally aligned to the reference package.
- Required behaviors are implemented from local source or narrow reconstruction.
- Extra, non-reference SDK functionality has been removed.
- The remaining package structure is understandable and maintainable.
