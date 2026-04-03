# @anthropic-ai/claude-agent-sdk (Standalone Build)

Source-level standalone SDK extracted from the open-agent-sdk monorepo.

## Build

```bash
cd packages/sdk
npm install
npm run build    # tsc → dist/
```

## Structure

```
packages/sdk/
├── src/          # SDK core source (copied from src/, CLI code stripped)
├── dist/         # Compiled output
├── examples/     # Usage examples
├── package.json
├── tsconfig.json
└── README.md
```

## What's included

- Core engine: `sdk.ts`, `agent.ts`, `QueryEngine.ts`, `query.ts`
- All tool implementations (BashTool, FileReadTool, etc.)
- Services: API client, MCP protocol, context compaction, tool orchestration
- Full type definitions

## What's excluded (CLI-only)

- Terminal UI (`ink`, `screens/`, `components/`)
- CLI commands (`commands/` directory — 92 slash-commands)
- IDE integrations (`vim/`, `voice/`, `keybindings/`)
- Daemon/remote/SSH (`daemon/`, `remote/`, `ssh/`, `server/`)
- Plugins/skills system (`skills/`, `plugins/`)
- Analytics sinks (replaced with no-op stubs)

## Notes

- `commands.ts` is a stub that returns empty command lists
- `tools.ts` excludes ant-only and CLI-specific tools
- CLI-only modules referenced by SDK code are replaced with empty stubs
- The original `src/` directory is **untouched**
