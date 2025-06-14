import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { join } from 'node:path'

describe('nuxt-component-preview module', async () => {
  await setup({
    rootDir: join(fileURLToPath(import.meta.url), '../../playground'),
  })

  it('disables preview mode by default', async () => {
    const html = await $fetch('/')
    expect(html).toContain('Preview Mode:</strong> Disabled')
    expect(html).not.toContain('ComponentPreviewArea')
  })

  it('serves preview-test.html static file', async () => {
    const html = await $fetch('/preview-test.html')
    expect(html).toContain('Nuxt Component Preview Test')
    expect(html).toContain('componentPreview: true')
  })

  it('returns js code for entry.js', async () => {
    const js = await $fetch('/nuxt-component-preview/entry.js', {
      headers: {
        'Accept': 'application/javascript, text/javascript, */*'
      }
    })
    expect(typeof js).toBe('string')
    expect(js.length).toBeGreaterThan(0)
    // Check if it's JavaScript content (should contain common JS patterns)
    expect(js).toMatch(/function|const|var|let|import|export|=>|{|}/i)
  })

  it('renders the preview-test static route with expected content', async () => {
    const html = await $fetch('/preview-test.html')
    expect(html).toContain('<h1>Nuxt Component Preview Test</h1>')
    expect(html).toContain('componentPreview: true')
    expect(html).toContain('Rendered HTML Content')
    expect(html).toContain('Amazing Card Title')
    expect(html).toContain('Another Card')
    // Check for preview target containers
    expect(html).toContain('id="preview-target-1"')
    expect(html).toContain('id="preview-target-2"')
  })
})
