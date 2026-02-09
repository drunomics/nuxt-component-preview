export default defineNuxtConfig({
  modules: ['../src/module', 'nuxtjs-drupal-ce'],
  devtools: { enabled: true },
  sourcemap: true,
  experimental: {
    appManifest: false,
  },
  nitro: {
    routeRules: {
      // Allow CORS from anywhere for playground/development.
      '/nuxt-component-preview/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
        },
      },
      '/_nuxt/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
        },
      },
    },
  },
  vite: {
    server: {
      cors: true,
    },
  },
  componentPreview: {
    componentIndex: {
      exclude: {
        // Test-only component for stream-wrapper-uri (not yet supported by Canvas)
        components: ['TestSchemaRefFile'],
      },
    },
  },
  drupalCe: {
    drupalBaseUrl: 'http://example.com',
  },
})
