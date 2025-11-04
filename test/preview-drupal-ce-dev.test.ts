import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { setup, createPage } from '@nuxt/test-utils/e2e'

describe('drupal-ce integration E2E (dev mode)', async () => {
  await setup({
    rootDir: join(fileURLToPath(import.meta.url), '../../playground'),
    server: true,
    browser: true,
    dev: true,
  })

  describe('with drupal-ce fallback resolution', () => {
    it('resolves node-article to node--default component via fallback when drupal-ce is available', async () => {
      const page = await createPage('/preview-drupal-ce-test.html')

      // Wait for Nuxt Component Preview to be ready
      await page.waitForFunction(() => {
        return window.__nuxtComponentPreviewApp !== undefined
      }, { timeout: 15000 })

      // Wait for the component to render
      await page.waitForSelector('[data-test-id="fallback-component"]', { timeout: 15000 })

      // Verify the fallback component rendered
      const componentExists = await page.evaluate(() => {
        const element = document.querySelector('[data-test-id="fallback-component"]')
        return element !== null
      })
      expect(componentExists).toBe(true)

      // Verify the title prop was passed correctly
      const hasCorrectTitle = await page.evaluate(() => {
        const title = document.querySelector('h2')
        return title?.textContent === 'Test Article'
      })
      expect(hasCorrectTitle).toBe(true)

      // Verify the body content was passed correctly
      const hasCorrectBody = await page.evaluate(() => {
        const content = document.querySelector('.content')
        return content?.textContent?.includes('node--default fallback component')
      })
      expect(hasCorrectBody).toBe(true)

      // Verify the fallback notice is present
      const hasFallbackNotice = await page.evaluate(() => {
        const notice = document.querySelector('.fallback-notice')
        return notice !== null && notice.textContent?.includes('node--default fallback')
      })
      expect(hasFallbackNotice).toBe(true)

      await page.close()
    }, 60000)
  })
})
