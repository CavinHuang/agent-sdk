import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sdkRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(sdkRoot, "package.json");
const localizedExportsPath = path.join(
  sdkRoot,
  "reference",
  "localized-exports.json",
);
const shouldRun = process.env.RUN_CURRENT_PACKAGE_SHAPE_TEST === "1";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test(
  "current package export map matches the localized export map fixture",
  { skip: !shouldRun },
  () => {
    const pkg = readJson(packageJsonPath);
    const localizedFixture = readJson(localizedExportsPath);

    assert.ok(pkg && typeof pkg === "object" && !Array.isArray(pkg), "package.json must parse to an object");
    assert.ok(
      pkg.exports && typeof pkg.exports === "object" && !Array.isArray(pkg.exports),
      "package.json exports must be an object map",
    );
    assert.ok(
      localizedFixture &&
        typeof localizedFixture === "object" &&
        !Array.isArray(localizedFixture),
      "reference/localized-exports.json must be an object map",
    );

    const currentExportKeys = Object.keys(pkg.exports).sort();
    const referenceExportKeys = Object.keys(localizedFixture).sort();
    const currentKeySet = new Set(currentExportKeys);
    const referenceKeySet = new Set(referenceExportKeys);
    const missingKeys = referenceExportKeys.filter((key) => !currentKeySet.has(key));
    const extraKeys = currentExportKeys.filter((key) => !referenceKeySet.has(key));

    assert.deepEqual(
      pkg.exports,
      localizedFixture,
      `Current export map differs from localized export map. Missing keys: ${
        missingKeys.join(", ") || "(none)"
      }. Extra keys: ${extraKeys.join(", ") || "(none)"}.`,
    );
  },
);

test(
  "current package export map check is opt-in",
  { skip: shouldRun },
  (t) => {
    t.diagnostic(
      "Skipping by default. Set RUN_CURRENT_PACKAGE_SHAPE_TEST=1 to run this intentional red test.",
    );
  },
);
