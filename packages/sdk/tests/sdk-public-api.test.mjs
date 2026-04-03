import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sdkRoot = path.resolve(__dirname, "..");
const builtSdkEntrypoint = path.join(sdkRoot, "dist", "sdk.js");

test("built sdk entrypoint exposes the reference runtime surface", async () => {
  const sdkModule = await import(pathToFileURL(builtSdkEntrypoint).href);
  const exportNames = Object.keys(sdkModule).sort();

  assert.deepEqual(exportNames, [
    "AbortError",
    "EXIT_REASONS",
    "HOOK_EVENTS",
    "createSdkMcpServer",
    "forkSession",
    "getSessionInfo",
    "getSessionMessages",
    "getSubagentMessages",
    "listSessions",
    "listSubagents",
    "query",
    "renameSession",
    "tagSession",
    "tool",
    "unstable_v2_createSession",
    "unstable_v2_prompt",
    "unstable_v2_resumeSession",
  ]);
});
