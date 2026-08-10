import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { execa } from 'execa'

/**
 * The index carries its Cache-Control as a Nitro route rule rather than a
 * header set in the request handler, because the handler does not run in every
 * output mode. Deployment presets consume route rules to write their own
 * header config, so building against one of them (netlify here) is what proves
 * the policy survives a static deployment.
 */
describe('component-index route rule (netlify preset)', () => {
  const playgroundDir = join(fileURLToPath(import.meta.url), '../../playground')
  const headersPath = join(playgroundDir, 'dist/_headers')
  let headers: string

  beforeAll(async () => {
    await execa('npx', ['nuxi', 'build'], {
      cwd: playgroundDir,
      timeout: 180000,
      env: {
        ...process.env,
        NITRO_PRESET: 'netlify',
      },
    })
    headers = readFileSync(headersPath, 'utf-8')
  }, 180000)

  it('writes the component-index cache-control into the preset header config', () => {
    expect(headers).toContain('/nuxt-component-preview/component-index.json\n  cache-control: public, max-age=60, must-revalidate')
  })
})
