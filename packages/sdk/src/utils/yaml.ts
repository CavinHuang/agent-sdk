/**
 * YAML parsing wrapper (lazy `yaml` npm package).
 */

export function parseYaml(input: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('yaml') as typeof import('yaml')).parse(input)
}
