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
  'contentMediaType'?: string
  'x-formatting-context'?: 'block' | 'inline'
}

// Canvas type mappings - maps TypeScript type names to Canvas $ref values
const CANVAS_TYPE_REFS: Record<string, string> = {
  CanvasImage: 'json-schema-definitions://canvas.module/image',
  CanvasVideo: 'json-schema-definitions://canvas.module/video',
}

/**
 * Detect @schemaRef JSDoc tag and convert to full $ref URI.
 *
 * Supports shorthand notation: PREFIX/NAME -> json-schema-definitions://PREFIX.module/NAME
 * Examples:
 *   @schemaRef canvas/stream-wrapper-uri -> json-schema-definitions://canvas.module/stream-wrapper-uri
 *   @schemaRef canvas/image-uri -> json-schema-definitions://canvas.module/image-uri
 *
 * Also supports full URIs if needed:
 *   @schemaRef json-schema-definitions://custom.module/my-type
 */
function detectSchemaRefTag(tags?: Array<{ name: string, text?: string }>): string | null {
  if (!tags) return null

  const schemaRefTag = tags.find(t => t.name === 'schemaRef')
  if (!schemaRefTag?.text?.trim()) return null

  const refValue = schemaRefTag.text.trim()

  // If it's already a full URI, use as-is
  if (refValue.startsWith('json-schema-definitions://')) {
    return refValue
  }

  // Parse shorthand: PREFIX/NAME -> json-schema-definitions://PREFIX.module/NAME
  const match = refValue.match(/^([a-z_-]+)\/([a-z_-]+)$/i)
  if (match) {
    const [, prefix, name] = match
    return `json-schema-definitions://${prefix}.module/${name}`
  }

  console.warn(`[nuxt-component-preview] Invalid @schemaRef value: ${refValue}`)
  return null
}

/**
 * Extract examples from @example JSDoc tags with optional default fallback.
 * Parses examples based on the expected type (string vs object).
 */
function extractExamples(
  prop: { default?: string, tags?: Array<{ name: string, text?: string }> },
  exampleType: 'string' | 'object' = 'string',
): (string | number | boolean | object)[] | undefined {
  const examples: (string | number | boolean | object)[] = []

  // Extract from @example tags
  if (prop.tags) {
    const exampleTags = prop.tags.filter(t => t.name === 'example')
    for (const tag of exampleTags) {
      const text = tag.text?.trim() || ''
      if (!text) continue

      if (exampleType === 'object') {
        // Try JSON first
        try {
          examples.push(JSON.parse(text))
          continue
        }
        catch {
          // Not valid JSON, try other formats
        }

        // Try JS object literal syntax
        const jsObj = parseCanvasDefault(text)
        if (jsObj) {
          examples.push(jsObj)
          continue
        }

        // Try key-value pairs syntax
        const kvObj = parseKeyValueExample(text)
        if (kvObj) {
          examples.push(kvObj)
        }
      }
      else {
        // String type - use as-is
        examples.push(text)
      }
    }
  }

  // Fall back to default if no examples found
  if (examples.length === 0 && prop.default) {
    if (exampleType === 'object') {
      const defaultObj = parseCanvasDefault(prop.default)
      if (defaultObj) {
        examples.push(defaultObj)
      }
    }
    else {
      const defaultVal = parseDefaultValue(prop.default)
      if (defaultVal !== '') {
        examples.push(defaultVal)
      }
    }
  }

  return examples.length > 0 ? examples : undefined
}

/** Options for building a prop definition */
interface PropDefinitionOptions {
  type: string
  $ref?: string
  contentMediaType?: string
  formattingContext?: 'block' | 'inline'
  exampleType?: 'string' | 'object'
}

/**
 * Build a prop definition with the given options.
 * Handles title/description extraction and examples.
 */
function buildPropDefinition(
  prop: { name: string, description?: string, default?: string, tags?: Array<{ name: string, text?: string }> },
  options: PropDefinitionOptions,
): PropDefinition {
  const { title, description } = extractTitleFromJSDoc(prop)
  const propDef: PropDefinition = {
    type: options.type,
    title,
  }

  if (description) propDef.description = description
  if (options.$ref) propDef.$ref = options.$ref
  if (options.contentMediaType) propDef.contentMediaType = options.contentMediaType
  if (options.formattingContext) propDef['x-formatting-context'] = options.formattingContext

  // Extract examples
  const examples = extractExamples(prop, options.exampleType || 'string')
  if (examples) {
    propDef.examples = examples
  }

  return propDef
}

/**
 * Generate a human-readable title from a prop/slot name
 * Converts camelCase to Title Case (e.g., "heroImage" -> "Hero Image")
 */
function generateTitle(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')
}

const TITLE_MAX_LENGTH = 24

/**
 * Extract title and description from JSDoc comments.
 * Priority:
 * 1. @title tag if present
 * 2. First line of description if short enough (≤50 chars)
 * 3. Fallback to name-based generation
 *
 * Supports standard JSDoc format:
 *   Short summary line (becomes title)
 *
 *   Extended description continues here.
 */
