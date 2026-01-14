import { readdirSync } from 'node:fs'
import { join } from 'node:path'

export interface ScannedComponent {
  pascalName: string
  kebabName: string
  filePath: string
  shortPath: string
  global: boolean
}

/**
 * Convert filename to PascalCase component name
 */
function toPascalCase(filename: string): string {
  const name = filename.replace(/\.vue$/, '')
  return name
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * Convert filename to kebab-case
 */
function toKebabCase(filename: string): string {
  return filename.replace(/\.vue$/, '').toLowerCase()
}

/**
 * Scan directories for .vue files and build component list
 */
export function scanComponentDirs(dirs: string[]): ScannedComponent[] {
  const components: ScannedComponent[] = []

  for (const dir of dirs) {
    try {
      const files = readdirSync(dir)
      for (const file of files) {
        if (!file.endsWith('.vue')) continue
        const filePath = join(dir, file)
        components.push({
          pascalName: toPascalCase(file),
          kebabName: toKebabCase(file),
          filePath,
          shortPath: filePath,
          global: true,
        })
      }
    }
    catch {
      // Directory might not exist or be inaccessible
    }
  }

  return components
}
