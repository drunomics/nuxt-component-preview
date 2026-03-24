import fs from 'node:fs'
import { resolve } from 'node:path'
import { defineNuxtModule, addPlugin, createResolver, addComponent, addServerHandler, addImports } from '@nuxt/kit'

// Module options TypeScript interface definition
export interface CategoryDirectoryOptions {
  directory: true
  fallback?: string // Falls back to root folder name if not specified
}

export interface ModuleOptions {
  componentIndex?: {
    enabled?: boolean
    category?: string | CategoryDirectoryOptions
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
        from: resolver.resolve('./runtime/types/canvas'),
        type: true,
      },
      {
        name: 'CanvasVideo',
        from: resolver.resolve('./runtime/types/canvas'),
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

    // Resolve entry path for dev.
    // Vite serves files relative to the project root, so we need to
    // convert the absolute appDir to a path relative to rootDir.
    // Append buildId as cache buster so browser refetches after restart.
    if (nuxt.options.dev) {
      nuxt.hook('ready', () => {
        const appDir = nuxt.options.appDir.replace(/\/+$/, '')
        const rootDir = nuxt.options.rootDir.replace(/\/+$/, '')
        const relativeAppDir = appDir.startsWith(rootDir)
          ? appDir.slice(rootDir.length + 1)
          : appDir
        const buildId = nuxt.options.appConfig?.nuxt?.buildId
        resolvedEntryPath = `/_nuxt/${relativeAppDir}/entry.js` + (buildId ? `?v=${buildId}` : '')
      })
    }

    // Production builds: capture entry path from build:manifest
    // This runs during the Vite client build, BEFORE Nitro bundles the virtual module
    if (!nuxt.options.dev) {
      nuxt.hook('build:manifest', (manifest) => {
        // Try isEntry property first (Vite manifest standard)
        let entryChunk = Object.values(manifest).find((chunk: { isEntry?: boolean }) => chunk.isEntry)
        // Fallback: find by key name containing 'entry' (Nuxt <4.2 compatibility)
        if (!entryChunk) {
          const entryKey = Object.keys(manifest).find(key => key.includes('entry'))
          if (entryKey) {
            entryChunk = manifest[entryKey]
          }
        }
        if (entryChunk && 'file' in entryChunk) {
          resolvedEntryPath = `/_nuxt/${(entryChunk as { file: string }).file}`
        }
      })
    }

    // Configure Nitro
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.virtual = nitroConfig.virtual || {}
      nitroConfig.virtual['#nuxt-entry-path'] = () => {
        return `export default '${resolvedEntryPath}'`
      }

      // Only prerender app-loader.js for static generation (nuxt generate).
      // For server builds, the handler must run dynamically to determine
      // the correct origin from the request URL.
      if (nuxt.options._generate) {
        nitroConfig.prerender = nitroConfig.prerender || {}
        nitroConfig.prerender.routes = nitroConfig.prerender.routes || []
        nitroConfig.prerender.routes.push('/nuxt-component-preview/app-loader.js')
      }
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
      // Write config to a file so the server handler can read it and
      // generate the component index. In dev mode, the file is updated on
      // each templatesGenerated hook so new/removed components are picked
      // up immediately. In production, it is written once and used during
      // prerendering.
      const configPath = resolve(nuxt.options.buildDir, 'nuxt-component-preview-config.json')

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

        // Pass component objects directly with proper names resolved by Nuxt
        const components = globalComponents
          .filter(c => !c.filePath.includes('node_modules'))
          .map(c => ({
            pascalName: c.pascalName,
            kebabName: c.kebabName,
            filePath: c.filePath,
            shortPath: c.shortPath,
            global: c.global,
          }))

        // Write config to file for the server handler to generate from.
        fs.writeFileSync(configPath, JSON.stringify({
          components,
          tsconfigPath: resolve(nuxt.options.rootDir, 'tsconfig.json'),
          options: indexOptions,
        }))
      })

      nuxt.hook('nitro:config', (nitroConfig) => {
        nitroConfig.virtual = nitroConfig.virtual || {}
        nitroConfig.virtual['#nuxt-component-preview-config-path'] = () => {
          return `export default ${JSON.stringify(configPath)}`
        }
      })

      if (nuxt.options.dev || nuxt.options._generate) {
        // Dev: handler for live generation on each request.
        // SSG (nuxt generate): handler needed for prerendering.
        addServerHandler({
          route: '/nuxt-component-preview/component-index.json',
          handler: resolver.resolve('./runtime/server/routes/nuxt-component-preview/component-index.json.get'),
        })

        if (nuxt.options._generate) {
          nuxt.hook('nitro:config', (nitroConfig) => {
            nitroConfig.prerender = nitroConfig.prerender || {}
            nitroConfig.prerender.routes = nitroConfig.prerender.routes || []
            nitroConfig.prerender.routes.push('/nuxt-component-preview/component-index.json')
          })
        }
      }
      else {
        // SSR production: generate the component-index at build time and
        // write it as a static file. No handler registered, so
        // vue-component-meta and TypeScript (~9MB) stay out of the bundle.
        nuxt.hook('nitro:build:public-assets', async (nitro) => {
          const { prepareComponentIndex } = await import('./runtime/server/utils/prepareComponentIndex')
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
          const indexData = prepareComponentIndex(config)
          if (indexData) {
            const outputDir = resolve(nitro.options.output.publicDir, 'nuxt-component-preview')
            fs.mkdirSync(outputDir, { recursive: true })
            fs.writeFileSync(resolve(outputDir, 'component-index.json'), JSON.stringify(indexData))
          }
        })
      }
    }
  },
})
