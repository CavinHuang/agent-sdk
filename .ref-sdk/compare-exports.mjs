import { readFileSync, existsSync, readdirSync } from 'fs'

// Extract from official SDK
const officialContent = readFileSync('E:/projects/ai-projects/open-agent-sdk/.ref-sdk/package/sdk.d.ts', 'utf-8')
const officialExports = new Set()
for (const line of officialContent.split('\n')) {
  let m = line.match(/^export declare (?:type|interface|class|function|const)\s+(\w+)/)
  if (m) officialExports.add(m[1])
}

// Extract from our SDK (resolve export * chains)
const base = 'E:/projects/ai-projects/open-agent-sdk/packages/sdk/dist/entrypoints/'
const ourExports = new Set()
const visited = new Set()

function extractExports(file) {
  if (visited.has(file) || !existsSync(file)) return
  visited.add(file)
  const content = readFileSync(file, 'utf-8')
  for (const line of content.split('\n')) {
    let m
    m = line.match(/^export declare (?:type|interface|class|function|const)\s+(\w+)/)
    if (m) { ourExports.add(m[1]); continue }
    m = line.match(/^export type \{([^}]+)\}/)
    if (m) { m[1].split(',').forEach(s => { const n = s.trim(); if (n) ourExports.add(n) }); continue }
    m = line.match(/^export \{([^}]+)\}/)
    if (m) { m[1].split(',').forEach(s => { const n = s.trim().split(/\s+as\s+/)[0].trim(); if (n) ourExports.add(n) }); continue }
    m = line.match(/^export \* from ['"]([^'"]+)['"]/)
    if (m) {
      const dir = file.replace(/[/\\][^/\\]+$/, '/')
      extractExports(dir + m[1].replace(/\.js$/, '.d.ts'))
    }
  }
}

extractExports(base + 'agentSdkTypes.d.ts')

// Also include sdk.ts top-level exports
const sdkDts = 'E:/projects/ai-projects/open-agent-sdk/packages/sdk/dist/sdk.d.ts'
extractExports(sdkDts)

// Also scan sdk/ subdir
const sdkSubdir = base + 'sdk/'
if (existsSync(sdkSubdir)) {
  for (const f of readdirSync(sdkSubdir).filter(x => x.endsWith('.d.ts'))) {
    extractExports(sdkSubdir + f)
  }
}

// Compare
const missing = [...officialExports].filter(x => !ourExports.has(x)).sort()
const extra = [...ourExports].filter(x => !officialExports.has(x)).sort()

console.log(`Official: ${officialExports.size} exports`)
console.log(`Ours: ${ourExports.size} exports`)
console.log(`\n=== MISSING from our SDK (${missing.length}) ===`)
missing.forEach(x => console.log(`  - ${x}`))
console.log(`\n=== EXTRA in our SDK (${extra.length}) ===`)
extra.forEach(x => console.log(`  + ${x}`))
