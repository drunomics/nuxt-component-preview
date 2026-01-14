import { resolve } from 'node:path'
import { defineNuxtModule, addPlugin, createResolver, addComponent, addServerHandler, addImports } from '@nuxt/kit'

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

    // Auto-import Canvas types for component props
    addImports([
      {
        name: 'CanvasImage',
        from: resolver.resolve('./types/canvas'),
        type: true,
      },
      {
        name: 'CanvasVideo',
        from: resolver.resolve('./types/canvas'),
        type: true,
      },
    ])

    // Check if nuxtjs-drupal-ce module is installed
    const hasDrupalCe = nuxt.options.modules?.some(m =>
      typeof m === 'string' && m.includes('nuxtjs-drupal-ce'),
    )

    // Add the appropriate component preview area component variant
    addComponent({
      name: 'ComponentPreviewArea',
      filePath: hasDrupalCe
        ? resolver.resolve('./runtime/components/ComponentPreviewAreaDrupalCe.vue')
        : resolver.resolve('./runtime/components/ComponentPreviewAreaVanilla.vue'),
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
    else {
      // For production builds, resolve entry path from manifest before Nitro build
      nuxt.hook('build:manifest', (manifest) => {
        // Try isEntry property first (Vite manifest standard)
        let entryChunk = Object.values(manifest).find((chunk: { isEntry?: boolean }) => chunk.isEntry)
        // Fallback: find by key name containing 'entry' (for older Nuxt versions)
        if (!entryChunk) {
          const entryKey = Object.keys(manifest).find(key => key.includes('entry'))
          if (entryKey) {
            entryChunk = manifest[entryKey]
          }
        }
        if (entryChunk && 'file' in entryChunk) {
          resolvedEntryPath = `/_nuxt/${(entryChunk as { file: string }).file}`
        }
        else {
          console.error('[nuxt-component-preview] Entry file not found in client manifest')
        }
      })
    }

    // Configure Nitro
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.virtual = nitroConfig.virtual || {}
      nitroConfig.virtual['#nuxt-entry-path'] = () => {
        return `export default '${resolvedEntryPath}'`
      }

      // Prerender preview assets for static builds (nuxt generate)
      nitroConfig.prerender = nitroConfig.prerender || {}
      nitroConfig.prerender.routes = nitroConfig.prerender.routes || []
      nitroConfig.prerender.routes.push('/nuxt-component-preview/app-loader.js')
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

      // Shared config for component index preparation
      let indexConfig: import('./runtime/server/utils/prepareComponentIndex').PrepareComponentIndexConfig | null = null

      // Build index options once from module config
      const indexOptions = {
        category: options.componentIndex!.category!,
        status: options.componentIndex!.status!,
        includePackages: options.componentIndex!.includePackages,
        excludeDirectories: options.componentIndex!.exclude!.directories,
        excludeComponents: options.componentIndex!.exclude!.components,
        overrides: options.componentIndex!.overrides,
      }

      nuxt.hook('app:templatesGenerated', async () => {
        const globalComponents = nuxt.apps.default.components.filter(c => c.global)

        // Extract unique directories from global components
        const componentDirs = new Set<string>()
        for (const component of globalComponents) {
          if (component.filePath.includes('node_modules')) continue
          const dirPath = component.filePath.substring(0, component.filePath.lastIndexOf('/'))
          componentDirs.add(dirPath)
        }

        // Build shared config
        indexConfig = {
          componentDirs: Array.from(componentDirs),
          tsconfigPath: resolve(nuxt.options.rootDir, 'tsconfig.json'),
          options: indexOptions,
        }

        // Generate index at build time (for production)
        if (!nuxt.options.dev) {
          const { prepareComponentIndex } = await import('./runtime/server/utils/prepareComponentIndex')
          componentIndexData = prepareComponentIndex(indexConfig)
        }
      })

      // Serve via Nitro route (both dev and production)
      nuxt.hook('nitro:config', (nitroConfig) => {
        nitroConfig.virtual = nitroConfig.virtual || {}
        // Production: serve pre-generated index
        nitroConfig.virtual['#nuxt-component-preview-index-data'] = () => {
          return `export default ${JSON.stringify(componentIndexData)}`
        }
        // Dev mode: provide config for on-the-fly regeneration
        nitroConfig.virtual['#nuxt-component-preview-dev-config'] = () => {
          return `export default ${nuxt.options.dev ? JSON.stringify(indexConfig) : 'null'}`
        }
        // Prerender component-index.json for static builds (nuxt generate)
        nitroConfig.prerender = nitroConfig.prerender || {}
        nitroConfig.prerender.routes = nitroConfig.prerender.routes || []
        nitroConfig.prerender.routes.push('/nuxt-component-preview/component-index.json')
      })

      addServerHandler({
        route: '/nuxt-component-preview/component-index.json',
        handler: resolver.resolve('./runtime/server/routes/nuxt-component-preview/component-index.json.get'),
      })
    }
  },
})
