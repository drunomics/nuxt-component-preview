export default defineNuxtConfig({
  modules: ['../src/module'],
  devtools: { enabled: true },
  sourcemap: true,
  experimental: {
    appManifest: false,
  },
  nitro: {
    routeRules: {
      '/nuxt-component-preview/*.js': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': 'https://xb-dev.ddev.site',
          'Access-Control-Allow-Methods': 'GET',
        },
      },
      '/_nuxt/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': 'https://xb-dev.ddev.site',
          'Access-Control-Allow-Methods': 'GET',
        },
      },
    },
  },
  vite: {
    server: {
      cors: {
        origin: ['https://xb-dev.ddev.site'],
      },
    },
  },
})
