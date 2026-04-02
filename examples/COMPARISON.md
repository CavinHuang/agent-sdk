# Open Agent SDK vs Claude Agent SDK (官方) 完整能力对比

> 对比日期：2026-04-01 (最终更新)
> 官方 SDK 版本：`@anthropic-ai/claude-agent-sdk@0.2.89` (claudeCodeVersion: 2.1.89)
> Open Agent SDK 版本：`@shipany/open-agent-sdk@0.1.7`
> 官方文档：https://platform.claude.com/docs/en/agent-sdk/overview

---

## 架构差异

| 维度 | Claude Agent SDK (官方) | Open Agent SDK |
|------|------------------------|----------------|
| **运行模式** | 子进程模式 — spawn `cli.js` 子进程，通过 stdin/stdout JSON 协议通信 | **进程内运行** — 直接调用 QueryEngine，无需子进程 |
| **部署依赖** | 需要本地 Node/Bun 运行时 + 13MB cli.js | 无 CLI 依赖，可打包进任意 Node 应用 |
| **延迟** | 进程启动 + IPC 开销 | 零 IPC 开销 |
| **控制粒度** | 通过 control protocol 远程控制子进程 | 直接操作 QueryEngine 实例 |
| **语言** | Python + TypeScript | 仅 TypeScript |
| **包名** | `@anthropic-ai/claude-agent-sdk` | `@shipany/open-agent-sdk` |

---

## 一、类型系统对齐

### 1.0 公开类型覆盖率

导出审计结果：官方 **181 个** 公开导出全部覆盖，Open Agent SDK 额外提供 **24 个** 扩展导出。

- ✅ 全部 181 个官方导出：**0 缺失**
- ✅ `CanUseTool` / `HookCallback` / `HookCallbackMatcher` — 与官方签名一致
- ✅ `Options` / `Query` / `InternalOptions` / `InternalQuery` — 结构对齐
- ✅ 全部 26 种 `*HookInput` / `*HookSpecificOutput` 类型
- ✅ 全部 25 种 `SDK*Message` 消息类型（精确字段定义，非 `any`）
- ✅ `SDKControlInitializeResponse` / `SDKControlReloadPluginsResponse` — 精确定义
- ✅ `SandboxSettings` / `SandboxFilesystemConfig` / `SandboxNetworkConfig` / `SandboxIgnoreViolations`
- ✅ `AgentDefinition` / `AgentInfo` / `AccountInfo` — 精确字段
- ✅ `ThinkingConfig` / `ThinkingAdaptive` / `ThinkingEnabled` / `ThinkingDisabled`
- ✅ `PermissionResult` / `PermissionUpdate` / `PermissionMode` — 完整联合类型
- ✅ `McpServerConfig` / `McpSdkServerConfigWithInstance` / 全部 MCP 配置变体
- ✅ `Transport` / `SpawnedProcess` / `SpawnOptions` — interface 精确定义
- ✅ `ToolConfig` / `SdkPluginConfig` / `SlashCommand` / `SettingSource`
- ✅ 常量 `HOOK_EVENTS` / `EXIT_REASONS`

**切换方式**: 用户只需改 import 路径即可：
```typescript
// 官方 SDK
import { query, tool, HookCallback } from '@anthropic-ai/claude-agent-sdk'
// Open Agent SDK (类型签名完全一致)
import { query, tool, HookCallback } from '@shipany/open-agent-sdk'
```

---

## 二、核心 API

### 2.1 query() 函数

