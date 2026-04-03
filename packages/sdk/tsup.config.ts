import { defineConfig } from 'tsup'
import type { Plugin } from 'esbuild'
import { resolve, dirname } from 'path'
import { existsSync, readFileSync } from 'fs'

/**
 * esbuild plugin: auto-stubs missing local modules.
 * Collects named imports from all importer sites, then
 * generates a stub module exporting those names as no-ops.
 */
function stubMissingLocals(): Plugin {
  return {
    name: 'stub-missing-locals',
    setup(build) {
      const NS = 'stub-missing'
      const exportMap = new Map<string, Set<string>>()

      function canResolve(dir: string, path: string): boolean {
        const base = resolve(dir, path).replace(/\\/g, '/')
        const baseNoJs = base.replace(/\.js$/, '')
        const candidates = [
          base, baseNoJs + '.ts', baseNoJs + '.tsx', baseNoJs + '.js',
          base + '.ts', base + '.tsx',
          baseNoJs + '/index.ts', baseNoJs + '/index.tsx', baseNoJs + '/index.js',
        ]
        return candidates.some(c => existsSync(c))
      }

      function extractNamedImports(importerPath: string, specifier: string): string[] {
        try {
          const src = readFileSync(importerPath, 'utf-8')
          const names: string[] = []
          const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          // import { a, b as c } from '...'
          const re = new RegExp(
            `import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${escaped}['"]`,
            'g',
          )
          let m
          while ((m = re.exec(src)) !== null) {
            m[1].split(',').forEach((part) => {
              const token = part.trim().split(/\s+as\s+/)[0].trim()
              if (token && !token.startsWith('type ')) names.push(token)
            })
          }
          // import X from '...'
          const reDefault = new RegExp(
            `import\\s+(\\w+)\\s+from\\s*['"]${escaped}['"]`,
          )
          const md = reDefault.exec(src)
          if (md) names.push('default')
          return names
        } catch {
          return []
        }
      }

      build.onResolve({ filter: /^\./ }, (args) => {
        const dir = args.resolveDir || dirname(args.importer)
        if (canResolve(dir, args.path)) return null

        // Collect exports needed from this stub
        const key = args.path
        if (!exportMap.has(key)) exportMap.set(key, new Set())
        const names = extractNamedImports(args.importer, args.path)
        const set = exportMap.get(key)!
        names.forEach((n) => set.add(n))

        return { path: key, namespace: NS }
      })

      build.onLoad({ filter: /.*/, namespace: NS }, (args) => {
        const names = exportMap.get(args.path) || new Set()
        const lines: string[] = []
        for (const name of names) {
          if (name === 'default') {
            lines.push('export default undefined;')
          } else {
            lines.push(`export const ${name} = undefined;`)
          }
        }
        if (lines.length === 0) lines.push('export default undefined;')
        return { contents: lines.join('\n'), loader: 'js' }
      })
    },
  }
}

export default defineConfig({
  entry: {
    sdk: 'src/sdk.ts',
    browser: 'src/browser.ts',
    bridge: 'src/bridge.ts',
    embed: 'src/embed.ts',
    'sdk-tools': 'src/sdk-tools.ts',
    'entrypoints/agentSdkTypes': 'src/entrypoints/agentSdkTypes.ts',
  },
  format: ['esm'],
  target: 'es2022',
  platform: 'node',
  splitting: true,
  sourcemap: true,
  clean: true,
  dts: false,
  treeshake: true,
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  skipNodeModulesBundle: true,
  esbuildPlugins: [stubMissingLocals()],
  esbuildOptions(options) {
    options.jsx = 'automatic'
    options.jsxImportSource = 'react'
  },
})
