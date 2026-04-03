import { readFileSync, existsSync, readdirSync } from 'fs'
import { dirname, resolve } from 'path'

// Extract from official SDK
const officialContent = readFileSync('E:/projects/ai-projects/open-agent-sdk/.ref-sdk/package/sdk.d.ts', 'utf-8')
const officialExports = new Set()
for (const line of officialContent.split('\n')) {
  let m = line.match(/^export declare (?:type|interface|class|function|const)\s+(\w+)/)
  if (m) officialExports.add(m[1])
}

// Extract from our SDK (resolve export * chains properly)
const ourExports = new Set()
const visited = new Set()

function extractExports(file) {
  // Normalize path
  file = file.replace(/\\/g, '/')
  if (visited.has(file) || !existsSync(file)) {
    return
  }
  visited.add(file)
  const content = readFileSync(file, 'utf-8')
  for (const line of content.split('\n')) {
    let m
    // export declare type/interface/class/function/const
    m = line.match(/^export declare (?:type|interface|class|function|const)\s+(\w+)/)
    if (m) { ourExports.add(m[1]); continue }
    // export type TypeName = ...
    m = line.match(/^export type (\w+)\s*[=<{]/)
    if (m) { ourExports.add(m[1]); continue }
    // export interface Name
    m = line.match(/^export interface (\w+)/)
    if (m) { ourExports.add(m[1]); continue }
    // export type { A, B } from '...'
    m = line.match(/^export type \{([^}]+)\}/)
    if (m) {
      m[1].split(',').forEach(s => {
        const n = s.trim()
        if (n && !n.includes(' ')) ourExports.add(n)
      })
      continue
    }
    // export { A, B } from '...'
    m = line.match(/^export \{([^}]+)\}/)
    if (m) {
      m[1].split(',').forEach(s => {
        const n = s.trim().split(/\s+as\s+/)[0].trim()
        if (n && !n.includes(' ')) ourExports.add(n)
      })
      continue
    }
    // export * from '...'
    m = line.match(/^export \* from ['"]([^'"]+)['"]/)
    if (m) {
      const ref = m[1]
      const dir = dirname(file)
      let resolved = resolve(dir, ref.replace(/\.js$/, '.d.ts'))
      extractExports(resolved)
    }
  }
}

const sdkDts = 'E:/projects/ai-projects/open-agent-sdk/packages/sdk/dist/sdk.d.ts'
extractExports(sdkDts)

// Compare
const missing = [...officialExports].filter(x => !ourExports.has(x)).sort()
const matched = [...officialExports].filter(x => ourExports.has(x)).sort()

console.log(`Official: ${officialExports.size} exports`)
console.log(`Ours: ${ourExports.size} exports`)
console.log(`Matched: ${matched.length}/${officialExports.size}`)
console.log(`\n=== MISSING from our SDK (${missing.length}) ===`)
missing.forEach(x => console.log(`  - ${x}`))
