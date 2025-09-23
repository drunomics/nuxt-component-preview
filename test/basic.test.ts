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
      responseType: 'text'
    })
    expect(typeof script).toBe('string')
    expect(script).toContain('function initNuxt()')
    expect(script).toContain('componentPreview')
  })
})