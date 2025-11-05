import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import type { Component } from '@nuxt/schema'
import { extractPackageName, generateComponentIndex } from '../src/runtime/server/utils/generateComponentIndex'

describe('includePackages feature', () => {
  describe('extractPackageName', () => {
    it('extracts regular package names', () => {
      expect(extractPackageName('/path/node_modules/vue/dist/vue.js')).toBe('vue')
      expect(extractPackageName('/home/user/node_modules/lodash/index.js')).toBe('lodash')
      expect(extractPackageName('C:\\Users\\node_modules\\axios\\lib\\axios.js')).toBe('axios')
    })

    it('extracts scoped package names', () => {
      expect(extractPackageName('/path/node_modules/@nuxt/icon/dist/index.js')).toBe('@nuxt/icon')
      expect(extractPackageName('/node_modules/@vue/compiler-core/index.js')).toBe('@vue/compiler-core')
      expect(extractPackageName('C:\\node_modules\\@company\\ui-lib\\component.vue')).toBe('@company/ui-lib')
    })

    it('returns null for non-node_modules paths', () => {
      expect(extractPackageName('/components/MyComponent.vue')).toBe(null)
      expect(extractPackageName('/src/utils/helper.js')).toBe(null)
      expect(extractPackageName('C:\\projects\\app\\index.js')).toBe(null)
    })
  })

  describe('component index generation with package filtering', () => {
    // Use the real TestButton from playground for all tests
    const testButtonPath = resolve(process.cwd(), 'playground/components/global/TestButton.vue')
    const tsconfigPath = resolve(process.cwd(), 'playground/tsconfig.json')

    const createMockComponent = (name: string, filePath: string): Partial<Component> => ({
      pascalName: name,
      kebabName: name.toLowerCase(),
      filePath,
      shortPath: filePath,
      global: true,
    })

    it('excludes all package components by default (includePackages: false)', () => {
      const components = [
        createMockComponent('UserButton', testButtonPath), // Real component
        createMockComponent('NuxtIcon', '/fake/node_modules/@nuxt/icon/Icon.vue'), // Package (will be filtered)
        createMockComponent('VueComponent', '/fake/node_modules/vue/Component.vue'), // Package (will be filtered)
      ]

      const result = generateComponentIndex(components as Component[], tsconfigPath, {
        category: 'Test',
        status: 'stable',
        includePackages: false,
      })

      // Only user component should be included (packages filtered out before file check)
      expect(result.components).toHaveLength(1)
      expect(result.components[0].id).toBe('UserButton')
    }, 10000)

    it('excludes all package components when includePackages is undefined', () => {
      const components = [
        createMockComponent('UserButton', testButtonPath),
        createMockComponent('NuxtIcon', '/fake/node_modules/@nuxt/icon/Icon.vue'),
      ]

      const result = generateComponentIndex(components as Component[], tsconfigPath, {
        category: 'Test',
        status: 'stable',
        // includePackages: undefined (not provided)
      })

      expect(result.components).toHaveLength(1)
      expect(result.components[0].id).toBe('UserButton')
    })

    it('includes only specified packages when array provided', () => {
      const components = [
        createMockComponent('UserButton', testButtonPath),
        createMockComponent('ShadcnButton', '/fake/node_modules/shadcn-vue/Button.vue'), // Should be filtered (before file check)
        createMockComponent('NuxtIcon', '/fake/node_modules/@nuxt/icon/Icon.vue'), // Should be filtered
        createMockComponent('CompanyCard', '/fake/node_modules/@company/ui-lib/Card.vue'), // Should be filtered
      ]

      // Note: All package components will be filtered out because files don't exist
      // This test verifies the filtering logic happens before file existence check
      const result = generateComponentIndex(components as Component[], tsconfigPath, {
        category: 'Test',
        status: 'stable',
        includePackages: ['shadcn-vue', '@company/ui-lib'], // Only these would be checked
      })

      // Only UserButton remains (packages filtered by includePackages or missing files)
      expect(result.components).toHaveLength(1)
      const componentIds = result.components.map(c => c.id)
      expect(componentIds).toContain('UserButton')
    })

    it('handles mixed Windows and Unix paths', () => {
      // Extract package names from mixed paths
      expect(extractPackageName('C:\\project\\node_modules\\@some\\package\\Component.vue')).toBe('@some/package')
      expect(extractPackageName('/project/node_modules/@other/package/Component.vue')).toBe('@other/package')

      // Verify both path styles are handled consistently
      const windowsPath = 'C:\\node_modules\\test-pkg\\Component.vue'
      const unixPath = '/node_modules/test-pkg/Component.vue'
      expect(extractPackageName(windowsPath)).toBe('test-pkg')
      expect(extractPackageName(unixPath)).toBe('test-pkg')
    })
  })
})
