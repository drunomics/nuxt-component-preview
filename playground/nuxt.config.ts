export default defineNuxtConfig({
  modules: ['../src/module', 'nuxtjs-drupal-ce'],
  devtools: { enabled: true },
  sourcemap: true,
  // Required for SSG (nuxt generate) so the prerendered app-loader.js
  // contains the correct absolute URL for loading _nuxt/ assets.
  // Uncomment and set to the URL where the static output will be served.
  // app: {
  //   cdnURL: 'http://localhost:3000',
  // },
  experimental: {
    appManifest: false,
  },
  componentPreview: {
    componentIndex: {
      exclude: {
        // Test-only component for stream-wrapper-uri (not yet supported by Canvas)
        components: ['TestSchemaRefFile'],
      },
    },
  },
  // nuxtjs-drupal-ce handles CORS configuration for cross-origin component
  // preview embedding. Set drupalBaseUrl to the Drupal backend URL that will
  // embed the previews - the module automatically allows this origin for CORS.
  drupalCe: {
    drupalBaseUrl: 'http://example.com',
  },
})
