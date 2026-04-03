import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sdkRoot = path.resolve(__dirname, "..");
const fixtureRoot = path.join(sdkRoot, "reference");
const extractorPath = path.join(sdkRoot, "scripts", "extract-reference-contract.ts");

const expectedFiles = [
  "exports.json",
  "localized-exports.json",
  path.join("public-api", "sdk.json"),
  path.join("public-api", "browser.json"),
  path.join("public-api", "bridge.json"),
  path.join("public-api", "embed.json"),
  path.join("public-api", "sdk-tools.json"),
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("extractor output matches committed reference fixtures", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reference-contract-"));

  try {
    const run = spawnSync(process.execPath, [extractorPath], {
      cwd: sdkRoot,
      env: {
        ...process.env,
        REFERENCE_CONTRACT_OUTPUT_ROOT: tempRoot,
      },
      encoding: "utf8",
    });

    assert.equal(run.status, 0, run.stderr || run.stdout);

    for (const relativeFile of expectedFiles) {
      const expected = readJson(path.join(fixtureRoot, relativeFile));
      const actual = readJson(path.join(tempRoot, relativeFile));
      assert.deepEqual(actual, expected, relativeFile);
    }

    const browserFixture = readJson(
      path.join(tempRoot, "public-api", "browser.json"),
    );
    for (const symbol of ["CanUseTool", "Query", "createSdkMcpServer", "tool"]) {
      assert.ok(
        browserFixture.symbols.includes(symbol),
        `browser.json missing ${symbol}`,
      );
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
