import { existsSync, statSync } from 'node:fs'
import type { Component } from '@nuxt/schema'
import { createChecker } from 'vue-component-meta'
import { minimatch } from 'minimatch'

/**
 * Extract package name from a file path in node_modules
 * Handles scoped packages (@org/package) and regular packages
 */
export function extractPackageName(filePath: string): string | null {
  const match = filePath.match(/[/\\]node_modules[/\\](@[^/\\]+[/\\][^/\\]+|[^/\\]+)/)
  return match ? match[1].replace(/\\/g, '/') : null // Normalize to forward slashes
}

export interface ComponentIndexOptions {
  category: string
  status: 'experimental' | 'stable' | 'deprecated' | 'obsolete'
  includePackages?: boolean | string[] // false = exclude all packages, array = include only these
  excludeDirectories?: string[]
  excludeComponents?: string[]
  overrides?: Record<string, {
    category?: string
    status?: 'experimental' | 'stable' | 'deprecated' | 'obsolete'
  }>
}

interface PropDefinition {
  'type': string
  'title': string
  'description'?: string
  'default'?: string | number | boolean
  'enum'?: (string | number)[]
  'meta:enum'?: Record<string, string>
  'examples'?: (string | number | boolean | object)[]
  '$ref'?: string
}

// Canvas type mappings - maps TypeScript type names to Canvas $ref values
const CANVAS_TYPE_REFS: Record<string, string> = {
  CanvasImage: 'json-schema-definitions://canvas.module/image',
  CanvasVideo: 'json-schema-definitions://canvas.module/video',
}

/**
 * Detect if a Vue type is a Canvas type (CanvasImage, CanvasVideo)
 * Handles various type formats from vue-component-meta:
 * - "CanvasImage"
 * - "CanvasImage | undefined"
 * - "globalThis.CanvasImage | undefined"
 */
function detectCanvasType(vueType: string): string | null {
  // Remove " | undefined" suffix and trim
  let cleanType = vueType.replace(/\s*\|\s*undefined/g, '').trim()
  // Remove "globalThis." prefix if present
  cleanType = cleanType.replace(/^globalThis\./, '')
  return CANVAS_TYPE_REFS[cleanType] || null
}

/**
 * Parse Canvas default value into an object
 * Handles formats from vue-component-meta:
 * - Object literal: "{ src: \"...\", alt: \"...\", ... }"
 * - Factory function: "() => ({ src: \"...\", ... })"
 */
function parseCanvasDefault(defaultStr: string): object | null {
  let objectStr = defaultStr.trim()

  // Handle factory function: () => ({ ... }) or () => { ... }
  const factoryMatch = objectStr.match(/\(\)\s*=>\s*\(?(\{[\s\S]+\})\)?/)
  if (factoryMatch) {
    objectStr = factoryMatch[1]
  }

  // Check if it looks like an object literal
  if (!objectStr.startsWith('{') || !objectStr.endsWith('}')) {
    return null
  }

  try {
    // Convert JS object literal to JSON:
    // - Quote unquoted keys: src: -> "src":
    // - Single to double quotes: 'value' -> "value"
    // - Remove trailing commas: ,} -> }
    const jsonStr = objectStr
      .replace(/(\w+)\s*:/g, '"$1":') // quote keys
      .replace(/'/g, '"') // single to double quotes
      .replace(/,(\s*[}\]])/g, '$1') // remove trailing commas
    return JSON.parse(jsonStr)
  }
  catch {
    return null
  }
}

/**
 * Build a Canvas-compatible prop definition with $ref
 */
function buildCanvasPropDefinition(
  prop: { name: string, description?: string, default?: string, tags?: Array<{ name: string, text?: string }> },
  refValue: string,
): PropDefinition {
  const propDef: PropDefinition = {
    type: 'object',
    $ref: refValue,
    title: prop.name.charAt(0).toUpperCase() + prop.name.slice(1).replace(/([A-Z])/g, ' $1'),
  }

  if (prop.description) propDef.description = prop.description

  // Extract examples from @example tags (parse as JSON objects)
  if (prop.tags) {
    const exampleTags = prop.tags.filter(t => t.name === 'example')
    if (exampleTags.length > 0) {
      const examples = exampleTags.map((t) => {
        try {
          return JSON.parse(t.text || '{}')
        }
        catch {
          return null
        }
      }).filter(Boolean)
      if (examples.length > 0) {
        propDef.examples = examples
      }
    }
  }

  // Use default as example if no @example tags
  if ((!propDef.examples || propDef.examples.length === 0) && prop.default) {
    const defaultObj = parseCanvasDefault(prop.default)
    if (defaultObj) propDef.examples = [defaultObj]
  }

  return propDef
}

