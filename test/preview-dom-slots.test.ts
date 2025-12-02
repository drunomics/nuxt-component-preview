import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { setup, createPage } from '@nuxt/test-utils/e2e'

describe('preview DOM element slots', async () => {
  await setup({
    rootDir: join(fileURLToPath(import.meta.url), '../../playground'),
    server: true,
    browser: true,
    dev: true,
  })

  it('renders components with DOM element slots', async () => {
    const page = await createPage('/preview-test-dom-slots.html')

    // Wait for first test to render
    await page.waitForFunction(() => {
      const target = document.getElementById('test-dom-slot-simple')
      return target && target.innerHTML.includes('DOM Element Content')
    }, { timeout: 15000 })

    const hasContent = await page.evaluate(() => {
      const target = document.getElementById('test-dom-slot-simple')
      return target?.innerHTML.includes('This content is a real DOM element')
    })

    expect(hasContent).toBe(true)
    await page.close()
  })

  it('preserves DOM element identity when moving to slots', async () => {
    const page = await createPage('/preview-test-dom-slots.html')

    // Wait for component to render
    await page.waitForFunction(() => {
      return document.getElementById('test-element') !== null
    }, { timeout: 15000 })

    // Verify the element still has its ID (wasn't cloned)
    const elementStillExists = await page.evaluate(() => {
      const el = document.getElementById('test-element')
      return el !== null && el.textContent?.includes('DOM element')
    })

    expect(elementStillExists).toBe(true)
    await page.close()
  })

  it('preserves event listeners on moved DOM elements', async () => {
    const page = await createPage('/preview-test-dom-slots.html')

    // Wait for button to be rendered
    await page.waitForFunction(() => {
      return document.getElementById('test-button') !== null
    }, { timeout: 15000 })

    // Set up dialog handler before clicking
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Button clicked 1 time(s)')
      await dialog.accept()
    })

    // Click the button
    await page.click('#test-button')

    await page.close()
  })

  it('handles nested components in DOM element slots', async () => {
    const page = await createPage('/preview-test-dom-slots.html')

    // Wait for nested components to render
    await page.waitForFunction(() => {
      const nested1 = document.getElementById('nested-button-dom')
      const nested2 = document.getElementById('nested-card-dom')
      return nested1 && nested1.children.length > 0
        && nested2 && nested2.children.length > 0
    }, { timeout: 20000 })

    const nestedContent = await page.evaluate(() => {
      const button = document.getElementById('nested-button-dom')
      const card = document.getElementById('nested-card-dom')
      return {
        hasButton: button?.innerHTML.includes('Nested Button in DOM Slot')
          || button?.querySelector('button')?.textContent?.includes('Nested Button'),
        hasCard: card?.innerHTML.includes('Nested Card'),
      }
    })

    expect(nestedContent.hasButton).toBe(true)
    expect(nestedContent.hasCard).toBe(true)
    await page.close()
  })

  it('supports mixing DOM element and string slots', async () => {
    const page = await createPage('/preview-test-dom-slots.html')

    // Wait for mixed slot component to render
    await page.waitForFunction(() => {
      const target = document.getElementById('test-mixed-slots')
      return target && target.innerHTML.includes('DOM slot content')
        && target.innerHTML.includes('String Slot')
    }, { timeout: 15000 })

    const mixedContent = await page.evaluate(() => {
      const target = document.getElementById('test-mixed-slots')
      return {
        hasDOMSlot: target?.innerHTML.includes('DOM slot content'),
        hasStringSlot: target?.innerHTML.includes('String Slot'),
      }
    })

    expect(mixedContent.hasDOMSlot).toBe(true)
    expect(mixedContent.hasStringSlot).toBe(true)
    await page.close()
  })

  it('removes visually-hidden class from slot containers', async () => {
    const page = await createPage('/preview-test-dom-slots.html')

    // Wait for rendering and container removal
    await page.waitForFunction(() => {
      const container = document.getElementById('test-dom-slot-simple')
      if (!container) return false
      const hiddenDivs = container.querySelectorAll('.visually-hidden[data-slot]')
      return hiddenDivs.length === 0
    }, { timeout: 15000 })

    // Check that slot containers with visually-hidden were removed
    const hiddenContainersRemaining = await page.evaluate(() => {
      // After slots are moved, the original containers should be removed
      const container = document.getElementById('test-dom-slot-simple')
      if (!container) return -1 // Fail if container not found
      const hiddenDivs = container.querySelectorAll('.visually-hidden[data-slot]')
      return hiddenDivs.length
    })

    // Should be 0 because containers are removed after moving children
    expect(hiddenContainersRemaining).toBe(0)
    await page.close()
  })
})
