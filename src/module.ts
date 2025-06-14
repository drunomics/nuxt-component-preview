import fs from 'node:fs'
import { resolve } from 'node:path'
import { defineNuxtModule, addPlugin, createResolver, addComponent, addServerHandler } from '@nuxt/kit'

// Module options TypeScript interface definition
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
    let resolvedEntryPath = ''

    // Add the component preview area component
    addComponent({
      name: 'ComponentPreviewArea',
      filePath: resolver.resolve('./runtime/components/ComponentPreviewArea.vue'),
    })

    // Add the client-side plugin for component preview functionality
    addPlugin({
      src: resolver.resolve('./runtime/plugin.client.ts'),
      mode: 'client',
    })

    // Add router options for iframe compatibility
    nuxt.hook('pages:routerOptions', (options) => {
      options.files.push({
        path: resolver.resolve('./runtime/router.options.ts'),
        optional: true,
      })
    })

    // Resolve entry path for dev
    if (nuxt.options.dev) {
      nuxt.hook('ready', () => {
        const appDir = nuxt.options.appDir
        resolvedEntryPath = `/_nuxt${appDir}/entry.js`
      })
    }

    // Configure Nitro
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.virtual = nitroConfig.virtual || {}
      nitroConfig.virtual['#nuxt-entry-path'] = () => {
        return `export default '${resolvedEntryPath}'`
      }

      nuxt.hook('nitro:build:public-assets', async (nitro) => {
        if (!nuxt.options.dev) {
          try {
            const manifestPath = resolve(nuxt.options.buildDir, 'dist/server/client.manifest.json')
            const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8')
            const manifest = JSON.parse(manifestContent)
            const entryKey = Object.keys(manifest).find(key => key.includes('entry'))
            if (!entryKey || !manifest[entryKey]) {
              console.error('Entry file not found in client manifest')
              throw new Error('Entry file not found in client manifest')
            }
            resolvedEntryPath = `/_nuxt/${manifest[entryKey].file}`
            nitro.options.virtual['#nuxt-entry-path'] = () => `export default '${resolvedEntryPath}'`
          }
          catch (error) {
            console.error('CRITICAL: Failed to resolve Nuxt entry path:', error)
            throw error
          }
        }
      })
    })

    addServerHandler({
      route: '/nuxt-component-preview/entry.js',
      handler: resolver.resolve('./runtime/server/routes/nuxt-component-preview/entry.js.get.ts'),
    })
  },
})
