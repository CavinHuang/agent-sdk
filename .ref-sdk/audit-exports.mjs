import { readFileSync, existsSync, readdirSync } from 'fs'

const base = 'E:/projects/ai-projects/open-agent-sdk/packages/sdk/dist/entrypoints/'
const sdkSubdir = base + 'sdk/'

const allExports = new Set()
const visited = new Set()

function extractExports(file) {
  if (visited.has(file) || !existsSync(file)) return
  visited.add(file)
  const content = readFileSync(file, 'utf-8')
  for (const line of content.split('\n')) {
    let m
    m = line.match(/^export declare (?:type|interface|class|function|const)\s+(\w+)/)
    if (m) { allExports.add(m[1]); continue }
    m = line.match(/^export type \{([^}]+)\}/)
    if (m) { m[1].split(',').forEach(s => { const n = s.trim(); if (n) allExports.add(n) }); continue }
    m = line.match(/^export \{([^}]+)\}/)
    if (m) { m[1].split(',').forEach(s => { const n = s.trim().split(/\s+as\s+/)[0].trim(); if (n) allExports.add(n) }); continue }
    // export * from relative
    m = line.match(/^export \* from ['"]([^'"]+)['"]/)
    if (m) {
      const ref = m[1]
      const dir = file.replace(/[/\\][^/\\]+$/, '/')
      const resolved = dir + ref.replace(/\.js$/, '.d.ts')
      extractExports(resolved)
    }
  }
}

extractExports(base + 'agentSdkTypes.d.ts')

// Also scan sdk/ subdir
if (existsSync(sdkSubdir)) {
  for (const f of readdirSync(sdkSubdir).filter(x => x.endsWith('.d.ts'))) {
    extractExports(sdkSubdir + f)
  }
}

const sorted = [...allExports].sort()
console.log(`Total from agentSdkTypes chain: ${sorted.length}`)
sorted.forEach(s => console.log(s))
