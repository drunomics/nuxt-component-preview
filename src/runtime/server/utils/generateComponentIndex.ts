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
  components: any[]
}

export function generateComponentIndex(
  components: Component[],
  tsconfigPath: string,
  options: ComponentIndexOptions
): ComponentIndexData {
  // Filter components
  const filtered = components.filter((c) => {
    // Check directory exclusions
    if (options.excludeDirectories) {
      const excluded = options.excludeDirectories.some(pattern =>
        minimatch(c.shortPath, `**/${pattern}/**`)
      )
      if (excluded) return false
    }

    // Check component name exclusions
    if (options.excludeComponents) {
      const excluded = options.excludeComponents.some(pattern =>
        minimatch(c.kebabName, pattern)
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
        acc[prop.name] = {
          type: mapVueTypeToJsonSchema(prop.type),
          title: prop.name.charAt(0).toUpperCase() + prop.name.slice(1).replace(/([A-Z])/g, ' $1'),
          description: prop.description || undefined,
          default: prop.default !== undefined ? parseDefaultValue(prop.default) : undefined,
        }
        return acc
      }, {} as Record<string, any>)

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
    }
  })

  return {
    version: '1.0',
    components: componentData,
  }
}

function mapVueTypeToJsonSchema(vueType: string): string {
  if (vueType.includes('string')) return 'string'
  if (vueType.includes('number')) return 'number'
  if (vueType.includes('boolean')) return 'boolean'
  if (vueType.includes('object')) return 'object'
  if (vueType.includes('array')) return 'array'
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
