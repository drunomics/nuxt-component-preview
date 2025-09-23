import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { setup, createPage } from '@nuxt/test-utils/e2e'

describe('preview E2E (dev mode)', async () => {
  await setup({
    rootDir: join(fileURLToPath(import.meta.url), '../../playground'),
    server: true,
    browser: true,
    dev: true,
  })

  describe('with app-loader.js', () => {
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

    it('renders Vue components with actual HTML content', async () => {
      const page = await createPage('/preview-test-loader.html')

      // Wait for components to render
      await page.waitForFunction(() => {
        const target = document.getElementById('preview-target-1')
        return target && target.children.length > 0
      }, { timeout: 15000 })

      // Check for specific Vue component HTML content
      const componentContent = await page.evaluate(() => {
        const target1 = document.getElementById('preview-target-1')
        const target2 = document.getElementById('preview-target-2')

        // Look for actual rendered content from TestMarkup component
        const hasMarkupContent = target1?.innerHTML.includes('HTML Content via Loader') ||
                                target1?.querySelector('h2')?.textContent?.includes('HTML Content')

        // Look for TestCard component structure (card elements)
        const hasCardStructure = target2?.querySelector('.card') !== null ||
                                target2?.innerHTML.includes('Card Component') ||
                                target2?.innerHTML.includes('card')

        return {
          hasMarkupContent,
          hasCardStructure,
          target1HTML: target1?.innerHTML.substring(0, 200), // First 200 chars for debugging
          target2HTML: target2?.innerHTML.substring(0, 200)
        }
      })

      expect(componentContent.hasMarkupContent).toBe(true)
      expect(componentContent.hasCardStructure).toBe(true)
      await page.close()
    })
  })

  describe('without app-loader.js (manual setup)', () => {
    it('works with manually configured HTML', async () => {
      const page = await createPage('/preview-test.html')

      // Inject listener before page loads
      await page.addInitScript(() => {
        window.__MANUAL_READY__ = false
        window.addEventListener('nuxt-component-preview:ready', () => {
          window.__MANUAL_READY__ = true
        })
      })

      await page.reload()

      // Wait for ready event
      const ready = await page.waitForFunction(() => {
        return window.__MANUAL_READY__ === true
      }, { timeout: 10000 })

      expect(ready).toBeTruthy()
      await page.close()
    })

    it('provides $previewComponent method', async () => {
      const page = await createPage('/preview-test.html')

      // Inject listener before page loads
      await page.addInitScript(() => {
        window.__HAS_METHOD__ = false
        window.addEventListener('nuxt-component-preview:ready', (event: any) => {
          const { nuxtApp } = event.detail
          window.__HAS_METHOD__ = typeof nuxtApp?.$previewComponent === 'function'
        })
      })

      await page.reload()

      // Wait and check
      await page.waitForFunction(() => window.__HAS_METHOD__ !== false, { timeout: 10000 })

      const hasMethod = await page.evaluate(() => window.__HAS_METHOD__)
      expect(hasMethod).toBe(true)

      await page.close()
    })

    it('renders Vue components with actual HTML content', async () => {
      const page = await createPage('/preview-test.html')

      // Wait for components to render
      await page.waitForFunction(() => {
        const target = document.getElementById('preview-target-1')
        return target && target.children.length > 0
      }, { timeout: 15000 })

      // Check for specific Vue component HTML content
      const componentContent = await page.evaluate(() => {
        const target1 = document.getElementById('preview-target-1')
        const target2 = document.getElementById('preview-target-2')
        const target3 = document.getElementById('preview-target-3')

        // Look for actual rendered content
        const hasRenderedHTML = target1?.innerHTML.includes('Rendered HTML Content') ||
                               target1?.querySelector('h2')?.textContent?.includes('Rendered')

        // Look for TestCard component structure
        const hasCardTitle = target2?.innerHTML.includes('Amazing Card Title') ||
                           target2?.innerHTML.includes('Card')

        // Check if multiple components rendered
        const multipleRendered = [target1, target2, target3].filter(t =>
          t && t.children.length > 0
        ).length

        return {
          hasRenderedHTML,
          hasCardTitle,
          multipleRendered,
          target1Text: target1?.textContent?.substring(0, 100),
          target2Text: target2?.textContent?.substring(0, 100)
        }
      })

      expect(componentContent.hasRenderedHTML).toBe(true)
      expect(componentContent.hasCardTitle).toBe(true)
      expect(componentContent.multipleRendered).toBeGreaterThan(0)
      await page.close()
    }, 20000)
  })
})

