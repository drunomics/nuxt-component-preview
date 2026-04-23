/**
 * Unit tests for the `cdnFetchPaths` client plugin. Stubs
 * `useRuntimeConfig` via `mockNuxtImport` and captures the `onRequest`
 * hook passed to `$fetch.create` to observe the resulting `baseURL`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

type OnRequestHook = (ctx: { request: string, options: { baseURL?: string } }) => void

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
} = {
  runtimeConfig: { app: {}, public: {} },
  capturedOnRequest: null,
}

mockNuxtImport('useRuntimeConfig', () => {
  return () => state.runtimeConfig
})

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
  // `defineNuxtPlugin({ setup })` returns the setup fn itself (decorated).
  const plugin = (mod as { default: (nuxtApp?: unknown) => void | Promise<void> }).default
  await plugin()
  return state.capturedOnRequest
}

function simulateRequest(hook: OnRequestHook, request: string): string | undefined {
  const options: { baseURL?: string } = {}
  hook({ request, options })
  return options.baseURL
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
    expect(simulateRequest(hook!, '/api/_nuxt_icon/ph.json'))
      .toBe('https://app.example.com')
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
    expect(simulateRequest(hook!, '/api/_nuxt_icon/ph.json'))
      .toBe('https://app.example.com')
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

  it('applies cdnURL as baseURL for matching path prefixes', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/', '/_i18n/'] },
      },
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
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
      },
    }
    const hook = await runPluginSetup()
    expect(simulateRequest(hook!, '/api/_nuxt_icon/ph.json'))
      .toBe('https://app.example.com')
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
    expect(simulateRequest(hook!, '/api/drupal-ce/node/42')).toBeUndefined()
    expect(simulateRequest(hook!, '/favicon.ico')).toBeUndefined()
  })

  it('leaves absolute URLs untouched (ofetch ignores baseURL for those, but we also early-return)', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
      },
    }
    const hook = await runPluginSetup()
    expect(simulateRequest(hook!, 'https://somewhere.else/api/_nuxt_icon/ph.json'))
      .toBeUndefined()
  })

  it('respects a caller-provided options.baseURL', async () => {
    state.runtimeConfig = {
      app: { cdnURL: 'https://app.example.com' },
      public: {
        componentPreview: true,
        nuxtComponentPreview: { cdnFetchPaths: ['/api/_nuxt_icon/'] },
      },
    }
    const hook = await runPluginSetup()
    // A matching path that already has an explicit baseURL should be left alone.
    const options: { baseURL?: string } = { baseURL: 'https://explicit.example' }
    hook!({ request: '/api/_nuxt_icon/ph.json', options })
    expect(options.baseURL).toBe('https://explicit.example')
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
    expect(simulateRequest(hook!, '/api/my-custom-route/foo')).toBe('https://app.example.com')
    expect(simulateRequest(hook!, '/api/other/foo')).toBeUndefined()
  })
})