| 能力 | 官方 SDK | Open Agent SDK | 状态 |
|------|---------|----------------|------|
| `query({ prompt, options })` 基本调用 | ✅ | ✅ | ✅ 兼容 |
| `prompt` 为 `string` | ✅ | ✅ | ✅ |
| `prompt` 为 `AsyncIterable<SDKUserMessage>` 流式输入 | ✅ | ✅ | ✅ 包装 generator 实现 |
| 返回值为 `Query` (带方法的 AsyncGenerator) | ✅ | ✅ | ✅ |
| `Query.abort()` 中止执行 | ✅ | ✅ | ✅ |
| `Query.interrupt()` 中断执行 | ✅ | ✅ | ✅ |
| `Query.close()` 关闭查询 | ✅ | ✅ | ✅ |
| `Query.setModel()` 运行时切换模型 | ✅ | ✅ | ✅ 通过 Agent.setModel() |
| `Query.setPermissionMode()` 运行时切换权限 | ✅ | ✅ | ✅ 通过 Agent.setPermissionMode() |
| `Query.setMaxThinkingTokens()` | ✅ | ✅ | ✅ 通过 Agent.setMaxThinkingTokens() |
| `Query.applyFlagSettings()` 动态合并设置 | ✅ | ✅ | ✅ 通过 setFlagSettingsInline() |
| `Query.supportedCommands()` | ✅ | ✅ | ✅ |
| `Query.supportedAgents()` | ✅ | ✅ | ✅ |
| `Query.mcpServerStatus()` | ✅ | ✅ | ✅ |
| `Query.reconnectMcpServer()` | ✅ | ✅ | ✅ |
| `Query.toggleMcpServer()` | ✅ | ✅ | ✅ |
| `Query.setMcpServers()` 动态管理 MCP | ✅ | ✅ | ✅ |
| `Query.rewindFiles()` 文件回退 | ✅ | ✅ | ✅ 通过 fileHistory API |
| `Query.streamInput()` 流式用户消息 | ✅ | ✅ | ✅ 异步排队实现 |

### 2.2 Agent / Session API

| 能力 | 官方 SDK | Open Agent SDK | 状态 |
|------|---------|----------------|------|
| `createAgent()` 工厂函数 | ❌ | ✅ | ✅ 独有优势 |
| `Agent` class 有状态管理 | ❌ | ✅ | ✅ 独有优势 |
| `agent.prompt()` 阻塞式查询 | ❌ | ✅ | ✅ 独有优势 |
| `agent.getMessages()` 获取历史 | ❌ | ✅ | ✅ 独有优势 |
| `unstable_v2_createSession()` | ✅ (alpha) | ✅ | ✅ Agent-backed 实现 |
| `unstable_v2_prompt()` | ✅ (alpha) | ✅ | ✅ 完整返回值 |
| `unstable_v2_resumeSession()` | ✅ (alpha) | ✅ | ✅ Agent-backed + resume 实现 |

### 2.3 Session 管理

| 能力 | 官方 SDK | Open Agent SDK | 状态 |
|------|---------|----------------|------|
| `listSessions()` | ✅ | ✅ | ✅ |
| `getSessionInfo()` | ✅ | ✅ | ✅ |
| `getSessionMessages()` | ✅ | ✅ | ✅ |
| `renameSession()` | ✅ | ✅ | ✅ |
| `tagSession()` | ✅ | ✅ | ✅ |
| `forkSession()` | ✅ | ✅ | ✅ 完整实现 (复制 JSONL + upToMessageId) |
| `getSubagentMessages()` | ✅ | ✅ | ✅ |
| `listSubagents()` | ✅ | ✅ | ✅ |

---

## 三、Options (query 选项)

### 3.1 基础 + 模型

| 选项 | 官方 SDK | Open Agent SDK | 状态 |
|------|---------|----------------|------|
| `model` / `cwd` / `env` | ✅ | ✅ | ✅ |
| `abortController` / `abortSignal` | ✅ | ✅ | ✅ |
| `debug` / `debugFile` | ✅ | ✅ wired (env var) | ✅ |
| `thinking` (adaptive/enabled/disabled) | ✅ | ✅ | ✅ |
| `effort` | ✅ | ✅ wired → appState.effortValue | ✅ |
| `maxTurns` / `maxBudgetUsd` | ✅ | ✅ | ✅ |
| `taskBudget` / `fallbackModel` | ✅ | ✅ | ✅ |
| `betas` | ✅ | ✅ wired → setSdkBetas() | ✅ |

### 3.2 System Prompt + 工具