interface SlotDefinition {
  title: string
  description?: string
}

interface ComponentDefinition {
  id: string
  name: string
  category: string
  status: string
  props: {
    type: 'object'
    properties: Record<string, PropDefinition>
  }
  slots?: Record<string, SlotDefinition>
}

export interface ComponentIndexData {
  version: string
  components: ComponentDefinition[]
}

export function generateComponentIndex(
  components: Component[],
  tsconfigPath: string,
  options: ComponentIndexOptions,
): ComponentIndexData {
  // Filter components
  const filtered = components.filter((c) => {
    // First check if the path exists
    if (!existsSync(c.filePath)) {
      console.warn(`[nuxt-component-preview] Component file not found: ${c.filePath}`)
      return false
    }

    // Check if it's actually a file (not a directory)
    try {
      const stats = statSync(c.filePath)
      if (stats.isDirectory()) {
        console.log(`[nuxt-component-preview] Skipping directory: ${c.filePath}`)
        return false
      }
    }
    catch (error) {
      console.warn(`[nuxt-component-preview] Error checking file stats for ${c.filePath}:`, error)
      return false
    }

    // Handle package filtering
    const isInNodeModules = c.filePath.includes('/node_modules/') || c.filePath.includes('\\node_modules\\')
    if (isInNodeModules) {
      // Default: exclude all packages (includePackages === false or undefined)
      if (options.includePackages === false || options.includePackages === undefined) {
        return false
      }

      // If includePackages is an array, only include packages in that list
      if (Array.isArray(options.includePackages)) {
        const packageName = extractPackageName(c.filePath)
        if (!packageName || !options.includePackages.includes(packageName)) {
          return false
        }
      }
      // If includePackages === true, include all packages (no filtering)
    }

    // Check directory exclusions (path patterns only)
    if (options.excludeDirectories) {
      const excluded = options.excludeDirectories.some(pattern =>
        minimatch(c.shortPath, `**/${pattern}/**`),
      )
      if (excluded) return false
    }

    // Check component name exclusions
    if (options.excludeComponents) {
      const excluded = options.excludeComponents.some(pattern =>
        minimatch(c.kebabName, pattern),
      )
      if (excluded) return false
    }

    return true
  })

  const checker = createChecker(tsconfigPath, { printer: { newLine: 1 } })

  const componentData = filtered.map((component) => {
    try {
      const meta = checker.getComponentMeta(component.filePath)

      // Extract props, filtering out Vue internals
      const vueInternalProps = ['key', 'ref', 'ref_for', 'ref_key', 'class', 'style']
      const props = meta.props
        .filter(p => !vueInternalProps.includes(p.name))
        .reduce((acc, prop) => {
          // Check for Canvas types first (CanvasImage, CanvasVideo)
          const canvasRef = detectCanvasType(prop.type)
          if (canvasRef) {
            acc[prop.name] = buildCanvasPropDefinition(prop, canvasRef)
            return acc
          }

          // Regular prop processing
          const propDef: Partial<PropDefinition> = {
            type: mapVueTypeToJsonSchema(prop.type),
            title: prop.name.charAt(0).toUpperCase() + prop.name.slice(1).replace(/([A-Z])/g, ' $1'),
          }

          if (prop.description) propDef.description = prop.description
          if (prop.default !== undefined) propDef.default = parseDefaultValue(prop.default)

          // Extract enum from TypeScript union types
          const enumValues = extractEnumFromType(prop.type)
          if (enumValues.length > 0) {
            propDef.enum = enumValues

            // Check for custom @enumLabels JSDoc tag
            let metaEnum: Record<string, string> | undefined
            if (prop.tags) {
              const enumLabelsTag = prop.tags.find((t: { name: string, text?: string }) => t.name === 'enumLabels')
              if (enumLabelsTag?.text) {
                try {
                  metaEnum = JSON.parse(enumLabelsTag.text)
                }
                catch {
                  console.warn(`Invalid @enumLabels JSON for ${prop.name}:`, enumLabelsTag.text)
                }
              }
            }

            // Generate meta:enum only if custom labels provided or auto-generation adds value
            if (!metaEnum) {
              const isNumericEnum = enumValues.every(v => typeof v === 'number')
              if (!isNumericEnum) {
                metaEnum = enumValues.reduce((acc, val) => {
                  const strVal = String(val)
                  // Convert kebab-case and camelCase to Title Case
                  const label = strVal
                    .replace(/[-_]/g, ' ')
                    .replace(/([A-Z])/g, ' $1')
                    .trim()
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')
                  acc[val] = label
                  return acc
                }, {} as Record<string, string>)

                // Only include if it differs from raw values
                const addsValue = Object.entries(metaEnum).some(([key, val]) => key !== val)
                if (!addsValue) {
                  metaEnum = undefined
                }
              }
            }

            if (metaEnum) {
              propDef['meta:enum'] = metaEnum
            }
          }

          // Add examples from @example JSDoc tags
          if (prop.tags) {
            const exampleTags = prop.tags.filter((t: { name: string, text?: string }) => t.name === 'example')
            if (exampleTags.length > 0) {
              propDef.examples = exampleTags.map((t: { text?: string }) => parseDefaultValue(t.text || ''))
            }
          }

          acc[prop.name] = propDef as PropDefinition
          return acc
        }, {} as Record<string, PropDefinition>)

      // Extract slots
      const slots = meta.slots
        .reduce((acc, slot) => {
          acc[slot.name] = {
            title: slot.name.charAt(0).toUpperCase() + slot.name.slice(1).replace(/([A-Z])/g, ' $1'),
            description: slot.description || undefined,
          }
          return acc
        }, {} as Record<string, SlotDefinition>)

      // Apply overrides if present
      const override = options.overrides?.[component.pascalName]

      return {
        id: component.pascalName,
        name: component.pascalName.replace(/([A-Z])/g, ' $1').trim(),
        category: override?.category || options.category,
        status: override?.status || options.status,
        props: {
          type: 'object',
          properties: props,
        },
        ...(Object.keys(slots).length > 0 && { slots }),
      }
    }
    catch (error) {
      // Log different message based on file type to help debugging
      const fileExt = component.filePath.split('.').pop()
      if (fileExt !== 'vue') {
        console.warn(`[nuxt-component-preview] Could not extract metadata from ${fileExt} file: ${component.filePath}`)
      }
      else {
        console.error(`[nuxt-component-preview] Error processing component ${component.filePath}:`, error)
      }
      // Return null to filter out components that can't be processed
      return null
    }
  }).filter(Boolean) as ComponentDefinition[]

  return {
    version: '1.0',
    components: componentData,
  }
}

