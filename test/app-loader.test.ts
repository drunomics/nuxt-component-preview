import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { setup, createPage } from '@nuxt/test-utils/e2e'

describe('app-loader E2E', async () => {
  await setup({
    rootDir: join(fileURLToPath(import.meta.url), '../../playground'),
    server: true,
    browser: true,
  })

  it('creates DOM containers on initialization', async () => {
    const page = await createPage('/preview-test-loader.html')

    // Wait for containers to be created
    await page.waitForFunction(() => {
      return document.getElementById('__nuxt') !== null &&
             document.getElementById('teleports') !== null
    }, { timeout: 5000 })

    // Verify containers exist
    const containersExist = await page.evaluate(() => {
      const nuxt = document.getElementById('__nuxt')
      const teleports = document.getElementById('teleports')
      return nuxt !== null && teleports !== null
    })

    expect(containersExist).toBe(true)
    await page.close()
  })

  it('fires ready event when component preview is enabled', async () => {
    const page = await createPage('/preview-test-loader.html')

    // Inject listener before page loads
    await page.addInitScript(() => {
      window.__PREVIEW_READY__ = false
      window.addEventListener('nuxt-component-preview:ready', () => {
        window.__PREVIEW_READY__ = true
      })
    })

    await page.reload()

    // Wait for event
    const ready = await page.waitForFunction(() => {
      return window.__PREVIEW_READY__ === true
    }, { timeout: 10000 })

    expect(ready).toBeTruthy()
    await page.close()
  })

  it('provides $previewComponent method via nuxtApp', async () => {
    const page = await createPage('/preview-test-loader.html')

    // Inject listener before page loads
    await page.addInitScript(() => {
      window.__HAS_PREVIEW_METHOD__ = false
      window.addEventListener('nuxt-component-preview:ready', (event: any) => {
        const { nuxtApp } = event.detail
        window.__HAS_PREVIEW_METHOD__ = typeof nuxtApp?.$previewComponent === 'function'
      })
    })

    await page.reload()

    // Wait and check
    await page.waitForFunction(() => window.__HAS_PREVIEW_METHOD__ !== false, { timeout: 10000 })

    const hasMethod = await page.evaluate(() => window.__HAS_PREVIEW_METHOD__)
    expect(hasMethod).toBe(true)

    await page.close()
  })

  it('renders components in preview targets', async () => {
    const page = await createPage('/preview-test-loader.html')

    // Wait for components to render
    await page.waitForFunction(() => {
      const target = document.getElementById('preview-target-1')
      return target && target.children.length > 0
    }, { timeout: 15000 })

    // Verify content was rendered
    const hasContent = await page.evaluate(() => {
      const targets = [
        document.getElementById('preview-target-1'),
        document.getElementById('preview-target-2'),
        document.getElementById('preview-target-3')
      ]
      return targets.some(t => t && t.children.length > 0)
    })

    expect(hasContent).toBe(true)
    await page.close()
  })
})