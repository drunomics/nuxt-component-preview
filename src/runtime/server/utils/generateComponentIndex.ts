import type { Component } from '@nuxt/schema'
import { createChecker } from 'vue-component-meta'
import { minimatch } from 'minimatch'

export interface ComponentIndexOptions {
  category: string
  status: 'experimental' | 'stable' | 'deprecated' | 'obsolete'
  excludeDirectories?: string[]
  excludeComponents?: string[]
  overrides?: Record<string, {
    category?: string
    status?: 'experimental' | 'stable' | 'deprecated' | 'obsolete'
  }>
}

export interface ComponentIndexData {
  version: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: any[]
}

export function generateComponentIndex(
  components: Component[],
  tsconfigPath: string,
  options: ComponentIndexOptions,
): ComponentIndexData {
  // Filter components
  const filtered = components.filter((c) => {
    // Check directory exclusions
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
    const meta = checker.getComponentMeta(component.filePath)

    // Extract props, filtering out Vue internals
    const vueInternalProps = ['key', 'ref', 'ref_for', 'ref_key', 'class', 'style']
    const props = meta.props
      .filter(p => !vueInternalProps.includes(p.name))
      .reduce((acc, prop) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const propDef: any = {
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
            const enumLabelsTag = prop.tags.find((t: any) => t.name === 'enumLabels')
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
          const exampleTags = prop.tags.filter((t: any) => t.name === 'example')
          if (exampleTags.length > 0) {
            propDef.examples = exampleTags.map((t: any) => parseDefaultValue(t.text))
          }
        }

        acc[prop.name] = propDef
        return acc
      }, {} as Record<string, any>)

    // Extract slots (excluding default)
    const slots = meta.slots
      .filter(slot => slot.name !== 'default')
      .reduce((acc, slot) => {
        acc[slot.name] = {
          title: slot.name.charAt(0).toUpperCase() + slot.name.slice(1).replace(/([A-Z])/g, ' $1'),
          description: slot.description || undefined,
        }
        return acc
      }, {} as Record<string, any>)

    // Apply overrides if present
    const override = options.overrides?.[component.pascalName]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = {
      id: component.pascalName,
      name: component.pascalName.replace(/([A-Z])/g, ' $1').trim(),
      category: override?.category || options.category,
      status: override?.status || options.status,
      props: {
        type: 'object',
        properties: props,
      },
    }

    if (Object.keys(slots).length > 0) {
      result.slots = slots
    }

    return result
  })

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
  const numMatch = type.match(/\b(\d+)\b(?=\s*\||\s*$)/g)
  if (numMatch) {
    return numMatch.map(m => Number.parseInt(m))
  }

  return []
}

function mapVueTypeToJsonSchema(vueType: string): string {
  // Remove " | undefined" for checking base type
  const cleanType = vueType.replace(/\s*\|\s*undefined/g, '')

  // Check for string literals (union of strings)
  if (cleanType.match(/"[^"]+"/)) return 'string'

  // Check for numeric literals
  if (/^\d+(\s*\|\s*\d+)*/.test(cleanType)) return 'integer'

  // Check base types
  if (cleanType.includes('string')) return 'string'
  if (cleanType.includes('number')) return 'number'
  if (cleanType.includes('boolean')) return 'boolean'
  if (cleanType.includes('object')) return 'object'
  if (cleanType.includes('array')) return 'array'

  return 'string'
}

function parseDefaultValue(defaultStr: string): any {
  // Remove quotes
  const cleaned = defaultStr.replace(/^["']|["']$/g, '')

  if (cleaned === 'true') return true
  if (cleaned === 'false') return false
  if (!isNaN(Number(cleaned))) return Number(cleaned)

  return cleaned
}
