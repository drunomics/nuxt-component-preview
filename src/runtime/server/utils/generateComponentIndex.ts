import { existsSync, statSync, readFileSync } from 'node:fs'
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

/** Lightweight component shape written to the index config file. */
export type IndexComponent = Pick<Component, 'pascalName' | 'kebabName' | 'filePath' | 'shortPath' | 'global'>

/**
 * Map Nuxt's resolved global components to the shape written to the index
 * config. node_modules (layer/package) components are intentionally retained:
 * generateComponentIndex applies the includePackages / include.directories
 * filters downstream, so dropping them here would make those options dead for
 * layer components and silently shrink the registry to project-local files.
 */
export function collectIndexComponents(globalComponents: Component[]): IndexComponent[] {
  return globalComponents.map(c => ({
    pascalName: c.pascalName,
    kebabName: c.kebabName,
    filePath: c.filePath,
    shortPath: c.shortPath,
    global: c.global,
  }))
}

export interface CategoryDirectoryOptions {
  directory: true
  fallback?: string
}

export interface ComponentIndexOptions {
  category: string | CategoryDirectoryOptions
  status: 'experimental' | 'stable' | 'deprecated' | 'obsolete'
  includePackages?: boolean | string[] // false = exclude all packages, array = include only these
  includeDirectories?: string[] // When set, only components in these directories are indexed
  excludeDirectories?: string[]
  excludeComponents?: string[]
  overrides?: Record<string, {
    name?: string
    description?: string
    category?: string
    status?: 'experimental' | 'stable' | 'deprecated' | 'obsolete'
  }>
}

/**
 * Resolve category for a component based on its shortPath and the category option.
 *
 * When category is a string, it's used as-is.
 * When category is { directory: true }, the parent folder name is used.
 * Falls back to explicit fallback, then to root folder name.
 *
 * @example
 * // shortPath: "components/Canvas/Base/base-button.vue"
 * // → parent folder: "Base"
 * // → root folder: "Canvas"
 */
export function resolveCategory(category: string | CategoryDirectoryOptions, shortPath: string): string {
  if (typeof category === 'string') {
    return category
  }

  const parts = shortPath.split('/')
  // parts: ["components", "Canvas", "Base", "base-button.vue"]
  // We need at least: root/subfolder/file.vue (3+ parts) to have a subfolder
  if (parts.length >= 4) {
    // Use the immediate parent folder (second to last)
    return parts[parts.length - 2]
  }

  // No subfolder — use explicit fallback or root folder name
  if (category.fallback) {
    return category.fallback
  }

  // Root folder: second element (first is "components")
  if (parts.length >= 3) {
    return parts[parts.length - 2]
  }

  return 'Components'
}

/**
 * Component-level metadata extracted from JSDoc in <script setup>.
 */
export interface ComponentMeta {
  name?: string
  description?: string
  category?: string
  status?: 'experimental' | 'stable' | 'deprecated' | 'obsolete'
}

/**
 * Extract component-level metadata from the first JSDoc comment in <script setup>.
 *
 * The first JSDoc block before any code is treated as component metadata:
 * - First line → custom display name (if short enough)
 * - @description tag → component description
 * - @category tag → category override
 * - @status tag → status override (experimental, stable, deprecated, obsolete)
 *
 * Also checks vue-component-meta's description field (works with export default).
 *
 */
