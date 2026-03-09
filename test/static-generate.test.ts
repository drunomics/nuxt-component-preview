import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { execa } from 'execa'

describe('nuxt generate (static build)', () => {
  const playgroundDir = join(fileURLToPath(import.meta.url), '../../playground')
  const outputDir = join(playgroundDir, '.output/public')
  const componentIndexPath = join(outputDir, 'nuxt-component-preview/component-index.json')
  const appLoaderPath = join(outputDir, 'nuxt-component-preview/app-loader.js')
  const testCdnUrl = 'https://static.example.com'

  beforeAll(async () => {
    // Run nuxt generate with cdnURL configured (required for static builds)
    await execa('npx', ['nuxi', 'generate'], {
      cwd: playgroundDir,
      timeout: 120000,
      env: {
        ...process.env,
        NUXT_APP_CDN_URL: testCdnUrl,
      },
    })
  }, 120000)

  it('prerenders component-index.json', () => {
    expect(existsSync(componentIndexPath)).toBe(true)
  })

  it('prerenders app-loader.js', () => {
    expect(existsSync(appLoaderPath)).toBe(true)
  })

  it('app-loader.js uses configured cdnURL as default', () => {
    const content = readFileSync(appLoaderPath, 'utf-8')

    // The build-time cdnURL should be embedded as the default value.
    expect(content).toContain(`? attrCdnURL : "${testCdnUrl}"`)

    // The default entry path concatenates cdnURL + entryPath.
    expect(content).toContain(`"${testCdnUrl}"`)
    expect(content).toMatch(/\+ "\/_nuxt\/[^"]+\.js"/)
  })

  it('app-loader.js contains valid entry path', () => {
    const content = readFileSync(appLoaderPath, 'utf-8')

    // Entry src is set via effectiveEntryPath variable.
    expect(content).toContain('entry.src = effectiveEntryPath')

    // The default entry path should reference a .js file.
    const entryDefault = content.match(/\+ "([^"]+\.js)"/)
    expect(entryDefault).toBeTruthy()
  })

  it('generates valid JSON with components', () => {
    const content = readFileSync(componentIndexPath, 'utf-8')
    const data = JSON.parse(content)

    expect(data).toHaveProperty('version', '1.0')
    expect(data).toHaveProperty('components')
    expect(Array.isArray(data.components)).toBe(true)
    expect(data.components.length).toBeGreaterThan(0)
  })

  it('includes expected components in static output', () => {
    const content = readFileSync(componentIndexPath, 'utf-8')
    const data = JSON.parse(content)
    const componentIds = data.components.map((c: { id: string }) => c.id)

    expect(componentIds).toContain('TestButton')
    expect(componentIds).toContain('TestCard')
    expect(componentIds).toContain('TestHero')
  })

  it('components have required properties', () => {
    const content = readFileSync(componentIndexPath, 'utf-8')
    const data = JSON.parse(content)

    for (const component of data.components) {
      expect(component).toHaveProperty('id')
      expect(component).toHaveProperty('name')
      expect(component).toHaveProperty('category')
      expect(component).toHaveProperty('status')
      expect(component).toHaveProperty('props')
    }
  })
})
