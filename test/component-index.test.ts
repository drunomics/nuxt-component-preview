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
})
