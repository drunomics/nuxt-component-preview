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

  it('app-loader.js always sets cdnURL', async () => {
    const script = await $fetch('/nuxt-component-preview/app-loader.js', {
      responseType: 'text',
    })

    // Check that cdnURL is used in window.__NUXT__.config
    expect(script).toContain('window.__NUXT__.config')
    expect(script).toContain('cdnURL:')

    // Verify the cdnURL is properly set in the generated config
    // The script should include cdnURL in the app config section
    const configMatch = script.match(/cdnURL:\s*"([^"]*)"/)
    expect(configMatch).toBeTruthy()

    // The cdnURL should be set to a valid URL (from request origin)
    if (configMatch && configMatch[1]) {
      const cdnURL = configMatch[1]
      expect(cdnURL).toBeTruthy()
      // Should be a valid URL with protocol and host
      expect(cdnURL).toMatch(/^https?:\/\/[^/]+/)
    }

    // Check that entry module src uses the same URL
    const entryMatch = script.match(/entry\.src\s*=\s*'([^']+)'/)
    expect(entryMatch).toBeTruthy()
    if (entryMatch && configMatch) {
      // Entry src should start with cdnURL
      expect(entryMatch[1]).toContain(configMatch[1])
    }
  })

  it('app-loader.js handles complex config with special characters', async () => {
    const script = await $fetch('/nuxt-component-preview/app-loader.js', {
      responseType: 'text',
    })

    // Verify the script has valid JavaScript syntax
    const isValidJS = () => {
      try {
        new Function(script) // eslint-disable-line no-new-func
        return true
      } catch {
        return false
      }
    }
    expect(isValidJS()).toBe(true)

    // Check that public config is embedded directly as JSON (not with JSON.parse)
    expect(script).toContain('public: {')
    expect(script).not.toContain('JSON.parse')
  })
})
