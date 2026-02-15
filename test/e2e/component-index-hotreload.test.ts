import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { describe, it, expect, afterAll } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

const playgroundDir = join(fileURLToPath(import.meta.url), '../../../playground')
const tempComponentPath = join(playgroundDir, 'components/global/HotReloadTest.vue')

/**
 * Poll the component index endpoint until a condition is met.
 * Uses AbortController to prevent requests from hanging during rebuilds.
 */
async function waitForComponentIndex(
  condition: (index: any) => boolean,
  { timeout = 30000, interval = 500 } = {},
): Promise<any> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const index = await $fetch('/nuxt-component-preview/component-index.json', {
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (condition(index)) return index
    }
    catch {
      // Server might be rebuilding, retry
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  // Final attempt — let assertion report clearly on failure
  const index = await $fetch('/nuxt-component-preview/component-index.json')
  expect(condition(index), 'Timed out waiting for component index to match condition').toBe(true)
  return index
}

describe('component index hot-reload (dev mode)', async () => {
  // Clean up temp files from previous runs
  if (existsSync(tempComponentPath)) {
    unlinkSync(tempComponentPath)
  }

  await setup({
    rootDir: playgroundDir,
    dev: true,
  })

  afterAll(() => {
    try {
      if (existsSync(tempComponentPath)) {
        unlinkSync(tempComponentPath)
      }
    }
    catch { /* best effort cleanup */ }
  })

  it('picks up a new component file', async () => {
    // Verify the component is NOT in the index yet
    const initialIndex = await $fetch('/nuxt-component-preview/component-index.json')
    expect(initialIndex.components.find((c: any) => c.id === 'HotReloadTest')).toBeUndefined()

    // Create a new component file
    writeFileSync(tempComponentPath, `<template>
  <div>{{ message }}</div>
</template>

<script setup lang="ts">
defineProps<{
  /** Test message */
  message?: string
}>()
</script>
`)

    // Wait for the component to appear in the index.
    // Nuxt's file watcher detects the new file, re-scans components,
    // fires app:templatesGenerated which writes the updated config file,
    // and the next request reads the new config.
    const updatedIndex = await waitForComponentIndex(
      index => index.components.some((c: any) => c.id === 'HotReloadTest'),
    )

    const comp = updatedIndex.components.find((c: any) => c.id === 'HotReloadTest')
    expect(comp).toBeDefined()
    expect(comp.name).toBe('Hot Reload Test')
    expect(comp.props.properties.message).toBeDefined()
    expect(comp.props.properties.message.type).toBe('string')
  }, 60000)

  it('reflects prop changes for existing components', async () => {
    // Modify the component to add a new prop
    writeFileSync(tempComponentPath, `<template>
  <div>{{ message }} - {{ subtitle }}</div>
</template>

<script setup lang="ts">
defineProps<{
  /** Test message */
  message?: string
  /** A subtitle */
  subtitle?: string
}>()
</script>
`)

    // Wait for the new prop to appear.
    // The component is already in the config, and generateComponentIndex
    // re-reads files via vue-component-meta on each request.
    const updatedIndex = await waitForComponentIndex(
      (index) => {
        const comp = index.components.find((c: any) => c.id === 'HotReloadTest')
        return comp?.props?.properties?.subtitle !== undefined
      },
    )

    const comp = updatedIndex.components.find((c: any) => c.id === 'HotReloadTest')
    expect(comp.props.properties.subtitle).toBeDefined()
    expect(comp.props.properties.subtitle.type).toBe('string')
    // Original prop should still be there
    expect(comp.props.properties.message).toBeDefined()
  }, 60000)

  it('removes a deleted component file', async () => {
    unlinkSync(tempComponentPath)

    // Wait for the component to disappear from the index.
    // Nuxt's file watcher detects the deletion, re-scans components,
    // fires app:templatesGenerated which writes the updated config file.
    const updatedIndex = await waitForComponentIndex(
      index => !index.components.some((c: any) => c.id === 'HotReloadTest'),
    )

    expect(updatedIndex.components.find((c: any) => c.id === 'HotReloadTest')).toBeUndefined()
  }, 60000)
})
