import { defineNuxtPlugin, useRuntimeConfig } from '#imports'

/**
 * `$fetch` override for component previews.
 *
 * In a preview the Nuxt app runs inside an embedder document, so
 * relative `$fetch('/...')` calls from modules like `@nuxtjs/i18n` or
 * `@nuxt/icon` resolve against the embedder instead of Nitro. This
 * plugin wraps `globalThis.$fetch` and rewrites requests matching a
 * configured `cdnFetchPaths` prefix to use `app.cdnURL` as base URL.
 *
 * Gated on `config.public.componentPreview` so regular Nuxt pages are
 * untouched (their document origin is already the Nuxt origin).
 *
 * `$fetch.native` callers bypass ofetch and are not intercepted.
 */
export default defineNuxtPlugin({
  name: 'nuxt-component-preview:cdn-fetch-paths',
  enforce: 'pre',
  setup() {
    const config = useRuntimeConfig()
    // Only active when component preview is active.
    if (!config.public.componentPreview) return

    const cdnURL = config.app?.cdnURL?.replace(/\/$/, '') ?? ''
    if (!cdnURL) return

    const paths
      = (config.public as { nuxtComponentPreview?: { cdnFetchPaths?: string[] } })
        .nuxtComponentPreview?.cdnFetchPaths ?? []
    if (!paths.length) return

    const original = globalThis.$fetch
    if (!original) return

    globalThis.$fetch = original.create({
      onRequest({ request, options }) {
        if (typeof request !== 'string' || !request.startsWith('/')) return
        // Respect a caller- or upstream-interceptor-provided baseURL.
        if (options.baseURL) return
        if (!paths.some(prefix => request.startsWith(prefix))) return
        options.baseURL = cdnURL
      },
    })
  },
})
