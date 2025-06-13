import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, $fetch, createPage } from '@nuxt/test-utils/e2e'

describe('nuxt-component-preview module', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    browser: true
  })

  it('renders the playground app in normal mode (preview disabled)', async () => {
    const html = await $fetch('/')
    // Should contain the playground content
    expect(html).toContain('Nuxt Component Preview Playground')
    expect(html).toContain('Open Component Preview Test')
    // Should have preview mode disabled
    expect(html).toContain('inPreviewMode:false')
    expect(html).not.toContain('ComponentPreviewArea')
  })

  it('serves the preview-test.html static file', async () => {
    const html = await $fetch('/preview-test.html')
    expect(html).toContain('Nuxt Component Preview Test')
    expect(html).toContain('preview-target-1')
    expect(html).toContain('preview-target-2')
    expect(html).toContain('preview-target-3')
    expect(html).toContain('nuxt-component-preview:ready')
    expect(html).toContain('inPreviewMode: true')
  })

  it('includes runtime config for component preview', async () => {
    const html = await $fetch('/')
    // Should include the runtime config with componentPreview settings
    expect(html).toContain('componentPreview')
    expect(html).toContain('inPreviewMode')
  })

  it('loads the test preview page correctly', async () => {
    const page = await createPage('/preview-test.html')
    
    // Basic page loading
    await page.waitForLoadState('domcontentloaded')
    
    // Check that the page has the expected structure
    const title = await page.title()
    expect(title).toContain('Nuxt Component Preview Test')
    
    // Verify preview targets exist
    const target1 = await page.locator('#preview-target-1').count()
    expect(target1).toBe(1)
    
    const target2 = await page.locator('#preview-target-2').count()
    expect(target2).toBe(1)
    
    // Check that Nuxt config is loaded with preview mode enabled
    const previewMode = await page.evaluate(() => {
      return window.__NUXT__?.config?.public?.componentPreview?.inPreviewMode
    })
    expect(previewMode).toBe(true)
    
    await page.close()
  })
})