| 选项 | 官方 SDK | Open Agent SDK | 状态 |
|------|---------|----------------|------|
| `systemPrompt` (string / preset) | ✅ | ✅ | ✅ |
| `appendSystemPrompt` | ✅ | ✅ | ✅ |
| `tools` (string[] / preset / Tool[]) | ✅ | ✅ | ✅ |
| `allowedTools` / `disallowedTools` | ✅ | ✅ | ✅ |
| `toolConfig` | ✅ | ✅ wired → setQuestionPreviewFormat() | ✅ |
| `outputFormat` / `jsonSchema` | ✅ | ✅ | ✅ |

### 3.3 权限

| 选项 | 官方 SDK | Open Agent SDK | 状态 |
|------|---------|----------------|------|
| `permissionMode` (all 5 modes) | ✅ | ✅ | ✅ |
| `allowDangerouslySkipPermissions` | ✅ | ✅ | ✅ |
| `canUseTool` callback (精确签名) | ✅ | ✅ | ✅ |

### 3.4 子 Agent / MCP

| 选项 | 官方 SDK | Open Agent SDK | 状态 |
|------|---------|----------------|------|
| `agent` / `agents` (完整 AgentDefinition) | ✅ | ✅ | ✅ |
| `mcpServers` (stdio/SSE/HTTP/sdk) | ✅ | ✅ | ✅ |
| `onElicitation` | ✅ | ✅ | ✅ |

### 3.5 Session / 持久化

| 选项 | 官方 SDK | Open Agent SDK | 状态 |
|------|---------|----------------|------|
| `resume` | ✅ | ✅ wired → loadTranscript + switchSession | ✅ |
| `continue` | ✅ | ✅ wired → 最近 session 续接 | ✅ |
| `sessionId` | ✅ | ✅ wired → switchSession() | ✅ |
| `persistSession` | ✅ | ✅ wired → setSessionPersistenceDisabled() | ✅ |
| `settingSources` | ✅ | ✅ wired → setAllowedSettingSources() | ✅ |
| `additionalDirectories` | ✅ | ✅ wired → setAdditionalDirectoriesForClaudeMd() | ✅ |
| `includeHookEvents` | ✅ | ✅ wired → setAllHookEventsEnabled() | ✅ |
| `settings` | ✅ | ✅ wired → setFlagSettingsPath/Inline() | ✅ |
| `promptSuggestions` | ✅ | ✅ wired → appState.promptSuggestionEnabled | ✅ |
| `agentProgressSummaries` | ✅ | ✅ wired → setSdkAgentProgressSummariesEnabled() | ✅ |
| `enableFileCheckpointing` | ✅ | ✅ wired → env CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING | ✅ |
| `plugins` | ✅ | ✅ wired → setInlinePlugins() + clearPluginCache() | ✅ |
| `sandbox` | ✅ | ✅ wired → SandboxManager.initialize() | ✅ |

### 3.6 官方 SDK 专属 (N/A for in-process)

| 选项 | 说明 |
|------|------|
| `executable` | 子进程运行时选择 (node/bun/deno) — 进程内不适用 |
| `executableArgs` | 子进程参数 — 进程内不适用 |
| `extraArgs` | CLI 参数透传 — 进程内不适用 |
| `pathToClaudeCodeExecutable` | CLI 路径 — 进程内不适用 |
| `spawnClaudeCodeProcess` | 自定义进程生成 — 进程内不适用 |

---

## 四、自定义工具

| 能力 | 官方 SDK | Open Agent SDK | 状态 |
|------|---------|----------------|------|
| `tool()` 辅助函数 | ✅ | ✅ | ✅ |
| `createSdkMcpServer()` 进程内 MCP | ✅ | ✅ | ✅ |
| `sdkMcpToolsToNativeTools()` | ❌ | ✅ | ✅ 独有 |
| 原生 Tool 对象 (无 MCP) | ❌ | ✅ | ✅ 独有 |

---

## 五、Hooks 生命周期

26 种 hook 事件全部支持，类型定义与官方完全一致：
`PreToolUse` · `PostToolUse` · `PostToolUseFailure` · `Stop` · `StopFailure` · `SessionStart` · `SessionEnd` · `UserPromptSubmit` · `SubagentStart` · `SubagentStop` · `PreCompact` · `PostCompact` · `PermissionRequest` · `PermissionDenied` · `Notification` · `Setup` · `TeammateIdle` · `TaskCreated` · `TaskCompleted` · `Elicitation` · `ElicitationResult` · `ConfigChange` · `WorktreeCreate` · `WorktreeRemove` · `InstructionsLoaded` · `CwdChanged` · `FileChanged`

