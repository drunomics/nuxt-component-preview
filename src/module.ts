import { defineNuxtModule, addPlugin, createResolver, addComponent, addServerHandler } from '@nuxt/kit'

// Module options TypeScript interface definition
export interface ModuleOptions {
  // Component preview is controlled via runtime config, not module options
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-component-preview',
    configKey: 'componentPreview',
  },
  // Default configuration options of the Nuxt module
  defaults: {},
  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Add the component preview area component
    addComponent({
      name: 'ComponentPreviewArea',
      filePath: resolver.resolve('./runtime/components/ComponentPreviewArea.vue')
    })

    // Add the client-side plugin for component preview functionality
    addPlugin({
      src: resolver.resolve('./runtime/plugin.client.ts'),
      mode: 'client'
    })

    // Add router options for iframe compatibility
    nuxt.hook('pages:routerOptions', (options) => {
      options.files.push({
        path: resolver.resolve('./runtime/router.options.ts'),
        optional: true
      })
    })

    // Add server route for entry.js redirect
    addServerHandler({
      route: '/nuxt-component-preview/entry.js',
      handler: resolver.resolve('./runtime/server/routes/nuxt-component-preview/entry.js.get.ts')
    })

    // Don't set any default runtime config - only enabled via static HTML when needed
  },
})
