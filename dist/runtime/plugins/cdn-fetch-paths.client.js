import { defineNuxtPlugin, useRuntimeConfig } from "#imports";
export default defineNuxtPlugin({
  name: "nuxt-component-preview:cdn-fetch-paths",
  enforce: "pre",
  setup() {
    const config = useRuntimeConfig();
    const pub = config.public;
    if (pub.componentPreviewActive !== true && pub.componentPreview !== true) return;
    const cdnURL = config.app?.cdnURL?.replace(/\/$/, "") ?? "";
    if (!cdnURL) return;
    const paths = config.public.nuxtComponentPreview?.cdnFetchPaths ?? [];
    if (!paths.length) return;
    const original = globalThis.$fetch;
    if (!original) return;
    globalThis.$fetch = original.create({
      onRequest(ctx) {
        if (typeof ctx.request !== "string" || !ctx.request.startsWith("/")) return;
        if (!paths.some((prefix) => ctx.request.startsWith(prefix))) return;
        const ob = ctx.options.baseURL;
        if (typeof ob === "string" && /^https?:\/\//i.test(ob)) return;
        ctx.request = cdnURL + ctx.request;
      }
    });
    const originalNative = globalThis.$fetch.native;
    if (originalNative) {
      globalThis.$fetch.native = function(input, init) {
        if (typeof input === "string" && input.startsWith("/")) {
          if (paths.some((prefix) => input.startsWith(prefix))) {
            input = cdnURL + input;
          }
        }
        return originalNative.call(this, input, init);
      };
    }
  }
});
