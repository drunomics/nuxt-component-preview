import { describe, it, expect } from 'vitest'
import type { Component } from '@nuxt/schema'

// Mock component type for tests
type MockComponent = Pick<Component, 'pascalName' | 'kebabName' | 'filePath' | 'shortPath' | 'global'>

// Simple structure validator (full schema validation happens on PHP side)

function validateComponentIndex(data: any) {
  const errors: string[] = []

  if (!data.version) errors.push('Missing required field: version')
  if (!Array.isArray(data.components)) errors.push('Missing or invalid field: components')

  data.components?.forEach((comp: { id?: string, name?: string, category?: string }, idx: number) => {
    if (!comp.id) errors.push(`Component ${idx}: missing required field 'id'`)
    if (!comp.name) errors.push(`Component ${idx}: missing required field 'name'`)
    if (!comp.category) errors.push(`Component ${idx}: missing required field 'category'`)
  })

  return { valid: errors.length === 0, errors }
}

describe('Component Index Generation', () => {
  describe('Setup: Schema Validation', () => {
    it('validates minimal valid component index', () => {
      const minimalIndex = {
        version: '1.0',
        components: [],
      }
      const result = validateComponentIndex(minimalIndex)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('rejects component index missing version', () => {
      const invalid = { components: [] }
      const result = validateComponentIndex(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing required field: version')
    })

    it('rejects component index missing components', () => {
      const invalid = { version: '1.0' }
      const result = validateComponentIndex(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing or invalid field: components')
    })

    it('rejects component missing required id', () => {
      const invalid = {
        version: '1.0',
        components: [{ name: 'Test', category: 'Test' }],
      }
      const result = validateComponentIndex(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('missing required field \'id\'')
    })
  })

  describe('Step 1: Basic Generation + Metadata Extraction', () => {
    it('generates component index from mock components', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [
        {
          pascalName: 'TestButton',
          filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
          global: true,
          kebabName: 'test-button',
          shortPath: 'components/global/TestButton.vue',
        },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Nuxt Components', status: 'stable' },
      )

      expect(result.version).toBe('1.0')
      expect(result.components).toHaveLength(1)
      expect(result.components[0].id).toBe('TestButton')
      expect(result.components[0].name).toBe('Test Button')
    }, 10000)

    it('extracts prop metadata from vue-component-meta', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestButton',
        filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const component = result.components[0]
      expect(component.props).toBeDefined()
      expect(component.props.type).toBe('object')
      expect(component.props.properties).toBeDefined()
      expect(component.props.properties.label).toBeDefined()
      expect(component.props.properties.label.type).toBe('string')
      // Title is extracted from JSDoc first line
      expect(component.props.properties.label.title).toBe('Button label text')
    }, 10000)
  })

  describe('Step 2: Default Category/Status + Validation', () => {
    it('applies default category and status', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestButton',
        filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'My Category', status: 'experimental' },
      )

      expect(result.components[0].category).toBe('My Category')
      expect(result.components[0].status).toBe('experimental')
    })

    it('generates valid component index structure', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestCard',
        filePath: resolve(process.cwd(), 'playground/components/global/TestCard.vue'),
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const validation = validateComponentIndex(result)
      expect(validation.valid).toBe(true)
      expect(validation.errors).toEqual([])
    })
  })

  // Step 3 removed - virtual route serving verified via browser tests

  describe('Step 4: Directory Exclusions', () => {
    it('excludes components from specified directories', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [
        {
          pascalName: 'TestButton',
          filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
          shortPath: 'components/global/TestButton.vue',
          kebabName: 'test-button',
          global: true,
        },
        {
          pascalName: 'InternalComponent',
          filePath: resolve(process.cwd(), 'playground/components/global/internal/InternalComponent.vue'),
          shortPath: 'components/global/internal/InternalComponent.vue',
          kebabName: 'internal-component',
          global: true,
        },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Test',
          status: 'stable',
          excludeDirectories: ['global/internal'],
        },
      )

      expect(result.components).toHaveLength(1)
      expect(result.components[0].id).toBe('TestButton')
    })
  })

  describe('Step 5: Component Name Exclusions', () => {
    it('excludes components by name pattern', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [
        {
          pascalName: 'TestButton',
          kebabName: 'test-button',
          filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
          shortPath: 'components/global/TestButton.vue',
          global: true,
        },
        {
          pascalName: 'NodeDefault',
          kebabName: 'node--default',
          filePath: resolve(process.cwd(), 'playground/components/global/node--default.vue'),
          shortPath: 'components/global/node--default.vue',
          global: true,
        },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Test',
          status: 'stable',
          excludeComponents: ['*--default'],
        },
      )

      expect(result.components).toHaveLength(1)
      expect(result.components[0].id).toBe('TestButton')
    })

    it('supports glob patterns for component exclusions', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [
        { pascalName: 'TestButton', kebabName: 'test-button', filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'), shortPath: 'components/global/TestButton.vue', global: true },
        { pascalName: 'TestCard', kebabName: 'test-card', filePath: resolve(process.cwd(), 'playground/components/global/TestCard.vue'), shortPath: 'components/global/TestCard.vue', global: true },
        { pascalName: 'DebugPanel', kebabName: 'debug-panel', filePath: resolve(process.cwd(), 'playground/components/global/DebugPanel.vue'), shortPath: 'components/global/DebugPanel.vue', global: true },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Test',
          status: 'stable',
          excludeComponents: ['test-*', 'debug-*'],
        },
      )

      expect(result.components).toHaveLength(0)
    })
  })

  describe('Step 6: Per-Component Overrides', () => {
    it('overrides category for specific component', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [
        { pascalName: 'TestButton', kebabName: 'test-button', filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'), shortPath: 'components/global/TestButton.vue', global: true },
        { pascalName: 'TestCard', kebabName: 'test-card', filePath: resolve(process.cwd(), 'playground/components/global/TestCard.vue'), shortPath: 'components/global/TestCard.vue', global: true },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Default Category',
          status: 'stable',
          overrides: {
            TestButton: { category: 'Forms' },
          },
        },
      )

      expect(result.components[0].category).toBe('Forms')
      expect(result.components[0].status).toBe('stable')
      expect(result.components[1].category).toBe('Default Category')
    })

    it('overrides status for specific component', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [
        { pascalName: 'TestButton', kebabName: 'test-button', filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'), shortPath: 'components/global/TestButton.vue', global: true },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Test',
          status: 'stable',
          overrides: {
            TestButton: { status: 'experimental' },
          },
        },
      )

      expect(result.components[0].status).toBe('experimental')
      expect(result.components[0].category).toBe('Test')
    })
  })

  describe('@example Tag Extraction', () => {
    it('extracts @example tags to examples field', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestButton',
        kebabName: 'test-button',
        filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
        shortPath: 'components/global/TestButton.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const labelProp = result.components[0].props.properties.label
      expect(labelProp.examples).toEqual(['Submit', 'Cancel', 'Learn More'])

      const variantProp = result.components[0].props.properties.variant
      expect(variantProp.examples).toEqual(['primary', 'success'])
    })
  })

  describe('Enum Extraction from TypeScript Unions', () => {
    it('extracts enum values from TypeScript union types', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestButton',
        kebabName: 'test-button',
        filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
        shortPath: 'components/global/TestButton.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const variantProp = result.components[0].props.properties.variant
      expect(variantProp.enum).toBeDefined()
      expect(variantProp.enum).toContain('primary')
      expect(variantProp.enum).toContain('secondary')
      expect(variantProp.enum).toContain('success')
      expect(variantProp.enum).toContain('danger')
      expect(variantProp.type).toBe('string')
    })

    it('generates meta:enum for enum values', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestButton',
        kebabName: 'test-button',
        filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
        shortPath: 'components/global/TestButton.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const variantProp = result.components[0].props.properties.variant
      expect(variantProp['meta:enum']).toBeDefined()
      expect(variantProp['meta:enum'].primary).toBe('Primary')
      expect(variantProp['meta:enum'].secondary).toBe('Secondary')
    })

    it('uses custom @enumLabels from JSDoc', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TwoColumnLayout',
        kebabName: 'two-column-layout',
        filePath: resolve(process.cwd(), 'playground/components/global/TwoColumnLayout.vue'),
        shortPath: 'components/global/TwoColumnLayout.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const widthProp = result.components[0].props.properties.width
      expect(widthProp['meta:enum']).toBeDefined()
      expect(widthProp['meta:enum']['25']).toBe('25% / 75%')
      expect(widthProp['meta:enum']['50']).toBe('50% / 50%')
      expect(widthProp['meta:enum']['75']).toBe('75% / 25%')
    })

    it('supports partial @enumLabels (only some values labeled)', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestButton',
        kebabName: 'test-button',
        filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
        shortPath: 'components/global/TestButton.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const sizeProp = result.components[0].props.properties.size
      expect(sizeProp['meta:enum']).toBeDefined()
      expect(sizeProp['meta:enum'].large).toBe('Extra Large (XL)')
      // Partial labels: other values not specified in @enumLabels
      expect(sizeProp['meta:enum'].small).toBeUndefined()
      expect(sizeProp['meta:enum'].medium).toBeUndefined()
    })
  })

  describe('Slot Extraction', () => {
    it('extracts named slots from template', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TwoColumnLayout',
        kebabName: 'two-column-layout',
        filePath: resolve(process.cwd(), 'playground/components/global/TwoColumnLayout.vue'),
        shortPath: 'components/global/TwoColumnLayout.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const component = result.components[0]
      expect(component.slots).toBeDefined()
      expect(Object.keys(component.slots)).toHaveLength(2)
      expect(component.slots['column-one']).toBeDefined()
      expect(component.slots['column-one'].title).toBeDefined()
      expect(component.slots['column-two']).toBeDefined()
      expect(component.slots.default).toBeUndefined()
    })

    it('extracts default slot from component', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestPopover',
        kebabName: 'test-popover',
        filePath: resolve(process.cwd(), 'playground/components/global/TestPopover.vue'),
        shortPath: 'components/global/TestPopover.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const component = result.components[0]
      expect(component.slots).toBeDefined()
      expect(component.slots.default).toBeDefined()
      expect(component.slots.default.title).toBe('Default')
      expect(component.slots.trigger).toBeDefined()
      expect(component.slots.trigger.title).toBe('Trigger')
    })
  })

  describe('Canvas Type Detection', () => {
    it('generates Canvas-compatible schema for CanvasImage props', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestHero',
        kebabName: 'test-hero',
        filePath: resolve(process.cwd(), 'playground/components/global/TestHero.vue'),
        shortPath: 'components/global/TestHero.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const imageProp = result.components[0].props.properties.image

      // Validate Canvas schema format
      expect(imageProp.type).toBe('object')
      expect(imageProp['$ref']).toBe('json-schema-definitions://canvas.module/image')
      // Title is extracted from JSDoc first line
      expect(imageProp.title).toBe('Hero image')
    }, 10000)

    it('extracts @example JSON for CanvasImage props', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestHero',
        kebabName: 'test-hero',
        filePath: resolve(process.cwd(), 'playground/components/global/TestHero.vue'),
        shortPath: 'components/global/TestHero.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const imageProp = result.components[0].props.properties.image

      expect(imageProp.examples).toBeDefined()
      expect(imageProp.examples).toHaveLength(1)
      expect(imageProp.examples![0]).toMatchObject({
        src: 'https://placehold.co/800x600',
        alt: 'Example image',
        width: 800,
        height: 600,
      })
    }, 10000)

    it('validates CanvasImage examples match Canvas schema structure', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')
      const canvasSchema = await import('../schema/canvas.schema.json')

      const mockComponents = [{
        pascalName: 'TestHero',
        kebabName: 'test-hero',
        filePath: resolve(process.cwd(), 'playground/components/global/TestHero.vue'),
        shortPath: 'components/global/TestHero.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const imageProp = result.components[0].props.properties.image
      const canvasImageDef = canvasSchema.$defs.image

      // Verify the prop has correct Canvas $ref
      expect(imageProp['$ref']).toBe('json-schema-definitions://canvas.module/image')

      // Verify examples match Canvas image structure (has required 'src' and optional alt, width, height)
      imageProp.examples.forEach((example: Record<string, unknown>) => {
        // 'src' is required per Canvas schema
        expect(example).toHaveProperty('src')
        expect(typeof example.src).toBe('string')

        // Verify structure matches Canvas image $defs
        const canvasImageProps = Object.keys(canvasImageDef.properties)
        Object.keys(example).forEach((key) => {
          expect(canvasImageProps).toContain(key)
        })
      })
    }, 10000)

    it('parses @example with key-value syntax', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestBanner',
        kebabName: 'test-banner',
        filePath: resolve(process.cwd(), 'playground/components/global/TestBanner.vue'),
        shortPath: 'components/global/TestBanner.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const imageProp = result.components[0].props.properties.image

      // Should have $ref for Canvas type
      expect(imageProp['$ref']).toBe('json-schema-definitions://canvas.module/image')

      // Should parse key-value @example into object
      expect(imageProp.examples).toBeDefined()
      expect(imageProp.examples).toHaveLength(1)
      expect(imageProp.examples![0]).toMatchObject({
        src: 'https://placehold.co/600x400',
        alt: 'Banner image',
        width: 600,
        height: 400,
      })
    }, 10000)

    it('parses numbers and booleans in key-value syntax', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestBanner',
        kebabName: 'test-banner',
        filePath: resolve(process.cwd(), 'playground/components/global/TestBanner.vue'),
        shortPath: 'components/global/TestBanner.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const imageProp = result.components[0].props.properties.image

      // Numbers should be parsed as numbers, not strings
      expect(typeof imageProp.examples![0].width).toBe('number')
      expect(typeof imageProp.examples![0].height).toBe('number')
      expect(imageProp.examples![0].width).toBe(600)
      expect(imageProp.examples![0].height).toBe(400)
    }, 10000)

    it('does not add $ref for regular object props', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      // TestCard has regular string props, not Canvas types
      const mockComponents = [{
        pascalName: 'TestCard',
        kebabName: 'test-card',
        filePath: resolve(process.cwd(), 'playground/components/global/TestCard.vue'),
        shortPath: 'components/global/TestCard.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      // Regular string props should not have $ref
      const titleProp = result.components[0].props.properties.title
      expect(titleProp['$ref']).toBeUndefined()
      expect(titleProp.type).toBe('string')
    }, 10000)
  })

  describe('Formatted Text Detection', () => {
    it('detects @contentMediaType text/html and defaults to block context', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestArticle',
        kebabName: 'test-article',
        filePath: resolve(process.cwd(), 'playground/components/global/TestArticle.vue'),
        shortPath: 'components/global/TestArticle.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      // content prop has @contentMediaType but no @formattingContext, should default to block
      const contentProp = result.components[0].props.properties.content

      expect(contentProp.type).toBe('string')
      expect(contentProp.contentMediaType).toBe('text/html')
      expect(contentProp['x-formatting-context']).toBe('block')
    }, 10000)

    it('respects @formattingContext inline when specified', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestArticle',
        kebabName: 'test-article',
        filePath: resolve(process.cwd(), 'playground/components/global/TestArticle.vue'),
        shortPath: 'components/global/TestArticle.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      // summary prop has @formattingContext inline
      const summaryProp = result.components[0].props.properties.summary

      expect(summaryProp.type).toBe('string')
      expect(summaryProp.contentMediaType).toBe('text/html')
      expect(summaryProp['x-formatting-context']).toBe('inline')
    }, 10000)

    it('extracts @example tags for formatted text props', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestArticle',
        kebabName: 'test-article',
        filePath: resolve(process.cwd(), 'playground/components/global/TestArticle.vue'),
        shortPath: 'components/global/TestArticle.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const summaryProp = result.components[0].props.properties.summary
      const contentProp = result.components[0].props.properties.content

      expect(summaryProp.examples).toBeDefined()
      expect(summaryProp.examples).toHaveLength(1)
      expect(summaryProp.examples![0]).toBe('This is <strong>important</strong> news')

      expect(contentProp.examples).toBeDefined()
      expect(contentProp.examples).toHaveLength(1)
      expect(contentProp.examples![0]).toContain('<p>First paragraph')
    }, 10000)

    it('does not add contentMediaType for regular string props', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestArticle',
        kebabName: 'test-article',
        filePath: resolve(process.cwd(), 'playground/components/global/TestArticle.vue'),
        shortPath: 'components/global/TestArticle.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      // title prop is a regular string, no @contentMediaType
      const titleProp = result.components[0].props.properties.title

      expect(titleProp.type).toBe('string')
      expect(titleProp.contentMediaType).toBeUndefined()
      expect(titleProp['x-formatting-context']).toBeUndefined()
    }, 10000)
  })

  describe('Prop Title Extraction from JSDoc', () => {
    it('uses @title tag when present', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestPropTitles',
        kebabName: 'test-prop-titles',
        filePath: resolve(process.cwd(), 'playground/components/global/TestPropTitles.vue'),
        shortPath: 'components/global/TestPropTitles.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const explicitTitleProp = result.components[0].props.properties.explicitTitle

      expect(explicitTitleProp.title).toBe('Custom Title Override')
      // @title doesn't affect description - it stays as-is
      expect(explicitTitleProp.description).toBe('Description for this prop')
    }, 10000)

    it('extracts title from first line of description', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestPropTitles',
        kebabName: 'test-prop-titles',
        filePath: resolve(process.cwd(), 'playground/components/global/TestPropTitles.vue'),
        shortPath: 'components/global/TestPropTitles.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const inferredTitleProp = result.components[0].props.properties.inferredTitle

      expect(inferredTitleProp.title).toBe('Short JSDoc summary')
    }, 10000)

    it('removes first line and empty separator from description', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestPropTitles',
        kebabName: 'test-prop-titles',
        filePath: resolve(process.cwd(), 'playground/components/global/TestPropTitles.vue'),
        shortPath: 'components/global/TestPropTitles.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const inferredTitleProp = result.components[0].props.properties.inferredTitle

      // Description should be remaining text after title and empty line
      expect(inferredTitleProp.description).toContain('This is the longer description')
      expect(inferredTitleProp.description).toContain('spans multiple lines')
      // Should not start with empty line or contain the title
      expect(inferredTitleProp.description).not.toContain('Short JSDoc summary')
    }, 10000)

    it('falls back to name-based title for long descriptions', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestPropTitles',
        kebabName: 'test-prop-titles',
        filePath: resolve(process.cwd(), 'playground/components/global/TestPropTitles.vue'),
        shortPath: 'components/global/TestPropTitles.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const fallbackTitleProp = result.components[0].props.properties.fallbackTitle

      // First line is > 50 chars, should fall back to name-based title
      expect(fallbackTitleProp.title).toBe('Fallback Title')
      // Description should remain intact
      expect(fallbackTitleProp.description).toContain('way too long')
    }, 10000)

    it('handles single-line JSDoc without separator', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestPropTitles',
        kebabName: 'test-prop-titles',
        filePath: resolve(process.cwd(), 'playground/components/global/TestPropTitles.vue'),
        shortPath: 'components/global/TestPropTitles.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const singleLineProp = result.components[0].props.properties.singleLine

      // Single line becomes title, no description remains
      expect(singleLineProp.title).toBe('Single line title')
      expect(singleLineProp.description).toBeUndefined()
    }, 10000)

    it('handles props without JSDoc', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestPropTitles',
        kebabName: 'test-prop-titles',
        filePath: resolve(process.cwd(), 'playground/components/global/TestPropTitles.vue'),
        shortPath: 'components/global/TestPropTitles.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const noJsDocProp = result.components[0].props.properties.noJsDoc

      // Falls back to name-based title
      expect(noJsDocProp.title).toBe('No Js Doc')
      expect(noJsDocProp.description).toBeUndefined()
    }, 10000)
  })

  describe('@schemaRef JSDoc Tag', () => {
    // Note: stream-wrapper-uri is tested via fixture component because Canvas
    // doesn't yet fully support non-image stream wrapper URIs (falls back to Link field)
    it('generates $ref for @schemaRef canvas/stream-wrapper-uri', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      // Use test fixture that includes all schema ref types
      const mockComponents = [{
        pascalName: 'TestSchemaRefAll',
        kebabName: 'test-schema-ref-all',
        filePath: resolve(process.cwd(), 'playground/components/global/TestSchemaRefFile.vue'),
        shortPath: 'components/global/TestSchemaRefFile.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const fileUriProp = result.components[0].props.properties.fileUri

      expect(fileUriProp.type).toBe('string')
      expect(fileUriProp['$ref']).toBe('json-schema-definitions://canvas.module/stream-wrapper-uri')
      expect(fileUriProp.title).toBe('File URI')
      expect(fileUriProp.description).toBe('A file stored in Drupal\'s public files directory.')
      // Verify additional schema properties are included for Canvas field type determination
      expect(fileUriProp.format).toBe('uri')
      expect(fileUriProp['x-allowed-schemes']).toEqual(['public'])
    }, 10000)

    it('generates $ref for @schemaRef canvas/stream-wrapper-image-uri', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestStreamWrapper',
        kebabName: 'test-stream-wrapper',
        filePath: resolve(process.cwd(), 'playground/components/global/TestStreamWrapper.vue'),
        shortPath: 'components/global/TestStreamWrapper.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const imageUriProp = result.components[0].props.properties.imageUri

      expect(imageUriProp.type).toBe('string')
      expect(imageUriProp['$ref']).toBe('json-schema-definitions://canvas.module/stream-wrapper-image-uri')
      expect(imageUriProp.title).toBe('Image URI')
      // Verify additional schema properties are included for Canvas field type determination
      expect(imageUriProp.format).toBe('uri')
      expect(imageUriProp.contentMediaType).toBe('image/*')
      expect(imageUriProp['x-allowed-schemes']).toEqual(['public'])
    }, 10000)

    it('generates $ref for @schemaRef canvas/image-uri', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestStreamWrapper',
        kebabName: 'test-stream-wrapper',
        filePath: resolve(process.cwd(), 'playground/components/global/TestStreamWrapper.vue'),
        shortPath: 'components/global/TestStreamWrapper.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const webImageUrlProp = result.components[0].props.properties.webImageUrl

      expect(webImageUrlProp.type).toBe('string')
      expect(webImageUrlProp['$ref']).toBe('json-schema-definitions://canvas.module/image-uri')
      expect(webImageUrlProp.title).toBe('Web image URL')
      // Verify additional schema properties are included for Canvas field type determination
      expect(webImageUrlProp.format).toBe('uri-reference')
      expect(webImageUrlProp.contentMediaType).toBe('image/*')
      expect(webImageUrlProp['x-allowed-schemes']).toEqual(['http', 'https'])
    }, 10000)

    it('extracts @example for @schemaRef props', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      // Use test fixture that includes all schema ref types including fileUri
      const mockComponents = [{
        pascalName: 'TestSchemaRefAll',
        kebabName: 'test-schema-ref-all',
        filePath: resolve(process.cwd(), 'playground/components/global/TestSchemaRefFile.vue'),
        shortPath: 'components/global/TestSchemaRefFile.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const fileUriProp = result.components[0].props.properties.fileUri
      const imageUriProp = result.components[0].props.properties.imageUri

      expect(fileUriProp.examples).toContain('public://documents/report.pdf')
      expect(imageUriProp.examples).toContain('public://images/hero.jpg')
    }, 10000)

    it('does not add $ref for props without @schemaRef', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestStreamWrapper',
        kebabName: 'test-stream-wrapper',
        filePath: resolve(process.cwd(), 'playground/components/global/TestStreamWrapper.vue'),
        shortPath: 'components/global/TestStreamWrapper.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      // caption is a regular string prop without @schemaRef
      const captionProp = result.components[0].props.properties.caption

      expect(captionProp.type).toBe('string')
      expect(captionProp['$ref']).toBeUndefined()
      expect(captionProp.title).toBe('Regular text')
    }, 10000)
  })

  describe('@format and @pattern JSDoc Tags', () => {
    it('generates format for @format tag', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestFormatPattern',
        kebabName: 'test-format-pattern',
        filePath: resolve(process.cwd(), 'playground/components/global/TestFormatPattern.vue'),
        shortPath: 'components/global/TestFormatPattern.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const eventDateProp = result.components[0].props.properties.eventDate
      const titleProp = result.components[0].props.properties.title

      // @format date generates format property
      expect(eventDateProp.type).toBe('string')
      expect(eventDateProp.format).toBe('date')
      expect(eventDateProp.title).toBe('Event date')

      // Props without @format have no format property
      expect(titleProp.format).toBeUndefined()
    }, 10000)

    it('generates pattern for @pattern tag', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestFormatPattern',
        kebabName: 'test-format-pattern',
        filePath: resolve(process.cwd(), 'playground/components/global/TestFormatPattern.vue'),
        shortPath: 'components/global/TestFormatPattern.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const descriptionProp = result.components[0].props.properties.description
      const titleProp = result.components[0].props.properties.title

      // @pattern generates pattern property (textarea pattern for multiline)
      expect(descriptionProp.type).toBe('string')
      // Note: backslashes must be escaped in JS strings
      expect(descriptionProp.pattern).toBe('(.|\\r?\\n)*')
      expect(descriptionProp.title).toBe('Description')

      // Props without @pattern have no pattern property
      expect(titleProp.pattern).toBeUndefined()
    }, 10000)

    it('generates x-allowed-schemes for @allowed-schemes tag', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestFormatPattern',
        kebabName: 'test-format-pattern',
        filePath: resolve(process.cwd(), 'playground/components/global/TestFormatPattern.vue'),
        shortPath: 'components/global/TestFormatPattern.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const fileUrlProp = result.components[0].props.properties.fileUrl
      const titleProp = result.components[0].props.properties.title

      // @allowed-schemes generates x-allowed-schemes property
      expect(fileUrlProp.type).toBe('string')
      expect(fileUrlProp.format).toBe('uri')
      expect(fileUrlProp['x-allowed-schemes']).toEqual(['http', 'https'])
      expect(fileUrlProp.title).toBe('File URL')

      // Props without @allowed-schemes have no x-allowed-schemes property
      expect(titleProp['x-allowed-schemes']).toBeUndefined()
    }, 10000)
  })

  describe('Array Type Support', () => {
    it('extracts string array type with items schema', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestArrayTypes',
        kebabName: 'test-array-types',
        filePath: resolve(process.cwd(), 'playground/components/global/TestArrayTypes.vue'),
        shortPath: 'components/global/TestArrayTypes.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const tagsProp = result.components[0].props.properties.tags

      expect(tagsProp.type).toBe('array')
      expect(tagsProp.items).toEqual({ type: 'string' })
      expect(tagsProp.title).toBe('List of tags')
    }, 10000)

    it('extracts number array type', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestArrayTypes',
        kebabName: 'test-array-types',
        filePath: resolve(process.cwd(), 'playground/components/global/TestArrayTypes.vue'),
        shortPath: 'components/global/TestArrayTypes.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const numbersProp = result.components[0].props.properties.numbers

      expect(numbersProp.type).toBe('array')
      expect(numbersProp.items).toEqual({ type: 'number' })
    }, 10000)

    it('extracts @maxItems constraint', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestArrayTypes',
        kebabName: 'test-array-types',
        filePath: resolve(process.cwd(), 'playground/components/global/TestArrayTypes.vue'),
        shortPath: 'components/global/TestArrayTypes.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const tagsProp = result.components[0].props.properties.tags
      const numbersProp = result.components[0].props.properties.numbers

      // tags has @maxItems 10
      expect(tagsProp.maxItems).toBe(10)

      // numbers has no @maxItems
      expect(numbersProp.maxItems).toBeUndefined()
    }, 10000)

    it('extracts array examples', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestArrayTypes',
        kebabName: 'test-array-types',
        filePath: resolve(process.cwd(), 'playground/components/global/TestArrayTypes.vue'),
        shortPath: 'components/global/TestArrayTypes.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const tagsProp = result.components[0].props.properties.tags

      expect(tagsProp.examples).toBeDefined()
      expect(tagsProp.examples).toHaveLength(1)
      expect(tagsProp.examples![0]).toEqual(['foo', 'bar', 'baz'])
    }, 10000)

    it('extracts array default value', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestArrayTypes',
        kebabName: 'test-array-types',
        filePath: resolve(process.cwd(), 'playground/components/global/TestArrayTypes.vue'),
        shortPath: 'components/global/TestArrayTypes.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const tagsProp = result.components[0].props.properties.tags

      expect(tagsProp.default).toEqual(['default-tag'])
    }, 10000)

    it('extracts CanvasImage array with $ref in items', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [{
        pascalName: 'TestArrayTypes',
        kebabName: 'test-array-types',
        filePath: resolve(process.cwd(), 'playground/components/global/TestArrayTypes.vue'),
        shortPath: 'components/global/TestArrayTypes.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' },
      )

      const imagesProp = result.components[0].props.properties.images

      expect(imagesProp.type).toBe('array')
      expect(imagesProp.items).toEqual({
        type: 'object',
        $ref: 'json-schema-definitions://canvas.module/image',
      })
      expect(imagesProp.maxItems).toBe(20)
    }, 10000)
  })
})
