import { defineNuxtPlugin, useRuntimeConfig } from '#imports'

/**
 * Wraps `globalThis.$fetch` so requests whose path starts with a
 * configured `cdnFetchPaths` prefix use `app.cdnURL` as the base URL.
 * Modules using `$fetch.native` bypass ofetch and are not intercepted.
 */
export default defineNuxtPlugin({
  name: 'nuxt-component-preview:cdn-fetch-paths',
  enforce: 'pre',
  setup() {
    const config = useRuntimeConfig()
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
        if (!paths.some(prefix => request.startsWith(prefix))) return
        options.baseURL = cdnURL
      },
    })
  },
})