| 形式 | 官方 SDK | Open Agent SDK | 状态 |
|------|---------|----------------|------|
| JS `HookCallback` 函数 | ✅ | ✅ | ✅ |
| `HookCallbackMatcher` (matcher/hooks/timeout) | ✅ | ✅ | ✅ |
| Shell/LLM/Agent/HTTP hooks (via Settings) | ✅ | ✅ (引擎支持) | ✅ settingSources 已 wire |

---

## 六、内置工具

全部 14 种内置工具覆盖：Read · Write · Edit · Bash · Glob · Grep · WebSearch · WebFetch · AskUserQuestion · Agent · NotebookEdit · TodoWrite · Skill · Task

---

## 七、流式消息事件

全部 25 种 `SDKMessage` 联合变体类型已精确定义（非 `any`）：

`SDKAssistantMessage` · `SDKUserMessage` · `SDKUserMessageReplay` · `SDKResultSuccess` · `SDKResultError` · `SDKSystemMessage` · `SDKPartialAssistantMessage` · `SDKCompactBoundaryMessage` · `SDKStatusMessage` · `SDKAPIRetryMessage` · `SDKLocalCommandOutputMessage` · `SDKHookStartedMessage` · `SDKHookProgressMessage` · `SDKHookResponseMessage` · `SDKToolProgressMessage` · `SDKAuthStatusMessage` · `SDKTaskNotificationMessage` · `SDKTaskStartedMessage` · `SDKTaskProgressMessage` · `SDKSessionStateChangedMessage` · `SDKFilesPersistedEvent` · `SDKToolUseSummaryMessage` · `SDKRateLimitEvent` · `SDKElicitationCompleteMessage` · `SDKPromptSuggestionMessage`

---

## 八、综合评分

| 维度 | 官方 SDK | Open Agent SDK | 差距 |
|------|---------|----------------|------|
| **类型导出覆盖** | 181 个 | **181/181** (+ 24 扩展) | ✅ 0 缺失 |
| **核心查询能力** | 100% | 100% | ✅ 完全对齐 |
| **函数 API 覆盖** | 14 函数 | **14/14** | ✅ 完全对齐 |
| **内置工具** | 100% | 100% | ✅ 对齐 |
| **MCP 集成** | 100% | 100% | ✅ 对齐 |
| **权限系统** | 100% | 100% (CanUseTool 签名一致) | ✅ 对齐 |
| **Hooks** | 100% | 100% (26 事件全部 wired) | ✅ 对齐 |
| **子 Agent** | 100% | 100% | ✅ 对齐 |
| **Session 管理** | 8 函数 | **8/8** | ✅ 完全对齐 |
| **Query 运行时控制** | 100% | 100% | ✅ 完全对齐 |
| **Options wire-through** | ~30 个 | **全部 wired** (除 5 个 N/A 子进程专属) | ✅ 完全对齐 |
| **V2 Session API** | 3 函数 | **3/3** | ✅ 完全对齐 |
| **流式事件** | 100% | 100% (精确类型) | ✅ 对齐 |
| **独有优势** | 0 | +7 项 | ✅ |

---

## 九、独有优势 (Open Agent SDK)

1. **`createAgent()` + `Agent` class** — 有状态 agent，支持 `.prompt()` 阻塞调用、`.getMessages()` 历史查看
2. **进程内执行** — 零 IPC 延迟，无子进程管理
3. **原生 Tool 对象** — 直接传 TypeScript Tool 实例，无需 MCP 包装
4. **`sdkMcpToolsToNativeTools()`** — MCP tool 定义转原生 Tool
5. **`QueryEngine` 直接访问** — 完整控制查询生命周期
6. **第三方 API (`baseURL`)** — 支持自定义 API endpoint
7. **打包友好** — 可嵌入任意 Node.js 应用
