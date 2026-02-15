import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

describe('component index (dev mode)', async () => {
  await setup({
    rootDir: join(fileURLToPath(import.meta.url), '../../playground'),
    dev: true,
  })

  it('includes subfolder components with folder-prefixed names', async () => {
    const index = await $fetch('/nuxt-component-preview/component-index.json')
    const subfolderComp = index.components.find((c: any) => c.id === 'SubfolderExample')
    expect(subfolderComp, 'SubfolderExample should be in the component index').toBeDefined()
    expect(subfolderComp.name).toBe('Subfolder Example')
  })

  it('includes top-level components', async () => {
    const index = await $fetch('/nuxt-component-preview/component-index.json')
    const buttonComp = index.components.find((c: any) => c.id === 'TestButton')
    expect(buttonComp, 'TestButton should be in the component index').toBeDefined()
    expect(buttonComp.name).toBe('Test Button')
  })
})
