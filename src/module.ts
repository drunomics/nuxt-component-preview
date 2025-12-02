import fs from 'node:fs'
import { resolve } from 'node:path'
import { defineNuxtModule, addPlugin, createResolver, addComponent, addServerHandler } from '@nuxt/kit'

// Module options TypeScript interface definition
export interface ModuleOptions {
  componentIndex?: {
    enabled?: boolean
    category?: string
    status?: 'experimental' | 'stable' | 'deprecated' | 'obsolete'
    includePackages?: boolean | string[] // false = exclude all (default), array = include only these
    exclude?: {
      components?: string[]
      directories?: string[] // Path patterns only (not packages)
    }
    overrides?: Record<string, {
      category?: string
      status?: 'experimental' | 'stable' | 'deprecated' | 'obsolete'
    }>
  }
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-component-preview',
    configKey: 'componentPreview',
  },
  defaults: {
    componentIndex: {
      enabled: true,
      category: 'Nuxt Components',
      status: 'stable',
      includePackages: false, // By default, exclude all packages from node_modules
      exclude: {
        components: ['*--default', 'drupal-*'],
        directories: [], // Path patterns only
      },
      overrides: {},
    },
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    let resolvedEntryPath = ''

    // Add the component preview area component
    addComponent({
      name: 'ComponentPreviewArea',
      filePath: resolver.resolve('./runtime/components/ComponentPreviewArea.vue'),
    })

    // Add the client-side plugin for component preview functionality
    addPlugin({
      src: resolver.resolve('./runtime/plugin.client'),
      mode: 'client',
    })

    // Add router options for iframe compatibility
    nuxt.hook('pages:routerOptions', (options) => {
      options.files.push({
        path: resolver.resolve('./runtime/router.options'),
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
          // Nuxt >=4.2 uses client.manifest.mjs, Nuxt <4.2 uses client.manifest.json
          const manifestPathMjs = resolve(nuxt.options.buildDir, 'dist/server/client.manifest.mjs')
          const manifestPathJson = resolve(nuxt.options.buildDir, 'dist/server/client.manifest.json')
          let manifest = null

          if (fs.existsSync(manifestPathMjs)) {
            try {
              const manifestModule = await import(manifestPathMjs)
              manifest = manifestModule.default || manifestModule
            }
            catch (error) {
              console.error('[nuxt-component-preview] Failed to load client.manifest.mjs:', error)
            }
          }
          else if (fs.existsSync(manifestPathJson)) {
            try {
              const manifestContent = await fs.promises.readFile(manifestPathJson, 'utf-8')
              manifest = JSON.parse(manifestContent)
            }
            catch (error) {
              console.error('[nuxt-component-preview] Failed to load client.manifest.json:', error)
            }
          }
          else {
            console.error('[nuxt-component-preview] Client manifest not found. Component preview will not work in production.')
          }

          if (manifest) {
            const entryKey = Object.keys(manifest).find(key => key.includes('entry'))
            if (entryKey && manifest[entryKey]) {
              resolvedEntryPath = `/_nuxt/${manifest[entryKey].file}`
              nitro.options.virtual['#nuxt-entry-path'] = () => `export default '${resolvedEntryPath}'`
            }
            else {
              console.error('[nuxt-component-preview] Entry file not found in client manifest')
            }
          }
        }
      })
    })

    addServerHandler({
      route: '/nuxt-component-preview/entry.js',
      handler: resolver.resolve('./runtime/server/routes/nuxt-component-preview/entry.js.get'),
    })

    // Add server handler directly - use runtime handler that gets actual runtime config
    addServerHandler({
      route: '/nuxt-component-preview/app-loader.js',
      handler: resolver.resolve('./runtime/server/api/app-loader.js.get'),
    })

    // Generate component index if enabled
    if (options.componentIndex!.enabled) {
      let componentIndexData: import('./runtime/server/utils/generateComponentIndex').ComponentIndexData | null = null

      nuxt.hook('app:templatesGenerated', async () => {
        try {
          const { generateComponentIndex } = await import('./runtime/server/utils/generateComponentIndex')
          const { resolve: resolvePath } = await import('node:path')

          const globalComponents = nuxt.apps.default.components.filter(c => c.global)

          if (globalComponents.length > 0) {
            const tsconfigPath = resolvePath(nuxt.options.rootDir, 'tsconfig.json')
            componentIndexData = generateComponentIndex(
              globalComponents,
              tsconfigPath,
              {
                category: options.componentIndex!.category,
                status: options.componentIndex!.status,
                includePackages: options.componentIndex!.includePackages,
                excludeDirectories: options.componentIndex!.exclude!.directories,
                excludeComponents: options.componentIndex!.exclude!.components,
                overrides: options.componentIndex!.overrides,
              },
            )
          }
        }
        catch (error) {
          console.error('[nuxt-component-preview] Error generating component index:', error)
          // Set to null so HTTP endpoint returns error status code
          componentIndexData = null
        }
      })

      // Serve via Nitro route (both dev and production)
      nuxt.hook('nitro:config', (nitroConfig) => {
        nitroConfig.virtual = nitroConfig.virtual || {}
        nitroConfig.virtual['#nuxt-component-preview-index-data'] = () => {
          return `export default ${JSON.stringify(componentIndexData)}`
        }
      })

      addServerHandler({
        route: '/nuxt-component-preview/component-index.json',
        handler: resolver.resolve('./runtime/server/routes/nuxt-component-preview/component-index.json.get'),
      })
    }
  },
})
