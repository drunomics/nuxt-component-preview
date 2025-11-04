import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { setup, createPage } from '@nuxt/test-utils/e2e'

describe('preview E2E (production mode)', async () => {
  await setup({
    rootDir: join(fileURLToPath(import.meta.url), '../../playground'),
    server: true,
    browser: true,
    dev: false,
  })

  describe('with app-loader.js', () => {
    it('creates DOM containers on initialization', async () => {
      const page = await createPage('/preview-test-loader.html')

      // Wait for containers to be created
      await page.waitForFunction(() => {
        return document.getElementById('__nuxt') !== null
          && document.getElementById('teleports') !== null
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

      // Wait for event to fire or check if app is already ready
      const eventFired = await page.waitForFunction(() => {
        return window.__nuxtComponentPreviewApp !== undefined
      }, { timeout: 10000 })

      expect(eventFired).toBeTruthy()
      await page.close()
    })

    it('renders Vue components with actual HTML content', async () => {
      const page = await createPage('/preview-test-loader.html')

      // Wait for components to render
      await page.waitForFunction(() => {
        const buttonTarget = document.getElementById('preview-buttons')
        const layoutTarget = document.getElementById('preview-layout')
        return buttonTarget && buttonTarget.children.length > 0
          && layoutTarget && layoutTarget.children.length > 0
      }, { timeout: 15000 })

      // Check for specific Vue component HTML content
      const componentContent = await page.evaluate(() => {
        const buttonTarget = document.getElementById('preview-buttons')
        const layoutTarget = document.getElementById('preview-layout')

        // Look for Button component
        const hasButtonContent = buttonTarget?.innerHTML.includes('Primary Button')
          || buttonTarget?.querySelector('button')?.textContent?.includes('Primary Button')

        // Look for TwoColumnLayout with slots
        const hasLayoutWithSlots = layoutTarget?.innerHTML.includes('First Column')
          && layoutTarget?.innerHTML.includes('Second Column')

        return {
          hasButtonContent,
          hasLayoutWithSlots,
          buttonHTML: buttonTarget?.innerHTML.substring(0, 200),
          layoutHTML: layoutTarget?.innerHTML.substring(0, 300),
        }
      })

      expect(componentContent.hasButtonContent).toBe(true)
      expect(componentContent.hasLayoutWithSlots).toBe(true)
      await page.close()
    })
  })

  // Manual setup tests are not included here as they only work in dev mode
})
