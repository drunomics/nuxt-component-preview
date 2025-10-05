import fs from 'node:fs'
import { resolve } from 'node:path'
import { defineNuxtModule, addPlugin, createResolver, addComponent, addServerHandler, addTemplate } from '@nuxt/kit'

// Module options TypeScript interface definition
export interface ModuleOptions {
  componentIndex?: {
    enabled?: boolean
    category?: string
    status?: 'experimental' | 'stable' | 'deprecated' | 'obsolete'
    exclude?: {
      components?: string[]
      directories?: string[]
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
      exclude: {
        components: ['*--default'],
        directories: [],
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
      handler: resolver.resolve('./runtime/server/routes/nuxt-component-preview/entry.js.get'),
    })

    // Add server handler directly - use runtime handler that gets actual runtime config
    addServerHandler({
      route: '/nuxt-component-preview/app-loader.js',
      handler: resolver.resolve('./runtime/server/api/app-loader.js.get'),
    })

    // Generate component index if enabled
    if (options.componentIndex!.enabled) {
      let componentIndexData: any = null

      nuxt.hook('app:templatesGenerated', async () => {
        const { generateComponentIndex } = await import('./runtime/server/utils/generateComponentIndex')
        const { resolve: resolvePath } = await import('path')

        const globalComponents = nuxt.apps.default.components.filter(c => c.global)

        if (globalComponents.length > 0) {
          const tsconfigPath = resolvePath(nuxt.options.rootDir, 'tsconfig.json')
          componentIndexData = generateComponentIndex(
            globalComponents,
            tsconfigPath,
            {
              category: options.componentIndex!.category,
              status: options.componentIndex!.status,
              excludeDirectories: options.componentIndex!.exclude!.directories,
              excludeComponents: options.componentIndex!.exclude!.components,
              overrides: options.componentIndex!.overrides,
            }
          )

          // Write to source public directory for dev mode
          const { writeFile, mkdir } = await import('fs/promises')
          const publicDir = resolvePath(nuxt.options.rootDir, nuxt.options.dir?.public || 'public')
          const devOutputPath = resolvePath(publicDir, 'nuxt-component-preview/component-index.json')
          await mkdir(resolvePath(publicDir, 'nuxt-component-preview'), { recursive: true })
          await writeFile(devOutputPath, JSON.stringify(componentIndexData, null, 2))
        }
      })

      // Add as Nitro public asset
      nuxt.hook('nitro:build:public-assets', async (nitro) => {
        if (componentIndexData) {
          const { writeFile, mkdir } = await import('fs/promises')
          const { resolve: resolvePath } = await import('path')

          const outputPath = resolvePath(nitro.options.output.publicDir, 'nuxt-component-preview/component-index.json')
          await mkdir(resolvePath(nitro.options.output.publicDir, 'nuxt-component-preview'), { recursive: true })
          await writeFile(outputPath, JSON.stringify(componentIndexData, null, 2))
        }
      })
    }
  },
})
