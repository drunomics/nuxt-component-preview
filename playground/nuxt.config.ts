export default defineNuxtConfig({
  modules: ['../src/module'],
  devtools: { enabled: true },
  vite: {
    server: {
      cors: {
        origin: ['http://xb-dev.ddev.site'],
      },
    },
  },
  nitro: {
    routeRules: {
      '/nuxt-component-preview/entry.js': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': 'http://xb-dev.ddev.site',
          'Access-Control-Allow-Methods': 'GET',
        },
      },
      '/_nuxt/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': 'http://xb-dev.ddev.site',
          'Access-Control-Allow-Methods': 'GET',
        },
      },
    },
  },
  sourcemap: true,
  ssr: false, // Disable server-side rendering
})
