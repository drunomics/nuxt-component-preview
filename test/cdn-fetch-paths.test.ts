/**
 * @vitest-environment happy-dom
 *
 * Exercises the `cdnFetchPaths` client plugin introduced to re-route
 * client-side `$fetch` calls to the Nuxt app origin (`config.app.cdnURL`)
 * instead of the embedding document's origin.
 *
 * Unit-style test: the plugin is imported directly with `#imports` and
 * the global `$fetch` mocked, so we can capture what `options.baseURL`
 * the plugin's `onRequest` hook applies to a given request path. No
 * playground Nuxt instance needed.
 *
 * The `@vitest-environment happy-dom` pragma opts this file out of the
 * repo-wide `environment: 'nuxt'` setting from `vitest.config.ts` —
 * under the Nuxt env, `#imports` resolves to the real Nuxt virtual
 * module and `vi.mock('#imports')` does NOT intercept it, so
 * `useRuntimeConfig()` returns the playground's empty config instead
 * of the per-test stub. happy-dom gives a plain vite module graph
 * where the mock works as written.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

type OnRequestHook = (ctx: { request: string, options: { baseURL?: string } }) => void

const state: {
  runtimeConfig: {
    app: { cdnURL?: string }
    public: { nuxtComponentPreview?: { cdnFetchPaths?: string[] } }
  }
  capturedOnRequest: OnRequestHook | null
} = {
  runtimeConfig: { app: {}, public: {} },
  capturedOnRequest: null,
}

vi.mock('#imports', () => ({
  defineNuxtPlugin: (opts: unknown) => opts,
  useRuntimeConfig: () => state.runtimeConfig,
}))

/**
 * Minimal $fetch mock whose `.create()` captures the `onRequest` hook
 * passed by the plugin, so tests can call it directly and observe what
 * `options.baseURL` it sets.
 */
function installMockFetch(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).$fetch = {
    create(opts: { onRequest: OnRequestHook }) {
      state.capturedOnRequest = opts.onRequest
      return (globalThis as unknown as { $fetch: unknown }).$fetch
    },
  }
}

async function runPluginSetup(): Promise<OnRequestHook | null> {
  state.capturedOnRequest = null
  vi.resetModules()
  installMockFetch()
  const mod = await import('../src/runtime/plugins/cdn-fetch-paths.client')
  const plugin = (mod as { default: { setup: () => void | Promise<void> } }).default
  await plugin.setup()
  return state.capturedOnRequest
}

function simulateRequest(hook: OnRequestHook, request: string): string | undefined {
  const options: { baseURL?: string } = {}
  hook({ request, options })
  return options.baseURL
}

describe('cdnFetchPaths client plugin', () => {
  beforeEach(() => {
    // Reset to an empty runtime config before each test; the plugin's
    // client-only restriction is enforced at the Nuxt module level
    // (`mode: 'client'` + `.client.ts` suffix), not at runtime, so no env
    // stubbing is needed here.
    state.runtimeConfig = { app: {}, public: {} }
  })

  it('is a no-op when cdnURL is not set', async () => {
    state.runtimeConfig = {
      app: {},
      public: { nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] } },
    }
    const hook = await runPluginSetup()
    // Plugin returns early → no wrapper installed, no hook captured.
    expect(hook).toBeNull()
  })

  it('is a no-op when cdnFetchPaths is empty', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: { nuxtComponentPreview: { cdnFetchPaths: [] } },
    }
    const hook = await runPluginSetup()
    expect(hook).toBeNull()
  })

  it('is a no-op when nuxtComponentPreview.cdnFetchPaths is missing', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {},
    }
    const hook = await runPluginSetup()
    expect(hook).toBeNull()
  })

  it('applies cdnURL as baseURL for matching path prefixes', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: { nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/', '/_i18n/'] } },
    }
    const hook = await runPluginSetup()
    expect(hook).not.toBeNull()

    expect(simulateRequest(hook!, '/api/_nuxt_icon/ph.json?icons=home'))
      .toBe('https://app.example.com')
    expect(simulateRequest(hook!, '/_i18n/abc123/en/messages.json'))
      .toBe('https://app.example.com')
  })

  it('strips a trailing slash from cdnURL to avoid `https://origin//api`', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com/' },
      public: { nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] } },
    }
    const hook = await runPluginSetup()
    expect(simulateRequest(hook!, '/api/_nuxt_icon/ph.json'))
      .toBe('https://app.example.com')
  })

  it('leaves non-matching relative requests untouched', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: { nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] } },
    }
    const hook = await runPluginSetup()
    // `/api/drupal-ce/…` is a Drupal-CE route served by the embedder —
    // must NOT be rewritten to the Nuxt origin.
    expect(simulateRequest(hook!, '/api/drupal-ce/node/42')).toBeUndefined()
    // Root-level `/favicon.ico` likewise.
    expect(simulateRequest(hook!, '/favicon.ico')).toBeUndefined()
  })

  it('leaves absolute URLs untouched (ofetch ignores baseURL for those, but we also early-return)', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: { nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] } },
    }
    const hook = await runPluginSetup()
    expect(simulateRequest(hook!, 'https://somewhere.else/api/_nuxt_icon/ph.json'))
      .toBeUndefined()
  })

  it('matches with startsWith — custom prefixes can be added', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: { nuxtComponentPreview: { cdnFetchPaths: ['/api/my-custom-route/'] } },
    }
    const hook = await runPluginSetup()
    expect(simulateRequest(hook!, '/api/my-custom-route/foo')).toBe('https://app.example.com')
    expect(simulateRequest(hook!, '/api/other/foo')).toBeUndefined()
  })
})
