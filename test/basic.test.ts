import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

describe('nuxt-component-preview module', async () => {
  await setup({
    rootDir: join(fileURLToPath(import.meta.url), '../../playground'),
  })

  it('disables preview mode by default', async () => {
    const html = await $fetch('/')
    expect(html).toContain('Preview Mode:</strong> Disabled')
  })

  it('serves entry.js endpoint', async () => {
    const js = await $fetch('/nuxt-component-preview/entry.js', {
      headers: { Accept: 'application/javascript' },
    })
    expect(typeof js).toBe('string')
    expect(js.length).toBeGreaterThan(0)
  })

  it('serves app-loader.js endpoint', async () => {
    const script = await $fetch('/nuxt-component-preview/app-loader.js', {
      responseType: 'text',
    })
    expect(typeof script).toBe('string')
    expect(script).toContain('function initNuxt()')
    expect(script).toContain('componentPreview')
  })

  it('app-loader.js sets cdnURL as default', async () => {
    const script = await $fetch('/nuxt-component-preview/app-loader.js', {
      responseType: 'text',
    })

    // Check that cdnURL is set in the config via effectiveCdnURL
    expect(script).toContain('window.__NUXT__')
    expect(script).toContain('cdnURL: effectiveCdnURL')

    // The build-time cdnURL is used as fallback for scriptOrigin (when
    // document.currentScript.src is unavailable). At runtime, scriptOrigin
    // is derived from the script's own URL for correct origin detection.
    expect(script).toContain('var effectiveCdnURL = attrCdnURL !== null ? attrCdnURL : scriptOrigin')
    expect(script).toMatch(/var scriptOrigin = "https?:\/\/[^"]+"/)
  })

  it('component index includes subfolder components with folder-prefixed names', async () => {
    const index = await $fetch('/nuxt-component-preview/component-index.json')
    const subfolderComp = index.components.find((c: any) => c.id === 'SubfolderExample')
    expect(subfolderComp, 'SubfolderExample should be in the component index').toBeDefined()
    expect(subfolderComp.name).toBe('Subfolder Example')
    // Also verify a top-level component still works
    const buttonComp = index.components.find((c: any) => c.id === 'TestButton')
    expect(buttonComp, 'TestButton should be in the component index').toBeDefined()
    expect(buttonComp.name).toBe('Test Button')
  })

  it('app-loader.js generates valid JavaScript', async () => {
    const script = await $fetch('/nuxt-component-preview/app-loader.js', {
      responseType: 'text',
    })

    // Verify the script has valid JavaScript syntax
    const isValidJS = () => {
      try {
        new Function(script)
        return true
      }
      catch {
        return false
      }
    }
    expect(isValidJS()).toBe(true)
  })

  it('app-loader.js supports data-attribute overrides', async () => {
    const script = await $fetch('/nuxt-component-preview/app-loader.js', {
      responseType: 'text',
    })

    // Verify the script reads data-cdn-url and data-build-assets-dir
    expect(script).toContain('data-cdn-url')
    expect(script).toContain('data-build-assets-dir')
    expect(script).toContain('document.currentScript')
  })

  it('app-loader.js uses data-attribute values when provided', async () => {
    const script = await $fetch('/nuxt-component-preview/app-loader.js', {
      responseType: 'text',
    })

    // Simulate data-attribute overrides for lupus_csr theme scenario:
    // empty cdnURL + theme-prefixed buildAssetsDir.
    const testCdnUrl = ''
    const testBuildAssetsDir = '/themes/someprefix/dist/_nuxt/'

    // Execute the script in a mock DOM context with data attributes set.
    const mockDocument = {
      currentScript: {
        hasAttribute: (name: string) => {
          return name === 'data-cdn-url' || name === 'data-build-assets-dir'
        },
        getAttribute: (name: string) => {
          if (name === 'data-cdn-url') return testCdnUrl
          if (name === 'data-build-assets-dir') return testBuildAssetsDir
          return null
        },
      },
      readyState: 'complete',
      getElementById: () => null,
      createElement: () => ({
        style: {},
        setAttribute: () => {},
        set type(_v: string) {},
        set textContent(_v: string) {},
        set src(_v: string) {},
        set id(_v: string) {},
      }),
      body: {
        insertBefore: () => {},
        appendChild: () => {},
        firstChild: null,
      },
      head: {
        appendChild: () => {},
      },
      addEventListener: () => {},
    }

    // Run the script in a sandboxed context.
    const fn = new Function(
      'document',
      'window',
      'console',
      script.replace('window.__NUXT__', 'window.__NUXT_TEST__'),
    )
    const mockWindow = { __NUXT_TEST__: null } as any
    fn(mockDocument, mockWindow, { log: () => {} })

    // Verify the overridden values are used.
    expect(mockWindow.__NUXT_TEST__).toBeTruthy()
    expect(mockWindow.__NUXT_TEST__.config.app.cdnURL).toBe(testCdnUrl)
    expect(mockWindow.__NUXT_TEST__.config.app.buildAssetsDir).toBe(testBuildAssetsDir)
  })

  it('app-loader.js uses build-time defaults when no data attributes', async () => {
    const script = await $fetch('/nuxt-component-preview/app-loader.js', {
      responseType: 'text',
    })

    // Mock document WITHOUT data attributes.
    const mockDocument = {
      currentScript: {
        hasAttribute: () => false,
        getAttribute: () => null,
      },
      readyState: 'complete',
      getElementById: () => null,
      createElement: () => ({
        style: {},
        setAttribute: () => {},
        set type(_v: string) {},
        set textContent(_v: string) {},
        set src(_v: string) {},
        set id(_v: string) {},
      }),
      body: {
        insertBefore: () => {},
        appendChild: () => {},
        firstChild: null,
      },
      head: {
        appendChild: () => {},
      },
      addEventListener: () => {},
    }

    const mockWindow = { __NUXT_TEST__: null } as any
    const fn = new Function(
      'document',
      'window',
      'console',
      script.replace('window.__NUXT__', 'window.__NUXT_TEST__'),
    )
    fn(mockDocument, mockWindow, { log: () => {} })

    // Should use build-time cdnURL (a valid URL from request origin).
    expect(mockWindow.__NUXT_TEST__).toBeTruthy()
    expect(mockWindow.__NUXT_TEST__.config.app.cdnURL).toMatch(/^https?:\/\//)
    // Default buildAssetsDir should be /_nuxt/.
    expect(mockWindow.__NUXT_TEST__.config.app.buildAssetsDir).toBe('/_nuxt/')
  })
})
