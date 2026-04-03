import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sdkRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(sdkRoot, "package.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const pkg = readJson(packageJsonPath);
const runtimeExports = Object.entries(pkg.exports).filter(([, target]) => {
  return typeof target === "object" && target !== null && "default" in target;
});

for (const [exportKey, target] of runtimeExports) {
  test(`package export ${exportKey} points at a built runtime file that imports cleanly`, async () => {
    const relativePath = target.default;
    assert.equal(typeof relativePath, "string");
    assert.match(relativePath, /^\.\/dist\//, `${exportKey} must point into ./dist`);

    const absolutePath = path.join(sdkRoot, relativePath);
    assert.ok(
      fs.existsSync(absolutePath),
      `Expected exported runtime entrypoint at ${absolutePath}`,
    );

    const moduleNamespace = await import(pathToFileURL(absolutePath).href);
    assert.ok(moduleNamespace);
  });
}

test("sdk-tools exports include a runtime target when sdk-tools.js is built", () => {
  const sdkToolsExport = pkg.exports["./sdk-tools"];
  const sdkToolsJsExport = pkg.exports["./sdk-tools.js"];

  assert.equal(sdkToolsExport.default, "./dist/sdk-tools.js");
  assert.equal(sdkToolsJsExport.default, "./dist/sdk-tools.js");
});

test("embed runtime exposes matching default and named cliPath exports", async () => {
  const embedExport = pkg.exports["./embed"];
  const absolutePath = path.join(sdkRoot, embedExport.default);
  const moduleNamespace = await import(pathToFileURL(absolutePath).href);

  assert.equal(typeof moduleNamespace.default, "string");
  assert.equal(moduleNamespace.cliPath, moduleNamespace.default);
});
