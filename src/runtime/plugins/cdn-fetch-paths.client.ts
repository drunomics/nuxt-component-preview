import { defineNuxtPlugin, useRuntimeConfig } from '#imports'

/**
 * `$fetch` / `$fetch.native` override for component previews.
 *
 * In a preview the Nuxt app runs inside an embedder document, so
 * relative `$fetch('/...')` calls from modules like `@nuxtjs/i18n` or
 * `@nuxt/icon` resolve against the embedder instead of Nitro. This
 * plugin rewrites matching relative URLs to an absolute URL at
 * `app.cdnURL`.
 *
 * Covers two paths:
 *  - `globalThis.$fetch` (ofetch): an `onRequest` hook that rewrites
 *    `ctx.request` to an absolute URL. Making the URL absolute
 *    sidesteps any baseURL merging (including the default baseURL that
 *    Nuxt bakes into its global ofetch instance via
 *    `$fetch.create({ baseURL })`, which would otherwise shadow the
 *    rewrite if we only set `options.baseURL`).
 *  - `globalThis.$fetch.native`: modules using the raw platform fetch
 *    (e.g. `@nuxt/icon` via `Kf.setFetch($fetch.native)`) bypass ofetch
 *    and any onRequest hook above. We rebind `.native` so callers
 *    capturing it after our `enforce: 'pre'` runs get the rewriting
 *    variant.
 *
 * An explicit absolute (`http://` / `https://`) caller-provided
 * `options.baseURL` is respected — we only rewrite when the effective
 * baseURL is the Nuxt-default (empty or `/`).
 *
 * Gated on `config.public.componentPreviewActive` (with legacy fallback
 * to `config.public.componentPreview === true`) so regular Nuxt pages
 * are untouched.
 */
export default defineNuxtPlugin({
  name: 'nuxt-component-preview:cdn-fetch-paths',
  enforce: 'pre',
  setup() {
    const config = useRuntimeConfig()
    const pub = config.public as { componentPreviewActive?: boolean, componentPreview?: unknown }
    if (pub.componentPreviewActive !== true && pub.componentPreview !== true) return

    const cdnURL = config.app?.cdnURL?.replace(/\/$/, '') ?? ''
    if (!cdnURL) return

    const paths
      = (config.public as { nuxtComponentPreview?: { cdnFetchPaths?: string[] } })
        .nuxtComponentPreview?.cdnFetchPaths ?? []
    if (!paths.length) return

    const original = globalThis.$fetch
    if (!original) return

    globalThis.$fetch = original.create({
      onRequest(ctx) {
        if (typeof ctx.request !== 'string' || !ctx.request.startsWith('/')) return
        if (!paths.some(prefix => (ctx.request as string).startsWith(prefix))) return
        // Respect an explicit absolute (http/https) baseURL — caller
        // targeted an external origin deliberately. A Nuxt-default
        // empty / "/" baseURL is not an override and still gets
        // rewritten below.
        const ob = ctx.options.baseURL
        if (typeof ob === 'string' && /^https?:\/\//i.test(ob)) return
        // Rewrite to an absolute URL so ofetch sidesteps any baseURL
        // merging.
        ctx.request = cdnURL + ctx.request
      },
    })

    const originalNative = globalThis.$fetch.native
    if (originalNative) {
      globalThis.$fetch.native = function (input, init) {
        if (typeof input === 'string' && input.startsWith('/')) {
          if (paths.some(prefix => input.startsWith(prefix))) {
            input = cdnURL + input
          }
        }
        return originalNative.call(this, input, init)
      }
    }
  },
})
