const fs = require("node:fs");
const path = require("node:path");

const sdkRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(sdkRoot, "..", "..");
const referencePkgRoot = path.join(repoRoot, ".ref-sdk", "package");
const referenceOutputRoot = process.env.REFERENCE_CONTRACT_OUTPUT_ROOT
  ? path.resolve(process.env.REFERENCE_CONTRACT_OUTPUT_ROOT)
  : path.join(sdkRoot, "reference");
const publicApiOutputRoot = path.join(referenceOutputRoot, "public-api");

const declarationTargets = [
  { source: "sdk.d.ts", fixture: "sdk.json" },
  { source: "browser-sdk.d.ts", fixture: "browser.json" },
  { source: "bridge.d.ts", fixture: "bridge.json" },
  { source: "embed.d.ts", fixture: "embed.json" },
  { source: "sdk-tools.d.ts", fixture: "sdk-tools.json" },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function localizeReferenceExports(referenceExports) {
  return Object.fromEntries(
    Object.entries(referenceExports).map(([key, target]) => {
      if (
        !target ||
        typeof target !== "object" ||
        Array.isArray(target)
      ) {
        return [key, target];
      }

      switch (key) {
        case ".": {
          return [key, { types: "./dist/sdk.d.ts", default: "./dist/sdk.js" }];
        }
        case "./embed": {
          return [key, { types: "./dist/embed.d.ts", default: "./dist/embed.js" }];
        }
        case "./browser": {
          return [key, { types: "./dist/browser.d.ts", default: "./dist/browser.js" }];
        }
        case "./bridge": {
          return [key, { types: "./dist/bridge.d.ts", default: "./dist/bridge.js" }];
        }
        case "./sdk-tools":
        case "./sdk-tools.js": {
          return [key, { types: "./dist/sdk-tools.d.ts", default: "./dist/sdk-tools.js" }];
        }
        default: {
          return [key, target];
        }
      }
    }),
  );
}

function collectDeclarationNames(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const names = new Set();
  const lines = source.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("/*")
    ) {
      continue;
    }

    const match = trimmed.match(
      /^(?:export\s+)?(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:const|let|var|type|interface|class|function|enum|namespace)\s+([A-Za-z_$][\w$]*)/,
    );
    if (match) {
      names.add(match[1]);
      continue;
    }

    const defaultClassOrFunction = trimmed.match(
      /^export\s+default\s+(?:class|function)\s+([A-Za-z_$][\w$]*)/,
    );
    if (defaultClassOrFunction) {
      names.add(defaultClassOrFunction[1]);
    }
  }

  const reExportPattern =
    /export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["'][^"']+["'];?/g;
  for (const match of source.matchAll(reExportPattern)) {
    const specifierBlock = match[1];
    const specifiers = specifierBlock.split(",");
    for (const rawSpecifier of specifiers) {
      const trimmed = rawSpecifier.trim();
      if (!trimmed) {
        continue;
      }

      const withoutTypeModifier = trimmed.replace(/^type\s+/, "");
      const aliasParts = withoutTypeModifier.split(/\s+as\s+/);
      const exportedName = (aliasParts[1] ?? aliasParts[0]).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(exportedName)) {
        names.add(exportedName);
      }
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

function main() {
  fs.mkdirSync(publicApiOutputRoot, { recursive: true });

  const referencePackageJson = readJson(path.join(referencePkgRoot, "package.json"));
  writeJson(path.join(referenceOutputRoot, "exports.json"), referencePackageJson.exports);
  writeJson(
    path.join(referenceOutputRoot, "localized-exports.json"),
    localizeReferenceExports(referencePackageJson.exports),
  );

  for (const target of declarationTargets) {
    const symbols = collectDeclarationNames(
      path.join(referencePkgRoot, target.source),
    );
    writeJson(path.join(publicApiOutputRoot, target.fixture), { symbols });
  }
}

main();
