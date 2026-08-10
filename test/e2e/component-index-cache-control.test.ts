// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { setup, fetch } from '@nuxt/test-utils/e2e'

/**
 * In SSR production the component index is a static file served by Nitro's
 * public-asset handler, which sets no Cache-Control of its own. Left
 * unlabelled, a CDN in front of the app is free to apply its own default TTL
 * and serve an index from before the last deploy.
 */
describe('component-index cache-control (production SSR)', async () => {
  await setup({
    rootDir: join(fileURLToPath(import.meta.url), '../../../playground'),
    server: true,
    dev: false,
  })

  it('serves the index with a revalidating, shared-cacheable policy', async () => {
    const res = await fetch('/nuxt-component-preview/component-index.json')

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=60, must-revalidate')
  })

  it('serves an ETag so the revalidation can answer 304', async () => {
    const res = await fetch('/nuxt-component-preview/component-index.json')
    const etag = res.headers.get('etag')

    expect(etag).toBeTruthy()

    const revalidated = await fetch('/nuxt-component-preview/component-index.json', {
      headers: { 'if-none-match': etag! },
    })

    expect(revalidated.status).toBe(304)
  })
})
