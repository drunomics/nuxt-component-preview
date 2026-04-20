import { defineNuxtPlugin, useRuntimeConfig } from '#imports'

/**
 * Reroute `$fetch` calls to specific path prefixes so they hit the Nuxt
 * app's own origin (`config.app.cdnURL`) instead of the embedding
 * document's origin.
 *
 * Why: Nuxt's chunk loader already respects `app.cdnURL` for `/_nuxt/*`
 * asset loads, but plain `$fetch('/...')` calls in third-party modules
 * (for example `@nuxtjs/i18n`'s `messages.json` loader, or any module
 * that hits its own Nitro server routes) go straight to `fetch` with a
 * relative URL. In a component-preview deployment the embedding
 * document lives on a different origin than the Nuxt app, so those
 * relative URLs resolve against the embedder — not the Nuxt app — and
 * the fetch fails.
 *
 * This plugin installs an ofetch `onRequest` hook that rewrites `$fetch`
 * requests whose URL starts with one of the configured path prefixes to
 * use `app.cdnURL` as the base URL. Untouched when:
 *   - `app.cdnURL` is empty (standalone Nuxt deployment)
 *   - the configured path list is empty (opted out)
 *   - the request URL is already absolute
 *   - the request path doesn't match any configured prefix
 *
 * Limitation: the hook operates at the ofetch layer. Modules that use
 * `$fetch.native` (the raw platform `fetch`) bypass ofetch entirely and
 * therefore bypass this interceptor too — those modules need their own
 * cdnURL handling at the call site.
 */
export default defineNuxtPlugin({
  name: 'nuxt-component-preview:cdn-fetch-paths',
  enforce: 'pre',
  setup() {
    if (!import.meta.client) return

    const config = useRuntimeConfig()
    const cdnURL = config.app?.cdnURL?.replace(/\/$/, '') ?? ''
    if (!cdnURL) return

    const paths
      = (config.public as { componentPreview?: { cdnFetchPaths?: string[] } })
        .componentPreview?.cdnFetchPaths ?? []
    if (!paths.length) return

    const original = globalThis.$fetch
    if (!original) return

    globalThis.$fetch = original.create({
      onRequest({ request, options }) {
        if (typeof request !== 'string' || !request.startsWith('/')) return
        if (!paths.some(prefix => request.startsWith(prefix))) return
        // ofetch ignores `baseURL` for absolute URLs; we've guarded for
        // that above, so the resolved URL becomes `${cdnURL}${request}`.
        options.baseURL = cdnURL
      },
    })
  },
})
