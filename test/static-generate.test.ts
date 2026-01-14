import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { execa } from 'execa'

describe('nuxt generate (static build)', () => {
  const playgroundDir = join(fileURLToPath(import.meta.url), '../../playground')
  const outputDir = join(playgroundDir, '.output/public')
  const componentIndexPath = join(outputDir, 'nuxt-component-preview/component-index.json')

  beforeAll(async () => {
    // Run nuxt generate
    await execa('npx', ['nuxi', 'generate'], {
      cwd: playgroundDir,
      timeout: 120000,
    })
  }, 120000)

  it('prerenders component-index.json', () => {
    expect(existsSync(componentIndexPath)).toBe(true)
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
