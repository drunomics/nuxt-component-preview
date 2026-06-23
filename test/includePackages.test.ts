import { dirname, join, resolve } from 'node:path'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import type { Component } from '@nuxt/schema'
import { collectIndexComponents, extractPackageName, generateComponentIndex } from '../src/runtime/server/utils/generateComponentIndex'

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

  describe('collectIndexComponents (app:templatesGenerated collection)', () => {
    const make = (name: string, filePath: string): Partial<Component> => ({
      pascalName: name,
      kebabName: name.toLowerCase(),
      filePath,
      shortPath: filePath,
      global: true,
    })

    // Regression guard: the module hook must NOT drop node_modules components.
    // They are filtered downstream by generateComponentIndex according to
    // includePackages; pre-filtering them here made that option dead for layer
    // components, silently shrinking the registry to project-local files.
    it('keeps node_modules (layer/package) components', () => {
      const components = [
        make('LocalCard', '/app/components/Canvas/Card.vue'),
        make('LayoutGrid', '/app/node_modules/@drunomics/lupus-nuxt-kickstart-components/components/Canvas/Layout/layout-grid.vue'),
        make('NuxtIcon', '/app/node_modules/@nuxt/icon/Icon.vue'),
      ] as Component[]

      const collected = collectIndexComponents(components)

      expect(collected).toHaveLength(3)
      expect(collected.map(c => c.pascalName)).toEqual(['LocalCard', 'LayoutGrid', 'NuxtIcon'])
      // The node_modules paths survive so includePackages can act on them.
      expect(collected.some(c => c.filePath.includes('node_modules'))).toBe(true)
    })

    it('projects only the fields written to the index config', () => {
      const collected = collectIndexComponents([
        { pascalName: 'Foo', kebabName: 'foo', filePath: '/a/Foo.vue', shortPath: 'Foo.vue', global: true, mode: 'all' },
      ] as unknown as Component[])

      expect(Object.keys(collected[0]).sort()).toEqual(['filePath', 'global', 'kebabName', 'pascalName', 'shortPath'])
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

  // The tests above feed non-existent /fake/node_modules/... paths, so those
  // components are dropped by the existsSync guard *before* the package filter
  // runs — they do not actually exercise the includePackages branch. These
  // tests write a real .vue under a node_modules path so existsSync passes and
  // the default "ignore all packages" logic is genuinely proven.
  describe('default exclusion with a real on-disk node_modules component', () => {
    const tsconfigPath = resolve(process.cwd(), 'playground/tsconfig.json')
    const localPath = resolve(process.cwd(), 'playground/components/global/TestButton.vue')

    let tmpRoot: string
    let pkgComponentPath: string

    beforeAll(() => {
      tmpRoot = mkdtempSync(join(tmpdir(), 'ncp-pkg-'))
      // A genuine node_modules path that exists on disk.
      pkgComponentPath = join(tmpRoot, 'node_modules', '@acme', 'ui-kit', 'AcmeButton.vue')
      mkdirSync(dirname(pkgComponentPath), { recursive: true })
      writeFileSync(pkgComponentPath, [
        '<template><button>{{ label }}</button></template>',
        '<script setup lang="ts">',
        'defineProps<{',
        '  /**',
        '   * Button label',
        '   * @example Go',
        '   */',
        '  label?: string',
        '}>()',
        '</script>',
        '',
      ].join('\n'))
    })

    afterAll(() => {
      rmSync(tmpRoot, { recursive: true, force: true })
    })

    const make = (name: string, filePath: string): Partial<Component> => ({
      pascalName: name,
      kebabName: name.toLowerCase(),
      filePath,
      shortPath: filePath,
      global: true,
    })

    const idsFor = (includePackages: boolean | string[] | undefined) =>
      generateComponentIndex(
        [make('UserButton', localPath), make('AcmeButton', pkgComponentPath)] as Component[],
        tsconfigPath,
        { category: 'Test', status: 'stable', includePackages },
      ).components.map(c => c.id)

    it('excludes the existing node_modules component when includePackages is undefined', () => {
      expect(idsFor(undefined)).toEqual(['UserButton'])
    })

    it('excludes the existing node_modules component when includePackages is false', () => {
      expect(idsFor(false)).toEqual(['UserButton'])
    })

    it('includes it when includePackages is true', () => {
      const ids = idsFor(true)
      expect(ids).toContain('UserButton')
      expect(ids).toContain('AcmeButton')
    })

    it('includes it only when its package is whitelisted', () => {
      expect(idsFor(['@acme/ui-kit'])).toContain('AcmeButton')
    })

    it('excludes it when a different package is whitelisted', () => {
      expect(idsFor(['@other/pkg'])).not.toContain('AcmeButton')
    })
  })
})