function extractTitleFromJSDoc(
  prop: { name: string, description?: string, tags?: Array<{ name: string, text?: string }> },
): { title: string, description?: string } {
  // 1. Check for @title tag (only use first line)
  const titleTag = prop.tags?.find(t => t.name === 'title')
  if (titleTag?.text?.trim()) {
    const titleText = titleTag.text.split('\n')[0].trim()
    if (titleText) {
      return {
        title: titleText,
        description: prop.description,
      }
    }
  }

  // 2. Check description first line
  if (prop.description) {
    const lines = prop.description.split('\n')
    const firstLine = lines[0].trim()

    if (firstLine.length > 0 && firstLine.length <= TITLE_MAX_LENGTH) {
      // Determine remaining description
      let remainingLines = lines.slice(1)

      // Remove leading empty line (JSDoc summary/description separator)
      if (remainingLines.length > 0 && remainingLines[0].trim() === '') {
        remainingLines = remainingLines.slice(1)
      }

      const remainingDescription = remainingLines.join('\n').trim() || undefined

      return {
        title: firstLine,
        description: remainingDescription,
      }
    }
  }

  // 3. Fallback to name-based generation
  return {
    title: generateTitle(prop.name),
    description: prop.description,
  }
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
 * Detect formatted text from JSDoc @contentMediaType tag
 * Returns formatting context info if prop has @contentMediaType text/html
 */
function detectFormattedText(tags?: Array<{ name: string, text?: string }>): { contentMediaType: string, formattingContext: 'block' | 'inline' } | null {
  if (!tags) return null

  const contentMediaTypeTag = tags.find(t => t.name === 'contentMediaType')
  if (!contentMediaTypeTag?.text?.trim()) return null

  const mediaType = contentMediaTypeTag.text.trim()
  if (mediaType !== 'text/html') return null

  // Check for @formattingContext tag, default to 'block'
  const formattingContextTag = tags.find(t => t.name === 'formattingContext')
  const formattingContext = formattingContextTag?.text?.trim() as 'block' | 'inline' | undefined

  return {
    contentMediaType: mediaType,
    formattingContext: formattingContext === 'inline' ? 'inline' : 'block',
  }
}

/**
 * Extract enum labels from @enumLabels tag or auto-generate from values.
 * Returns undefined if labels don't add value over raw enum values.
 */
function extractEnumLabels(
  prop: { name: string, tags?: Array<{ name: string, text?: string }> },
  enumValues: (string | number)[],
): Record<string, string> | undefined {
  // Check for custom @enumLabels JSDoc tag
  if (prop.tags) {
    const enumLabelsTag = prop.tags.find(t => t.name === 'enumLabels')
    if (enumLabelsTag?.text) {
      try {
        return JSON.parse(enumLabelsTag.text)
      }
      catch {
        console.warn(`Invalid @enumLabels JSON for ${prop.name}:`, enumLabelsTag.text)
      }
    }
  }

  // Auto-generate labels only for string enums
  const isNumericEnum = enumValues.every(v => typeof v === 'number')
  if (isNumericEnum) return undefined

  const metaEnum = enumValues.reduce((acc, val) => {
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
  return addsValue ? metaEnum : undefined
}


/**
 * Parse key-value pair syntax into an object
 * Format: key=value key2="value with spaces" key3=123
 * - Unquoted values end at whitespace
 * - Quoted values (single or double) can contain spaces
 * - Numbers are parsed as numbers
 */
function parseKeyValueExample(str: string): object | null {
  const trimmed = str.trim()
  // Must contain at least one key=value pattern
  if (!trimmed.includes('=')) return null
  // Should not look like JSON or JS object
  if (trimmed.startsWith('{')) return null

  const result: Record<string, string | number | boolean> = {}
  // Match: key=value, key="quoted value", key='quoted value'
  const pattern = /(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g
  let match

  while ((match = pattern.exec(trimmed)) !== null) {
    const key = match[1]
    const value = match[2] ?? match[3] ?? match[4]

    // Try to parse as number
    if (/^-?\d+(?:\.\d+)?$/.test(value)) {
      result[key] = Number(value)
    }
    // Parse booleans
    else if (value === 'true') {
      result[key] = true
    }
    else if (value === 'false') {
      result[key] = false
    }
    else {
      result[key] = value
    }
  }

  return Object.keys(result).length > 0 ? result : null
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
            acc[prop.name] = buildPropDefinition(prop, {
              type: 'object',
              $ref: canvasRef,
              exampleType: 'object',
            })
            return acc
          }

          // Check for formatted text (@contentMediaType text/html)
          const formattedTextInfo = detectFormattedText(prop.tags)
          if (formattedTextInfo) {
            acc[prop.name] = buildPropDefinition(prop, {
              type: 'string',
              contentMediaType: formattedTextInfo.contentMediaType,
              formattingContext: formattedTextInfo.formattingContext,
            })
            return acc
          }

          // Check for @schemaRef JSDoc tag (e.g., @schemaRef canvas/stream-wrapper-uri)
          const schemaRef = detectSchemaRefTag(prop.tags)
          if (schemaRef) {
            acc[prop.name] = buildPropDefinition(prop, {
              type: 'string',
              $ref: schemaRef,
            })
            return acc
          }

          // Regular prop processing - use buildPropDefinition for base, then add extras
          const propDef = buildPropDefinition(prop, {
            type: mapVueTypeToJsonSchema(prop.type),
          })

          if (prop.default !== undefined) propDef.default = parseDefaultValue(prop.default)

          // Extract enum from TypeScript union types
          const enumValues = extractEnumFromType(prop.type)
          if (enumValues.length > 0) {
            propDef.enum = enumValues
            const metaEnum = extractEnumLabels(prop, enumValues)
            if (metaEnum) {
              propDef['meta:enum'] = metaEnum
            }
          }

          acc[prop.name] = propDef
          return acc
        }, {} as Record<string, PropDefinition>)

      // Extract slots
      const slots = meta.slots
        .reduce((acc, slot) => {
          acc[slot.name] = {
            title: generateTitle(slot.name),
            description: slot.description || undefined,
          }
          return acc
        }, {} as Record<string, SlotDefinition>)

      // Apply overrides if present
      const override = options.overrides?.[component.pascalName]

      return {
        id: component.pascalName,
        name: generateTitle(component.pascalName),
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
