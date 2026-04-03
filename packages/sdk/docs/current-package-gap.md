# Current package export gap (Task 2)

## Current `package.json` export map

Snapshot note: this snippet reflects the Task 2 baseline and is intentionally not updated until Task 3 reconciles exports.

```json
{
  ".": {
    "types": "./dist/sdk.d.ts",
    "import": "./dist/sdk.js"
  },
  "./types": {
    "types": "./dist/entrypoints/agentSdkTypes.d.ts",
    "import": "./dist/entrypoints/agentSdkTypes.js"
  }
}
```

The current map includes `./types`, which is an extra local-only export that does not exist in the reference map.

## Reference export map (`reference/exports.json`)

```json
{
  ".": {
    "types": "./sdk.d.ts",
    "default": "./sdk.mjs"
  },
  "./embed": {
    "types": "./embed.d.ts",
    "default": "./embed.js"
  },
  "./browser": {
    "types": "./browser-sdk.d.ts",
    "default": "./browser-sdk.js"
  },
  "./bridge": {
    "types": "./bridge.d.ts",
    "default": "./bridge.mjs"
  },
  "./sdk-tools": {
    "types": "./sdk-tools.d.ts"
  },
  "./sdk-tools.js": {
    "types": "./sdk-tools.d.ts"
  }
}
```

## Known missing entrypoints

- `./browser`
- `./bridge`
- `./embed`
- `./sdk-tools`
- `./sdk-tools.js`

## Condition-key mismatch

- Current map uses `import` conditions for its entries.
- Reference map uses `default` conditions for the public entrypoints.

## Known extra local-only export

- `./types`
