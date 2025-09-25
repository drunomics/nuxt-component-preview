export default defineNuxtConfig({
  modules: ['../src/module'],
  devtools: { enabled: true },
  sourcemap: true,
  experimental: {
    appManifest: false,
  },
})
