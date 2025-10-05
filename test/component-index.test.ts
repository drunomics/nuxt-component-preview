import { describe, it, expect } from 'vitest'

// Simple structure validator (full schema validation happens on PHP side)
function validateComponentIndex(data: any) {
  const errors: string[] = []

  if (!data.version) errors.push('Missing required field: version')
  if (!Array.isArray(data.components)) errors.push('Missing or invalid field: components')

  data.components?.forEach((comp: any, idx: number) => {
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
        components: []
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
        components: [{ name: 'Test', category: 'Test' }]
      }
      const result = validateComponentIndex(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain("missing required field 'id'")
    })
  })

  describe('Step 1: Basic Generation + Metadata Extraction', () => {
    it('generates component index from mock components', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('path')

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
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Nuxt Components', status: 'stable' }
      )

      expect(result.version).toBe('1.0')
      expect(result.components).toHaveLength(1)
      expect(result.components[0].id).toBe('TestButton')
      expect(result.components[0].name).toBe('Test Button')
    })

    it('extracts prop metadata from vue-component-meta', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('path')

      const mockComponents = [{
        pascalName: 'TestButton',
        filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' }
      )

      const component = result.components[0]
      expect(component.props).toBeDefined()
      expect(component.props.type).toBe('object')
      expect(component.props.properties).toBeDefined()
      expect(component.props.properties.label).toBeDefined()
      expect(component.props.properties.label.type).toBe('string')
      expect(component.props.properties.label.description).toBeDefined()
    })
  })

  describe('Step 2: Default Category/Status + Validation', () => {
    it('applies default category and status', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('path')

      const mockComponents = [{
        pascalName: 'TestButton',
        filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'My Category', status: 'experimental' }
      )

      expect(result.components[0].category).toBe('My Category')
      expect(result.components[0].status).toBe('experimental')
    })

    it('generates valid component index that passes schema validation', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('path')

      const mockComponents = [{
        pascalName: 'TestCard',
        filePath: resolve(process.cwd(), 'playground/components/global/TestCard.vue'),
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' }
      )

      const validation = validateComponentIndex(result)
      expect(validation.valid).toBe(true)
      expect(validation.errors).toEqual([])
    })
  })

  describe('Step 3: Server Route Integration', () => {
    it('generates component-index.json in build output', async () => {
      const { readFile } = await import('fs/promises')
      const { resolve } = await import('path')

      // Check in .output/public (production) or playground/public (dev)
      let content: string
      try {
        const prodPath = resolve(process.cwd(), 'playground/.output/public/nuxt-component-preview/component-index.json')
        content = await readFile(prodPath, 'utf-8')
      } catch {
        const devPath = resolve(process.cwd(), 'playground/public/nuxt-component-preview/component-index.json')
        content = await readFile(devPath, 'utf-8')
      }

      const data = JSON.parse(content)
      expect(data.version).toBe('1.0')
      expect(Array.isArray(data.components)).toBe(true)
      expect(data.components.length).toBeGreaterThan(0)
    })
  })

  describe('Step 4: Directory Exclusions', () => {
    it('excludes components from specified directories', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('path')

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
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Test',
          status: 'stable',
          excludeDirectories: ['global/internal']
        }
      )

      expect(result.components).toHaveLength(1)
      expect(result.components[0].id).toBe('TestButton')
    })
  })

  describe('Step 5: Component Name Exclusions', () => {
    it('excludes components by name pattern', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('path')

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
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Test',
          status: 'stable',
          excludeComponents: ['*--default']
        }
      )

      expect(result.components).toHaveLength(1)
      expect(result.components[0].id).toBe('TestButton')
    })

    it('supports glob patterns for component exclusions', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('path')

      const mockComponents = [
        { pascalName: 'TestButton', kebabName: 'test-button', filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'), shortPath: 'components/global/TestButton.vue', global: true },
        { pascalName: 'TestCard', kebabName: 'test-card', filePath: resolve(process.cwd(), 'playground/components/global/TestCard.vue'), shortPath: 'components/global/TestCard.vue', global: true },
        { pascalName: 'DebugPanel', kebabName: 'debug-panel', filePath: resolve(process.cwd(), 'playground/components/global/DebugPanel.vue'), shortPath: 'components/global/DebugPanel.vue', global: true },
      ]

      const result = generateComponentIndex(
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Test',
          status: 'stable',
          excludeComponents: ['test-*', 'debug-*']
        }
      )

      expect(result.components).toHaveLength(0)
    })
  })

  describe('Step 6: Per-Component Overrides', () => {
    it('overrides category for specific component', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('path')

      const mockComponents = [
        { pascalName: 'TestButton', kebabName: 'test-button', filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'), shortPath: 'components/global/TestButton.vue', global: true },
        { pascalName: 'TestCard', kebabName: 'test-card', filePath: resolve(process.cwd(), 'playground/components/global/TestCard.vue'), shortPath: 'components/global/TestCard.vue', global: true },
      ]

      const result = generateComponentIndex(
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Default Category',
          status: 'stable',
          overrides: {
            TestButton: { category: 'Forms' }
          }
        }
      )

      expect(result.components[0].category).toBe('Forms')
      expect(result.components[0].status).toBe('stable')
      expect(result.components[1].category).toBe('Default Category')
    })

    it('overrides status for specific component', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('path')

      const mockComponents = [
        { pascalName: 'TestButton', kebabName: 'test-button', filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'), shortPath: 'components/global/TestButton.vue', global: true },
      ]

      const result = generateComponentIndex(
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        {
          category: 'Test',
          status: 'stable',
          overrides: {
            TestButton: { status: 'experimental' }
          }
        }
      )

      expect(result.components[0].status).toBe('experimental')
      expect(result.components[0].category).toBe('Test')
    })
  })

  describe('@example Tag Extraction', () => {
    it('extracts @example tags to examples field', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('path')

      const mockComponents = [{
        pascalName: 'TestButton',
        kebabName: 'test-button',
        filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
        shortPath: 'components/global/TestButton.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' }
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
      const { resolve } = await import('path')

      const mockComponents = [{
        pascalName: 'TestButton',
        kebabName: 'test-button',
        filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
        shortPath: 'components/global/TestButton.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' }
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
      const { resolve } = await import('path')

      const mockComponents = [{
        pascalName: 'TestButton',
        kebabName: 'test-button',
        filePath: resolve(process.cwd(), 'playground/components/global/TestButton.vue'),
        shortPath: 'components/global/TestButton.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' }
      )

      const variantProp = result.components[0].props.properties.variant
      expect(variantProp['meta:enum']).toBeDefined()
      expect(variantProp['meta:enum'].primary).toBe('Primary')
      expect(variantProp['meta:enum'].secondary).toBe('Secondary')
    })
  })

  describe('Slot Extraction', () => {
    it('extracts named slots from template', async () => {
      const { generateComponentIndex } = await import('../src/runtime/server/utils/generateComponentIndex')
      const { resolve } = await import('path')

      const mockComponents = [{
        pascalName: 'TwoColumnLayout',
        kebabName: 'two-column-layout',
        filePath: resolve(process.cwd(), 'playground/components/global/TwoColumnLayout.vue'),
        shortPath: 'components/global/TwoColumnLayout.vue',
        global: true,
      }]

      const result = generateComponentIndex(
        mockComponents as any,
        resolve(process.cwd(), 'playground/tsconfig.json'),
        { category: 'Test', status: 'stable' }
      )

      const component = result.components[0]
      expect(component.slots).toBeDefined()
      expect(component.slots['column-one']).toBeDefined()
      expect(component.slots['column-one'].title).toBeDefined()
      expect(component.slots['column-two']).toBeDefined()
    })
  })
})
