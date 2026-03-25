import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { setup, createPage } from '@nuxt/test-utils/e2e'

describe('preview E2E (dev mode)', async () => {
  await setup({
    rootDir: join(fileURLToPath(import.meta.url), '../../../playground'),
    server: true,
    browser: true,
    dev: true,
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

    it('applies global CSS styles in preview mode', async () => {
      const page = await createPage('/preview-test-loader.html')

      // Wait for CSS to be loaded and applied
      await page.waitForFunction(() => {
        const el = document.getElementById('css-test')
        if (!el) return false
        const style = window.getComputedStyle(el)
        // The global.css sets --global-css-active: 1 on .global-css-loaded
        return style.getPropertyValue('--global-css-active') === '1'
      }, { timeout: 10000 })

      const cssApplied = await page.evaluate(() => {
        const el = document.getElementById('css-test')!
        const style = window.getComputedStyle(el)
        return {
          customProperty: style.getPropertyValue('--global-css-active'),
        }
      })

      expect(cssApplied.customProperty).toBe('1')
      await page.close()
    })

    it('renders nested components (2 levels deep)', async () => {
      const page = await createPage('/preview-test-loader.html')

      // Wait for deep nesting section to render
      await page.waitForFunction(() => {
        const deepCard1 = document.getElementById('deep-card-1')
        const deepCard2 = document.getElementById('deep-card-2')
        return deepCard1 && deepCard1.children.length > 0 && deepCard2 && deepCard2.children.length > 0
      }, { timeout: 15000 })

      const nestedContent = await page.evaluate(() => {
        const deepCard1 = document.getElementById('deep-card-1')
        const deepCard2 = document.getElementById('deep-card-2')
        const outerButton = document.getElementById('outer-button-1')

        return {
          hasDeepCard1: deepCard1?.innerHTML.includes('Deep Card 1'),
          hasDeepCard2: deepCard2?.innerHTML.includes('Deep Card 2'),
          hasOuterButton: outerButton?.innerHTML.includes('Outer Button'),
        }
      })

      expect(nestedContent.hasDeepCard1).toBe(true)
      expect(nestedContent.hasDeepCard2).toBe(true)
      expect(nestedContent.hasOuterButton).toBe(true)
      await page.close()
    })
  })

  describe('without app-loader.js (manual setup)', () => {
    it('works with manually configured HTML', async () => {
      const page = await createPage('/preview-test.html')

      // Check if global nuxtApp is set after ready
      const isReady = await page.waitForFunction(() => {
        return window.__nuxtComponentPreviewApp !== undefined
      }, { timeout: 10000 })

      expect(isReady).toBeTruthy()
      await page.close()
    })

    it('provides $previewComponent method', async () => {
      const page = await createPage('/preview-test.html')

      // Wait for app to be ready and check if method exists
      await page.waitForFunction(() => {
        return window.__nuxtComponentPreviewApp !== undefined
      }, { timeout: 10000 })

      const hasMethod = await page.evaluate(() => {
        return typeof window.__nuxtComponentPreviewApp?.$previewComponent === 'function'
      })

      expect(hasMethod).toBe(true)
      await page.close()
    })

    it('renders Vue components with actual HTML content', async () => {
      const page = await createPage('/preview-test.html')

      // Wait for actual content to render (not just any children)
      await page.waitForFunction(() => {
        const target = document.getElementById('preview-target-1')
        return target && target.innerHTML.includes('Rendered HTML Content')
      }, { timeout: 20000 })

      // Check for specific Vue component HTML content
      const componentContent = await page.evaluate(() => {
        const target1 = document.getElementById('preview-target-1')
        const target2 = document.getElementById('preview-target-2')
        const target3 = document.getElementById('preview-target-3')

        // Look for actual rendered content
        const hasRenderedHTML = target1?.innerHTML.includes('Rendered HTML Content')
          || target1?.querySelector('h2')?.textContent?.includes('Rendered')

        // Look for TestCard component structure
        const hasCardTitle = target2?.innerHTML.includes('Amazing Card Title')
          || target2?.innerHTML.includes('Card')

        // Check if multiple components rendered
        const multipleRendered = [target1, target2, target3].filter(t =>
          t && t.children.length > 0,
        ).length

        return {
          hasRenderedHTML,
          hasCardTitle,
          multipleRendered,
          target1Text: target1?.textContent?.substring(0, 100),
          target2Text: target2?.textContent?.substring(0, 100),
        }
      })

      expect(componentContent.hasRenderedHTML).toBe(true)
      expect(componentContent.hasCardTitle).toBe(true)
      expect(componentContent.multipleRendered).toBeGreaterThan(0)
      await page.close()
    }, 30000)
  })
})
