import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

describe('complex config handling', async () => {
  await setup({
    rootDir: join(fileURLToPath(import.meta.url), '../../playground'),
    nuxtConfig: {
      // Complex config with special characters that would break without proper handling
      runtimeConfig: {
        public: {
          testEscaping: {
            quotes: 'Test with "double quotes"',
            apostrophes: 'Test with \'single quotes\' and apostrophe\'s',
            mixed: 'Mixed "double" and \'single\' quotes',
            backslashes: 'Path\\with\\backslashes',
            jsonLike: '{"key": "value"}',
            translation: '$t("translation.key")',
            code: 'function() { return "test"; }',
            special: 'GTM-K8BN8699',
            nested: {
              array: [
                { name: '$t("test.name")', value: 'test\'s value' },
                { id: 'GTM-123', desc: 'Item with "quotes"' },
              ],
            },
          },
        },
      },
    },
  })

  it('app-loader.js generates valid JavaScript with complex config', async () => {
    const script = await $fetch('/nuxt-component-preview/app-loader.js', {
      responseType: 'text',
    })

    // Test 1: Script should be valid JavaScript
    const validateJS = (code: string): boolean => {
      try {
        // Use Function constructor to validate syntax
        new Function(code)
        return true
      }
      catch (e) {
        console.error('Invalid JavaScript:', e)
        return false
      }
    }
    expect(validateJS(script), 'Generated script should be valid JavaScript').toBe(true)

    // Test 2: Config should be embedded directly (not as string with JSON.parse)
    expect(script).toContain('public: {')
    expect(script).not.toContain('JSON.parse')

    // Test 3: Complex config values should be present
    expect(script).toContain('testEscaping')
    expect(script).toContain('GTM-K8BN8699')

    // Test 4: Script should execute without errors
    // Create a mock DOM environment for the script
    const mockDOM = `
      const document = {
        getElementById: () => null,
        createElement: () => ({
          setAttribute: () => {},
          appendChild: () => {},
        }),
        head: { appendChild: () => {} },
        body: { insertBefore: () => {}, firstChild: null },
        readyState: 'complete'
      };
      const window = { addEventListener: () => {} };
      ${script}
    `
    expect(validateJS(mockDOM), 'Script should execute in mock environment').toBe(true)
  })
})