export function extractComponentMeta(filePath: string, vcmDescription?: string): ComponentMeta {
  const result: ComponentMeta = {}

  // Use vue-component-meta description if available (from export default JSDoc)
  if (vcmDescription) {
    const lines = vcmDescription.split('\n')
    const firstLine = lines[0].trim()
    if (firstLine && firstLine.length <= 50) {
      result.name = firstLine
    }
    if (lines.length > 1) {
      result.description = lines.slice(1).join('\n').trim() || undefined
    }
    else {
      result.description = firstLine
    }
    return result
  }

  // Parse <script setup> for component-level JSDoc
  try {
    const source = readFileSync(filePath, 'utf-8')
    const scriptMatch = source.match(/<script\s[^>]*setup[^>]*>([\s\S]*?)<\/script>/)
    if (!scriptMatch) return result

    const script = scriptMatch[1]
    // Find the first JSDoc comment that appears before any code
    const jsdocMatch = script.match(/^\s*\/\*\*([\s\S]*?)\*\//)
    if (!jsdocMatch) return result

    const comment = jsdocMatch[1]
    const lines = comment
      .split('\n')
      .map(line => line.replace(/^\s*\*\s?/, '').trim())
      .filter(line => line.length > 0)

    // Extract @description tag
    const descTag = lines.find(l => l.startsWith('@description '))
    if (descTag) {
      result.description = descTag.replace('@description ', '').trim()
    }

    // Extract @category tag
    const catTag = lines.find(l => l.startsWith('@category '))
    if (catTag) {
      result.category = catTag.replace('@category ', '').trim()
    }

    // Extract @status tag
    const statusTag = lines.find(l => l.startsWith('@status '))
    if (statusTag) {
      const statusValue = statusTag.replace('@status ', '').trim()
      if (['experimental', 'stable', 'deprecated', 'obsolete'].includes(statusValue)) {
        result.status = statusValue as ComponentMeta['status']
      }
    }

    // First non-tag line is the name (if short enough)
    const firstNonTag = lines.find(l => !l.startsWith('@'))
    if (firstNonTag && firstNonTag.length <= 50) {
      result.name = firstNonTag
    }

    // If no @description, use remaining non-tag lines after first as description
    if (!result.description) {
      const nonTagLines = lines.filter(l => !l.startsWith('@'))
      if (nonTagLines.length > 1) {
        result.description = nonTagLines.slice(1).join(' ').trim() || undefined
      }
    }
  }
  catch {
    // Ignore parse errors
  }

  return result
}

interface PropDefinition {
  'type': string
  'title': string
  'description'?: string
  'default'?: string | number | boolean | unknown[]
  'enum'?: (string | number)[]
  'meta:enum'?: Record<string, string>
  'examples'?: (string | number | boolean | object)[]
  '$ref'?: string
  'format'?: string
  'pattern'?: string
  'contentMediaType'?: string
  'x-formatting-context'?: 'block' | 'inline'
  /** Allowed URI schemes for Canvas stream wrapper/URL props */
  'x-allowed-schemes'?: string[]
  // Array support
  'items'?: Partial<PropDefinition>
  'maxItems'?: number
  'minItems'?: number
}

// Canvas type mappings - maps TypeScript type names to Canvas $ref values
const CANVAS_TYPE_REFS: Record<string, string> = {
  CanvasImage: 'json-schema-definitions://canvas.module/image',
  CanvasVideo: 'json-schema-definitions://canvas.module/video',
}

/**
 * Known Canvas schema definitions with their required properties.
 *
 * These properties must be included in the component index alongside the $ref
 * because Canvas uses them for field type determination before resolving refs.
 *
 * @see web/modules/contrib/canvas/schema.json
 */
const CANVAS_SCHEMA_DEFINITIONS: Record<string, Record<string, unknown>> = {
  'canvas/stream-wrapper-uri': {
    'format': 'uri',
    'x-allowed-schemes': ['public'],
  },
  'canvas/stream-wrapper-image-uri': {
    'format': 'uri',
    'contentMediaType': 'image/*',
    'x-allowed-schemes': ['public'],
  },
  'canvas/image-uri': {
    'format': 'uri-reference',
    'contentMediaType': 'image/*',
    'x-allowed-schemes': ['http', 'https'],
  },
}

/**
 * Get additional schema properties for a known Canvas schema ref.
 *
 * @param shorthandRef - The shorthand ref (e.g., "canvas/stream-wrapper-uri")
 * @returns Additional schema properties to include, or empty object if unknown
 */
function getSchemaRefProperties(shorthandRef: string): Record<string, unknown> {
  return CANVAS_SCHEMA_DEFINITIONS[shorthandRef] ?? {}
}

interface SchemaRefResult {
  /** The full $ref URI (e.g., "json-schema-definitions://canvas.module/stream-wrapper-uri") */
  $ref: string
  /** The shorthand ref for property lookup (e.g., "canvas/stream-wrapper-uri") */
  shorthand: string
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
 *
 * @returns Object with $ref (full URI) and shorthand (for property lookup), or null
 */
function detectSchemaRefTag(tags?: Array<{ name: string, text?: string }>): SchemaRefResult | null {
  if (!tags) return null

  const schemaRefTag = tags.find(t => t.name === 'schemaRef')
  if (!schemaRefTag?.text?.trim()) return null

  const refValue = schemaRefTag.text.trim()

  // If it's already a full URI, extract shorthand from it
  if (refValue.startsWith('json-schema-definitions://')) {
    // Extract shorthand: json-schema-definitions://prefix.module/name -> prefix/name
    const uriMatch = refValue.match(/^json-schema-definitions:\/\/([a-z_-]+)\.module\/([a-z_-]+)$/i)
    const shorthand = uriMatch ? `${uriMatch[1]}/${uriMatch[2]}` : refValue
    return { $ref: refValue, shorthand }
  }

  // Parse shorthand: PREFIX/NAME -> json-schema-definitions://PREFIX.module/NAME
  const match = refValue.match(/^([a-z_-]+)\/([a-z_-]+)$/i)
  if (match) {
    const [, prefix, name] = match
    return {
      $ref: `json-schema-definitions://${prefix}.module/${name}`,
      shorthand: refValue,
    }
  }

  console.warn(`[nuxt-component-preview] Invalid @schemaRef value: ${refValue}`)
  return null
}

/**
 * Detect @format JSDoc tag for JSON Schema string format.
 *
 * Canvas-supported formats with widgets:
 * - date: Date picker (YYYY-MM-DD)
 * - date-time: DateTime picker
 * - email: Email input
 * - uri / uri-reference: Link field
 *
 * @example
 * // @format date
 * eventDate?: string
 */
function detectFormatTag(tags?: Array<{ name: string, text?: string }>): string | null {
  if (!tags) return null

  const formatTag = tags.find(t => t.name === 'format')
  if (!formatTag?.text?.trim()) return null

  return formatTag.text.trim()
}

/**
 * Detect @pattern JSDoc tag for JSON Schema regex pattern.
 *
 * Useful for textarea (multiline text):
 *   @pattern (.|\r?\n)*
 *
 * @example
 * // @pattern (.|\r?\n)*
 * description?: string
 */
function detectPatternTag(tags?: Array<{ name: string, text?: string }>): string | null {
  if (!tags) return null

  const patternTag = tags.find(t => t.name === 'pattern')
  if (!patternTag?.text?.trim()) return null

  return patternTag.text.trim()
}

/**
 * Detect @allowed-schemes JSDoc tag for URI scheme restrictions.
 *
 * @example
 * // @allowed-schemes public
 * fileUri?: string
 *
 * // @allowed-schemes http, https
 * webUrl?: string
 */
function detectAllowedSchemesTag(tags?: Array<{ name: string, text?: string }>): string[] | null {
  if (!tags) return null

  const schemesTag = tags.find(t => t.name === 'allowed-schemes')
  if (!schemesTag?.text?.trim()) return null

  return schemesTag.text.trim().split(/[,\s]+/).filter(Boolean)
}

/**
 * Detect @maxItems JSDoc tag for array cardinality.
 *
 * @example
 * // @maxItems 10
 * tags?: string[]
 */
function detectMaxItemsTag(tags?: Array<{ name: string, text?: string }>): number | null {
  if (!tags) return null

  const maxItemsTag = tags.find(t => t.name === 'maxItems')
  if (!maxItemsTag?.text?.trim()) return null

  const num = Number.parseInt(maxItemsTag.text.trim(), 10)
  return Number.isNaN(num) ? null : num
}

/**
 * Detect @minItems JSDoc tag for array required cardinality.
 *
 * Canvas signals "required" for multi-value props via `minItems: 1`.
 *
 * @example
 * // @minItems 1
 * tags: string[]
 */
function detectMinItemsTag(tags?: Array<{ name: string, text?: string }>): number | null {
  if (!tags) return null

  const minItemsTag = tags.find(t => t.name === 'minItems')
  if (!minItemsTag?.text?.trim()) return null

  const num = Number.parseInt(minItemsTag.text.trim(), 10)
  return Number.isNaN(num) ? null : num
}

/**
 * Detect @itemsFormat JSDoc tag for the JSON Schema format of array items.
 *
 * Canvas-supported formats (uri, uri-reference, date, date-time, email).
 *
 * @example
 * // @itemsFormat uri
 * links?: string[]
 */
function detectItemsFormatTag(tags?: Array<{ name: string, text?: string }>): string | null {
  if (!tags) return null

  const itemsFormatTag = tags.find(t => t.name === 'itemsFormat')
  if (!itemsFormatTag?.text?.trim()) return null

  return itemsFormatTag.text.trim()
}

/**
 * Detect @itemsSchemaRef JSDoc tag for the $ref of array items.
 *
 * Supports the same shorthand notation as @schemaRef.
 *
 * @example
 * // @itemsSchemaRef canvas/stream-wrapper-uri
 * attachments?: string[]
 */
function detectItemsSchemaRefTag(tags?: Array<{ name: string, text?: string }>): SchemaRefResult | null {
  if (!tags) return null

  const tag = tags.find(t => t.name === 'itemsSchemaRef')
  if (!tag?.text?.trim()) return null

  // Reuse @schemaRef parser by mapping name to 'schemaRef'.
  return detectSchemaRefTag([{ name: 'schemaRef', text: tag.text }])
}

/**
 * Schema type from vue-component-meta
 */
interface VueMetaSchema {
  kind?: string
  type?: string
  schema?: (string | VueMetaSchema)[]
}

/**
 * Detect array type from TypeScript type string.
 * Handles: string[], number[], Array<string>, Type[] | undefined
 * Returns the element type or null if not an array.
 */
function detectArrayFromTypeString(typeStr: string): string | null {
  // Remove " | undefined" suffix
  const cleanType = typeStr.replace(/\s*\|\s*undefined/g, '').trim()

  // Handle T[] syntax: string[], number[], CanvasImage[]
  const bracketMatch = cleanType.match(/^(.+)\[\]$/)
  if (bracketMatch) {
    return stripOuterParens(bracketMatch[1])
  }

  // Handle Array<T> syntax
  const genericMatch = cleanType.match(/^Array<(.+)>$/i)
  if (genericMatch) {
    return stripOuterParens(genericMatch[1])
  }

  return null
}

/**
 * Strip a single layer of outer parens, e.g. `(10 | 20)` -> `10 | 20`.
 *
 * TypeScript writes union element types of `T[]` as `(A | B)[]`; the outer
 * parens trip up the scalar prop helpers (mapVueTypeToJsonSchema,
 * extractEnumFromType) that operate on the union string directly.
 */
function stripOuterParens(type: string): string {
  const trimmed = type.trim()
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

/**
 * Detect array type from vue-component-meta schema or type string.
 * Returns the element type string or null if not an array.
 *
 * Handles:
 * - Structured schema: { kind: "array", schema: ["string"] }
 * - Optional array schema: { kind: "enum", schema: ["undefined", { kind: "array", ... }] }
 * - Type string fallback: "string[]", "Array<number>"
 */
function detectArrayFromSchema(schema: string | VueMetaSchema | undefined, typeString?: string): { elementType: string, elementSchema?: VueMetaSchema } | null {
  // If schema is a string, try to parse array from type string
  if (typeof schema === 'string' || !schema) {
    if (typeString) {
      const elementType = detectArrayFromTypeString(typeString)
      if (elementType) {
        return { elementType }
      }
    }
    return null
  }

  // Direct array: { kind: "array", schema: ["string"] }
  if (schema.kind === 'array' && Array.isArray(schema.schema) && schema.schema.length > 0) {
    const firstElement = schema.schema[0]
    if (typeof firstElement === 'string') {
      return { elementType: firstElement }
    }
    if (typeof firstElement === 'object' && firstElement !== null) {
      return { elementType: firstElement.type || 'unknown', elementSchema: firstElement }
    }
  }

  // Optional array: { kind: "enum", schema: ["undefined", { kind: "array", ... }] }
  if (schema.kind === 'enum' && Array.isArray(schema.schema)) {
    for (const member of schema.schema) {
      if (typeof member === 'object' && member !== null && member.kind === 'array') {
        return detectArrayFromSchema(member, typeString)
      }
    }
  }

  // Fallback: try parsing from type string if schema didn't have array info
  if (typeString) {
    const elementType = detectArrayFromTypeString(typeString)
    if (elementType) {
      return { elementType }
    }
  }

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
  'type': string
  '$ref'?: string
  'format'?: string
  'pattern'?: string
  'contentMediaType'?: string
  'formattingContext'?: 'block' | 'inline'
  'exampleType'?: 'string' | 'object'
  /** Allowed URI schemes for Canvas stream wrapper/URL props */
  'x-allowed-schemes'?: string[]
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
  if (options.format) propDef.format = options.format
  if (options.pattern) propDef.pattern = options.pattern
  if (options.contentMediaType) propDef.contentMediaType = options.contentMediaType
  if (options.formattingContext) propDef['x-formatting-context'] = options.formattingContext
  if (options['x-allowed-schemes']) propDef['x-allowed-schemes'] = options['x-allowed-schemes']

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
    required?: string[]
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

    // Check directory inclusions — when set, only keep components in these directories
    if (options.includeDirectories && options.includeDirectories.length > 0) {
      const included = options.includeDirectories.some(pattern =>
        minimatch(c.shortPath, `**/${pattern}/**`),
      )
      if (!included) return false
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
        .filter(p => !p.name.startsWith('onVue:'))
        .reduce((acc, prop) => {
          // Check for array types first (string[], number[], CanvasImage[], etc.)
          const arrayInfo = detectArrayFromSchema(prop.schema as string | VueMetaSchema | undefined, prop.type)
          if (arrayInfo) {
            const { title, description } = extractTitleFromJSDoc(prop)
            const propDef: PropDefinition = {
              type: 'array',
              title,
            }
            if (description) propDef.description = description

            // Build items schema based on element type
            const elementType = arrayInfo.elementType
            const canvasRef = detectCanvasType(elementType)
            if (canvasRef) {
              // Array of Canvas types (CanvasImage[], CanvasVideo[])
              propDef.items = { type: 'object', $ref: canvasRef }
            }
            else {
              // Array of primitives (string[], number[], boolean[]) — plus
              // optional refinements from JSDoc / TS union literals applied
              // to the *items* schema (canvas 1.4 multi-value props).
              const itemsSchema: Partial<PropDefinition> = {
                type: mapVueTypeToJsonSchema(elementType),
              }

              // Element-type enum: detect a string/integer literal union in
              // the element type and lift it into items.enum + meta:enum.
              const itemEnumValues = extractEnumFromType(elementType)
              if (itemEnumValues.length > 0) {
                itemsSchema.enum = itemEnumValues
                const metaEnum = extractEnumLabels(prop, itemEnumValues)
                if (metaEnum) itemsSchema['meta:enum'] = metaEnum
              }

              // @itemsFormat — applies to a string-typed element (uri, date,
              // date-time, etc.).
              const itemsFormat = detectItemsFormatTag(prop.tags)
              if (itemsFormat) itemsSchema.format = itemsFormat

              // @itemsSchemaRef — $ref for an element that is not a built-in
              // Canvas alias (CanvasImage/CanvasVideo).
              const itemsRef = detectItemsSchemaRefTag(prop.tags)
              if (itemsRef) {
                itemsSchema.$ref = itemsRef.$ref
                Object.assign(itemsSchema, getSchemaRefProperties(itemsRef.shorthand))
              }

              propDef.items = itemsSchema
            }

            // Check for @maxItems / @minItems
            const maxItems = detectMaxItemsTag(prop.tags)
            if (maxItems) propDef.maxItems = maxItems
            const minItems = detectMinItemsTag(prop.tags)
            if (minItems) propDef.minItems = minItems

            // Extract examples (should be arrays)
            const examples = extractExamples(prop, 'object')
            if (examples) propDef.examples = examples

            // Parse default value for arrays
            if (prop.default !== undefined) {
              propDef.default = parseArrayDefaultValue(prop.default)
            }

            acc[prop.name] = propDef
            return acc
          }

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
          const schemaRefResult = detectSchemaRefTag(prop.tags)
          if (schemaRefResult) {
            // Include additional schema properties for known Canvas refs
            // (e.g., format, x-allowed-schemes, contentMediaType)
            const additionalProps = getSchemaRefProperties(schemaRefResult.shorthand)
            acc[prop.name] = buildPropDefinition(prop, {
              type: 'string',
              $ref: schemaRefResult.$ref,
              ...additionalProps,
            })
            return acc
          }

          // Check for @format JSDoc tag (e.g., @format date)
          const format = detectFormatTag(prop.tags)

          // Check for @pattern JSDoc tag (e.g., @pattern (.|\r?\n)*)
          const pattern = detectPatternTag(prop.tags)

          // Check for @allowed-schemes JSDoc tag (e.g., @allowed-schemes public)
          const allowedSchemes = detectAllowedSchemesTag(prop.tags)

          // Regular prop processing - use buildPropDefinition for base, then add extras
          const propDef = buildPropDefinition(prop, {
            'type': mapVueTypeToJsonSchema(prop.type),
            'format': format,
            'pattern': pattern,
            'x-allowed-schemes': allowedSchemes ?? undefined,
          })

          if (prop.default !== undefined) propDef.default = parseDefaultValue(prop.default)

          // Extract enum from TypeScript union types.
          // Use declaration source order when available, as vue-component-meta
          // may reorder union types (e.g., placing the default value first).
          const enumValues = extractEnumFromDeclaration(prop, component.filePath)
            ?? extractEnumFromType(prop.type)
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

      // Collect required prop names (props without ? in TypeScript and no default)
      const requiredProps = meta.props
        .filter(p => !vueInternalProps.includes(p.name))
        .filter(p => !p.name.startsWith('onVue:'))
        .filter(p => p.required)
        .map(p => p.name)

      // Extract slots
      const slots = meta.slots
        .reduce((acc, slot) => {
          acc[slot.name] = {
            title: generateTitle(slot.name),
            description: slot.description || undefined,
          }
          return acc
        }, {} as Record<string, SlotDefinition>)

      // Extract component-level metadata from JSDoc and vue-component-meta
      const componentMeta = extractComponentMeta(component.filePath, meta.description)

      // Apply overrides if present (overrides take priority over JSDoc)
      const override = options.overrides?.[component.pascalName]

      // Required props must carry an @example — canvas core (and consuming
      // tools like canvas_extjs) assume the SDC `examples` array exists for
      // required props and silently produce broken field defaults otherwise.
      // @see Drupal\canvas\Plugin\Canvas\ComponentSource\GeneratedFieldExplicitInputUxComponentSourceBase
      for (const requiredProp of requiredProps) {
        if (!props[requiredProp]?.examples?.length) {
          console.warn(`[nuxt-component-preview] Required prop "${component.pascalName}.${requiredProp}" has no @example. Canvas assumes required props always have one and silently falls back to a null value otherwise — add an @example to the prop.`)
        }
      }

      const description = override?.description || componentMeta.description
      return {
        id: component.pascalName,
        name: override?.name || componentMeta.name || generateTitle(component.pascalName),
        ...(description && { description }),
        category: override?.category || componentMeta.category || resolveCategory(options.category, component.shortPath),
        status: override?.status || componentMeta.status || options.status,
        props: {
          type: 'object',
          ...(requiredProps.length > 0 && { required: requiredProps }),
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

/**
 * Extract enum values in their original source order using vue-component-meta's
 * declaration range.
 *
 * vue-component-meta may reorder union types (e.g., placing the default value
 * first). This function uses getDeclarations() to read the original prop
 * declaration from the source file and extract values in the authored order.
 *
 * @returns The enum values in source order, or null if extraction fails
 */
function extractEnumFromDeclaration(
  prop: { getDeclarations?: () => Array<{ file: string, range: number[] }> },
  filePath: string,
): string[] | null {
  try {
    const decls = prop.getDeclarations?.()
    if (!decls?.[0]?.range) return null

    const source = readFileSync(decls[0].file || filePath, 'utf-8')
    const text = source.substring(decls[0].range[0], decls[0].range[1])

    // Extract quoted string values from the union type declaration
    const values = text.match(/['"]([^'"]+)['"]/g)
    if (values && values.length > 1) {
      return values.map(v => v.replace(/['"]/g, ''))
    }

    return null
  }
  catch {
    return null
  }
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

/**
 * Parse default value for array props.
 * Handles formats from vue-component-meta:
 * - Array literal: "[\"foo\", \"bar\"]"
 * - Factory function: "() => [\"foo\", \"bar\"]"
 */
function parseArrayDefaultValue(defaultStr: string): unknown[] | undefined {
  let arrayStr = defaultStr.trim()

  // Handle factory function: () => [...]
  const factoryMatch = arrayStr.match(/\(\)\s*=>\s*(\[[\s\S]*\])/)
  if (factoryMatch) {
    arrayStr = factoryMatch[1]
  }

  // Check if it looks like an array literal
  if (!arrayStr.startsWith('[') || !arrayStr.endsWith(']')) {
    return undefined
  }

  try {
    // Convert JS array literal to JSON
    const jsonStr = arrayStr
      .replace(/'/g, '"') // single to double quotes
      .replace(/,(\s*\])/g, '$1') // remove trailing commas
    return JSON.parse(jsonStr)
  }
  catch {
    return undefined
  }
}
