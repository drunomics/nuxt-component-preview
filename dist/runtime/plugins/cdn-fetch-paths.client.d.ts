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
declare const _default: import("nuxt/app").Plugin<Record<string, unknown>> & import("nuxt/app").ObjectPlugin<Record<string, unknown>>;
export default _default;
