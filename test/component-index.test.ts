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

    it('preserves enum value ordering from TypeScript union types', async () => {
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

      // size is defined as 'small' | 'medium' | 'large' with default 'medium'
      // The enum order must match the TypeScript union type, not be reordered
      // by the default value.
      expect(component.props.properties.size.enum).toEqual(['small', 'medium', 'large'])

      // variant is defined as 'primary' | 'secondary' | 'danger' | 'success'
      // with default 'primary' - order must be preserved.
      expect(component.props.properties.variant.enum).toEqual(['primary', 'secondary', 'danger', 'success'])
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

  describe('Directory Inclusions', () => {
    it('includes only components from specified directories', async () => {
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
          pascalName: 'CanvasHero',
          filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
          shortPath: 'components/Canvas/Hero/CanvasHero.vue',
          kebabName: 'canvas-hero',
          global: true,
        },
        {
          pascalName: 'CanvasCard',
          filePath: resolve(process.cwd(), 'playground/components/global/TestCard.vue'),
          shortPath: 'components/Canvas/Base/CanvasCard.vue',
          kebabName: 'canvas-card',
          global: true,
        },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Test',
          status: 'stable',
          includeDirectories: ['Canvas'],
        },
      )

      expect(result.components).toHaveLength(2)
      expect(result.components.map(c => c.id)).toEqual(['CanvasHero', 'CanvasCard'])
    }, 10000)

    it('does not filter when includeDirectories is empty', async () => {
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
          pascalName: 'TestCard',
          filePath: resolve(process.cwd(), 'playground/components/global/TestCard.vue'),
          shortPath: 'components/global/TestCard.vue',
          kebabName: 'test-card',
          global: true,
        },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Test',
          status: 'stable',
          includeDirectories: [],
        },
      )

      expect(result.components).toHaveLength(2)
    }, 10000)

    it('works together with excludeDirectories', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [
        {
          pascalName: 'CanvasHero',
          filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
          shortPath: 'components/Canvas/Hero/CanvasHero.vue',
          kebabName: 'canvas-hero',
          global: true,
        },
        {
          pascalName: 'CanvasInternal',
          filePath: resolve(process.cwd(), 'playground/components/global/TestCard.vue'),
          shortPath: 'components/Canvas/Internal/CanvasInternal.vue',
          kebabName: 'canvas-internal',
          global: true,
        },
        {
          pascalName: 'MarketingBanner',
          filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
          shortPath: 'components/Marketing/Banner/MarketingBanner.vue',
          kebabName: 'marketing-banner',
          global: true,
        },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Test',
          status: 'stable',
          includeDirectories: ['Canvas'],
          excludeDirectories: ['Canvas/Internal'],
        },
      )

      expect(result.components).toHaveLength(1)
      expect(result.components[0].id).toBe('CanvasHero')
    }, 10000)

    it('matches components from package layers (deep shortPath)', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [
        {
          pascalName: 'BaseHeading',
          filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
          shortPath: 'packages/my-kickstart-components/components/Canvas/Base/base-heading.vue',
          kebabName: 'base-heading',
          global: true,
        },
        {
          pascalName: 'MarketingHero',
          filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
          shortPath: 'packages/my-kickstart-components/components/Marketing/marketing-hero.vue',
          kebabName: 'marketing-hero',
          global: true,
        },
        {
          pascalName: 'AppLocalCanvas',
          filePath: resolve(process.cwd(), 'playground/components/global/TestCard.vue'),
          shortPath: 'components/Canvas/Card/app-card.vue',
          kebabName: 'app-card',
          global: true,
        },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Test',
          status: 'stable',
          includeDirectories: ['Canvas'],
        },
      )

      // Both package-layer and app-level Canvas components included
      expect(result.components).toHaveLength(2)
      const ids = result.components.map((c: { id: string }) => c.id)
      expect(ids).toContain('BaseHeading')
      expect(ids).toContain('AppLocalCanvas')
      expect(ids).not.toContain('MarketingHero')
    }, 10000)
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

  describe('resolveCategory', () => {
    it('returns static string as-is', async () => {
      const { resolveCategory } = await import('../src/runtime/server/utils/generateComponentIndex')
      expect(resolveCategory('My Category', 'components/global/TestButton.vue')).toBe('My Category')
    })

    it('extracts category from parent folder', async () => {
      const { resolveCategory } = await import('../src/runtime/server/utils/generateComponentIndex')
      expect(resolveCategory({ directory: true }, 'components/Canvas/Base/base-button.vue')).toBe('Base')
      expect(resolveCategory({ directory: true }, 'components/Canvas/Layout/layout-section.vue')).toBe('Layout')
      expect(resolveCategory({ directory: true }, 'components/Canvas/Hero/hero-cta.vue')).toBe('Hero')
    })

    it('falls back to root folder when no subfolder', async () => {
      const { resolveCategory } = await import('../src/runtime/server/utils/generateComponentIndex')
      expect(resolveCategory({ directory: true }, 'components/Canvas/some-util.vue')).toBe('Canvas')
      expect(resolveCategory({ directory: true }, 'components/global/MyButton.vue')).toBe('global')
    })

    it('uses explicit fallback over root folder', async () => {
      const { resolveCategory } = await import('../src/runtime/server/utils/generateComponentIndex')
      expect(resolveCategory({ directory: true, fallback: 'Misc' }, 'components/Canvas/some-util.vue')).toBe('Misc')
    })

    it('falls back to Components for flat paths', async () => {
      const { resolveCategory } = await import('../src/runtime/server/utils/generateComponentIndex')
      expect(resolveCategory({ directory: true }, 'MyButton.vue')).toBe('Components')
    })
  })

  describe('category: { directory: true } integration', () => {
    it('assigns category from directory in generateComponentIndex', async () => {
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
          pascalName: 'SubfolderExample',
          kebabName: 'subfolder-example',
          filePath: resolve(process.cwd(), 'playground/components/global/Subfolder/Example.vue'),
          shortPath: 'components/global/Subfolder/Example.vue',
          global: true,
        },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: { directory: true }, status: 'stable' },
      )

      // TestButton is in components/global/ (no subfolder) → falls back to "global"
      const button = result.components.find(c => c.id === 'TestButton')
      expect(button?.category).toBe('global')

      // SubfolderExample is in components/global/Subfolder/ → "Subfolder"
      const example = result.components.find(c => c.id === 'SubfolderExample')
      expect(example?.category).toBe('Subfolder')
    }, 10000)

    it('overrides still take priority over directory category', async () => {
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
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: { directory: true },
          status: 'stable',
          overrides: {
            TestButton: { category: 'Custom Override' },
          },
        },
      )

      expect(result.components[0].category).toBe('Custom Override')
    }, 10000)
  })

  describe('extractComponentMeta', () => {
    it('extracts name, description, and category from script setup JSDoc', async () => {
      const { extractComponentMeta } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const meta = extractComponentMeta(
        resolve(process.cwd(), 'playground/components/global/TestHero.vue'),
      )

      expect(meta.name).toBe('Test Hero')
      expect(meta.description).toBe('A hero section with title, description, and background image.')
      expect(meta.category).toBe('Hero')
      expect(meta.status).toBe('experimental')
    })

    it('returns empty meta when no component JSDoc', async () => {
      const { extractComponentMeta } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const meta = extractComponentMeta(
        resolve(process.cwd(), 'playground/components/global/TestCard.vue'),
      )

      expect(meta.name).toBeUndefined()
      expect(meta.description).toBeUndefined()
      expect(meta.category).toBeUndefined()
    })

    it('prefers vue-component-meta description when available', async () => {
      const { extractComponentMeta } = await import('../src/runtime/server/utils/generateComponentIndex')

      const meta = extractComponentMeta(
        '/nonexistent.vue',
        'Custom Name\n\nA description from export default.',
      )

      expect(meta.name).toBe('Custom Name')
      expect(meta.description).toBe('A description from export default.')
    })
  })

  describe('component metadata integration', () => {
    it('uses JSDoc name and description in component index', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [
        {
          pascalName: 'TestHero',
          kebabName: 'test-hero',
          filePath: resolve(process.cwd(), 'playground/components/global/TestHero.vue'),
          shortPath: 'components/global/TestHero.vue',
          global: true,
        },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Default', status: 'stable' },
      )

      const hero = result.components[0]
      expect(hero.name).toBe('Test Hero')
      expect(hero.description).toBe('A hero section with title, description, and background image.')
      expect(hero.category).toBe('Hero')
      expect(hero.status).toBe('experimental')
    }, 10000)

    it('override takes priority over JSDoc', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [
        {
          pascalName: 'TestHero',
          kebabName: 'test-hero',
          filePath: resolve(process.cwd(), 'playground/components/global/TestHero.vue'),
          shortPath: 'components/global/TestHero.vue',
          global: true,
        },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Default',
          status: 'stable',
          overrides: {
            TestHero: { name: 'Override Name', description: 'Override desc', category: 'Override Cat' },
          },
        },
      )

      const hero = result.components[0]
      expect(hero.name).toBe('Override Name')
      expect(hero.description).toBe('Override desc')
      expect(hero.category).toBe('Override Cat')
    }, 10000)

    it('falls back to generated name when no JSDoc', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('node:path')

      const mockComponents = [
        {
          pascalName: 'TestCard',
          kebabName: 'test-card',
          filePath: resolve(process.cwd(), 'playground/components/global/TestCard.vue'),
          shortPath: 'components/global/TestCard.vue',
          global: true,
        },
      ]

      const result = generateComponentIndex(
        mockComponents as MockComponent[],
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Default', status: 'stable' },
      )

      const card = result.components[0]
      expect(card.name).toBe('Test Card')
      expect(card.description).toBeUndefined()
      expect(card.category).toBe('Default')
    }, 10000)
  })
})