function extractEnumFromType(type: string): string[] {
  // Match TypeScript union literals: "value1" | "value2" | ...
  const match = type.match(/"([^"]+)"/g)
  if (match) {
    return match.map(m => m.replace(/"/g, ''))
  }

  // Also try numeric unions: 25 | 33 | 50
  const numMatch = type.match(/(?:^|\s)(\d+)(?=\s*\||$)/g)
  if (numMatch) {
    return numMatch.map(m => Number.parseInt(m.trim()))
  }

  return []
}

function mapVueTypeToJsonSchema(vueType: string): string {
  // Remove " | undefined" for checking base type
  const cleanType = vueType.replace(/\s*\|\s*undefined/g, '')

  // Check for string literals (union of strings)
  if (cleanType.match(/"[^"]+"/)) return 'string'

  // Check for numeric literals
  if (/^\d+(?:\s*\|\s*\d+)*/.test(cleanType)) return 'integer'

  // Check base types
  if (cleanType.includes('string')) return 'string'
  if (cleanType.includes('number')) return 'number'
  if (cleanType.includes('boolean')) return 'boolean'
  if (cleanType.includes('object')) return 'object'
  if (cleanType.includes('array')) return 'array'

  return 'string'
}

function parseDefaultValue(defaultStr: string): string | number | boolean {
  // Remove quotes
  const cleaned = defaultStr.replace(/^["']|["']$/g, '')

  if (cleaned === 'true') return true
  if (cleaned === 'false') return false
  if (!Number.isNaN(Number(cleaned)) && cleaned !== '') return Number(cleaned)

  return cleaned
}
