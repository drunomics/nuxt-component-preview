import { describe, it, expect } from 'vitest'
import { extractPackageName } from '../src/runtime/server/utils/generateComponentIndex'

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

  describe('filtering logic', () => {
    const mockFilter = (filePath: string, includePackages: boolean | string[] | undefined) => {
      const isInNodeModules = filePath.includes('/node_modules/') || filePath.includes('\\node_modules\\')
      if (isInNodeModules) {
        // Default: exclude all packages (includePackages === false or undefined)
        if (includePackages === false || includePackages === undefined) {
          return false
        }

        // If includePackages is an array, only include packages in that list
        if (Array.isArray(includePackages)) {
          const packageName = extractPackageName(filePath)
          if (!packageName || !includePackages.includes(packageName)) {
            return false
          }
        }
        // If includePackages === true, include all packages (no filtering)
      }
      return true
    }

    it('excludes all packages by default (false)', () => {
      expect(mockFilter('/node_modules/@nuxt/icon/index.js', false)).toBe(false)
      expect(mockFilter('/node_modules/vue/dist/vue.js', false)).toBe(false)
      expect(mockFilter('/components/MyComponent.vue', false)).toBe(true)
    })

    it('excludes all packages when undefined', () => {
      expect(mockFilter('/node_modules/@nuxt/icon/index.js', undefined)).toBe(false)
      expect(mockFilter('/node_modules/vue/dist/vue.js', undefined)).toBe(false)
      expect(mockFilter('/components/MyComponent.vue', undefined)).toBe(true)
    })

    it('includes all packages when true', () => {
      expect(mockFilter('/node_modules/@nuxt/icon/index.js', true)).toBe(true)
      expect(mockFilter('/node_modules/vue/dist/vue.js', true)).toBe(true)
      expect(mockFilter('/components/MyComponent.vue', true)).toBe(true)
    })

    it('includes only specified packages when array provided', () => {
      const allowList = ['vue', '@company/ui-lib']

      expect(mockFilter('/node_modules/vue/dist/vue.js', allowList)).toBe(true)
      expect(mockFilter('/node_modules/@company/ui-lib/index.js', allowList)).toBe(true)
      expect(mockFilter('/node_modules/@nuxt/icon/index.js', allowList)).toBe(false)
      expect(mockFilter('/node_modules/axios/index.js', allowList)).toBe(false)
      expect(mockFilter('/components/MyComponent.vue', allowList)).toBe(true)
    })
  })
})
