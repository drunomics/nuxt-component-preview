/**
 * Unit tests for the `cdnFetchPaths` client plugin. Stubs
 * `useRuntimeConfig` via `mockNuxtImport` and captures the `onRequest`
 * hook passed to `$fetch.create` to observe the rewritten request URL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

type FetchContext = {
  request: string
  options: { baseURL?: string }
}
type OnRequestHook = (ctx: FetchContext) => void
type NativeFetch = (input: string, init?: { baseURL?: string }) => Promise<unknown>

const state: {
  runtimeConfig: {
    app: { cdnURL?: string }
    public: {
      componentPreview?: boolean
      componentPreviewActive?: boolean
      nuxtComponentPreview?: { cdnFetchPaths?: string[] }
    }
  }
  capturedOnRequest: OnRequestHook | null
  nativeCalls: Array<{ input: string, init?: { baseURL?: string } }>
} = {
  runtimeConfig: { app: {}, public: {} },
  capturedOnRequest: null,
  nativeCalls: [],
}

mockNuxtImport('useRuntimeConfig', () => {
  return () => state.runtimeConfig
})

function installMockFetch(): void {
  state.nativeCalls = []
  const originalNative: NativeFetch = async (input, init) => {
    state.nativeCalls.push({ input, init })
    return { ok: true }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).$fetch = {
    native: originalNative,
    create(opts: { onRequest: OnRequestHook }) {
      state.capturedOnRequest = opts.onRequest
      // Preserve the original `.native` on the returned instance so the
      // plugin can wrap it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrapped: any = (globalThis as unknown as { $fetch: unknown }).$fetch
      wrapped.native = originalNative
      return wrapped
    },
  }
}

async function runPluginSetup(): Promise<OnRequestHook | null> {
  state.capturedOnRequest = null
  vi.resetModules()
  installMockFetch()
  const mod = await import('../src/runtime/plugins/cdn-fetch-paths.client')
  // `defineNuxtPlugin({ setup })` returns the setup fn itself (decorated).
  const plugin = (mod as { default: (nuxtApp?: unknown) => void | Promise<void> }).default
  await plugin()
  return state.capturedOnRequest
}

function simulateRequest(
  hook: OnRequestHook,
  request: string,
  initialOptions: { baseURL?: string } = {},
): FetchContext {
  const ctx: FetchContext = { request, options: initialOptions }
  hook(ctx)
  return ctx
}

describe('cdnFetchPaths client plugin', () => {
  beforeEach(() => {
    state.runtimeConfig = { app: {}, public: {} }
  })

  it('is a no-op when component preview is not active', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: { nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] } },
    }
    const hook = await runPluginSetup()
    expect(hook).toBeNull()
  })

  it('activates on componentPreviewActive: true (new primary flag)', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {
        componentPreviewActive: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
      },
    }
    const hook = await runPluginSetup()
    expect(hook).not.toBeNull()
    expect(simulateRequest(hook!, '/api/_nuxt_icon/ph.json').request)
      .toBe('https://app.example.com/api/_nuxt_icon/ph.json')
  })

  it('activates on componentPreview: true (legacy boolean flag)', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
      },
    }
    const hook = await runPluginSetup()
    expect(hook).not.toBeNull()
    expect(simulateRequest(hook!, '/api/_nuxt_icon/ph.json').request)
      .toBe('https://app.example.com/api/_nuxt_icon/ph.json')
  })

  it('is a no-op when cdnURL is not set', async () => {
    state.runtimeConfig = {
      app: {},
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
      },
    }
    const hook = await runPluginSetup()
    expect(hook).toBeNull()
  })

  it('is a no-op when cdnFetchPaths is empty', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: [] },
      },
    }
    const hook = await runPluginSetup()
    expect(hook).toBeNull()
  })

  it('is a no-op when nuxtComponentPreview.cdnFetchPaths is missing', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: { componentPreview: true },
    }
    const hook = await runPluginSetup()
    expect(hook).toBeNull()
  })

  it('rewrites matching relative requests to absolute URLs', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/', '/_i18n/'] },
      },
    }
    const hook = await runPluginSetup()
    expect(hook).not.toBeNull()

    expect(simulateRequest(hook!, '/api/_nuxt_icon/ph.json?icons=home').request)
      .toBe('https://app.example.com/api/_nuxt_icon/ph.json?icons=home')
    expect(simulateRequest(hook!, '/_i18n/abc123/en/messages.json').request)
      .toBe('https://app.example.com/_i18n/abc123/en/messages.json')
  })

  it('overrides a Nuxt-default baseURL (empty or "/")', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
      },
    }
    const hook = await runPluginSetup()
    // Default baseURL of '/' is what Nuxt bakes into globalThis.$fetch.
    // We still rewrite because only an absolute http(s) baseURL is
    // treated as a caller override.
    expect(simulateRequest(hook!, '/api/_nuxt_icon/ph.json', { baseURL: '/' }).request)
      .toBe('https://app.example.com/api/_nuxt_icon/ph.json')
    expect(simulateRequest(hook!, '/api/_nuxt_icon/ph.json', { baseURL: '' }).request)
      .toBe('https://app.example.com/api/_nuxt_icon/ph.json')
  })

  it('strips a trailing slash from cdnURL to avoid `https://origin//api`', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com/' },
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
      },
    }
    const hook = await runPluginSetup()
    expect(simulateRequest(hook!, '/api/_nuxt_icon/ph.json').request)
      .toBe('https://app.example.com/api/_nuxt_icon/ph.json')
  })

  it('leaves non-matching relative requests untouched', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
      },
    }
    const hook = await runPluginSetup()
    expect(simulateRequest(hook!, '/api/drupal-ce/node/42').request).toBe('/api/drupal-ce/node/42')
    expect(simulateRequest(hook!, '/favicon.ico').request).toBe('/favicon.ico')
  })

  it('leaves absolute URLs untouched', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
      },
    }
    const hook = await runPluginSetup()
    expect(simulateRequest(hook!, 'https://somewhere.else/api/_nuxt_icon/ph.json').request)
      .toBe('https://somewhere.else/api/_nuxt_icon/ph.json')
  })

  it('respects an explicit absolute caller-provided baseURL', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
      },
    }
    const hook = await runPluginSetup()
    // Caller intentionally targeting another origin via an http(s)
    // baseURL — we shouldn't second-guess them.
    const ctx = simulateRequest(hook!, '/api/_nuxt_icon/ph.json', { baseURL: 'https://explicit.example' })
    expect(ctx.request).toBe('/api/_nuxt_icon/ph.json')
    expect(ctx.options.baseURL).toBe('https://explicit.example')
  })

  it('matches with startsWith — custom prefixes can be added', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/my-custom-route/'] },
      },
    }
    const hook = await runPluginSetup()
    expect(simulateRequest(hook!, '/api/my-custom-route/foo').request)
      .toBe('https://app.example.com/api/my-custom-route/foo')
    expect(simulateRequest(hook!, '/api/other/foo').request).toBe('/api/other/foo')
  })

  describe('$fetch.native wrap', () => {
    it('rebinds $fetch.native so captured references see the rewrite', async () => {
      state.runtimeConfig = {
        app: { cdnURL: 'https://app.example.com' },
        public: {
          componentPreview: true,
          nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
        },
      }
      await runPluginSetup()
      // Simulate a module (e.g. @nuxt/icon) capturing $fetch.native AFTER
      // our plugin ran and calling it with a matching relative path.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const captured = ((globalThis as any).$fetch as any).native as NativeFetch
      await captured('/api/_nuxt_icon/ph.json')
      expect(state.nativeCalls).toHaveLength(1)
      expect(state.nativeCalls[0]!.input).toBe('https://app.example.com/api/_nuxt_icon/ph.json')
    })

    it('leaves non-matching relative requests untouched on native fetch', async () => {
      state.runtimeConfig = {
        app: { cdnURL: 'https://app.example.com' },
        public: {
          componentPreview: true,
          nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
        },
      }
      await runPluginSetup()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const captured = ((globalThis as any).$fetch as any).native as NativeFetch
      await captured('/api/other/thing.json')
      expect(state.nativeCalls[0]!.input).toBe('/api/other/thing.json')
    })

    it('leaves absolute URLs untouched on native fetch', async () => {
      state.runtimeConfig = {
        app: { cdnURL: 'https://app.example.com' },
        public: {
          componentPreview: true,
          nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
        },
      }
      await runPluginSetup()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const captured = ((globalThis as any).$fetch as any).native as NativeFetch
      await captured('https://somewhere.else/api/_nuxt_icon/ph.json')
      expect(state.nativeCalls[0]!.input).toBe('https://somewhere.else/api/_nuxt_icon/ph.json')
    })
  })
})
