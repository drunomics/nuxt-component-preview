import fs from 'node:fs';
import { resolve } from 'node:path';
import { defineNuxtModule, createResolver, addImports, addComponent, addPlugin, addServerHandler } from '@nuxt/kit';

const module$1 = defineNuxtModule({
  meta: {
    name: "nuxt-component-preview",
    configKey: "componentPreview"
  },
  defaults: {
    componentIndex: {
      enabled: true,
      category: "Nuxt Components",
      status: "stable",
      includePackages: false,
      // By default, exclude all packages from node_modules
      include: {
        directories: []
        // When set, only components in these directories are indexed
      },
      exclude: {
        components: ["*--default", "drupal-*"],
        directories: []
        // Path patterns only
      },
      overrides: {}
    },
    cdnFetchPaths: [
      "/nuxt-component-preview/",
      "/api/_nuxt_icon/",
      "/_i18n/"
    ]
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url);
    let resolvedEntryPath = "";
    let resolvedEntryCssPaths = [];
    addImports([
      {
        name: "CanvasImage",
        from: resolver.resolve("./runtime/types/canvas"),
        type: true
      },
      {
        name: "CanvasVideo",
        from: resolver.resolve("./runtime/types/canvas"),
        type: true
      }
    ]);
    const hasDrupalCe = nuxt.options.modules?.some(
      (m) => typeof m === "string" && m.includes("nuxtjs-drupal-ce")
    );
    addComponent({
      name: "ComponentPreviewArea",
      filePath: hasDrupalCe ? resolver.resolve("./runtime/components/ComponentPreviewAreaDrupalCe.vue") : resolver.resolve("./runtime/components/ComponentPreviewAreaVanilla.vue")
    });
    addPlugin({
      src: resolver.resolve("./runtime/plugin.client"),
      mode: "client"
    });
    const publicConfig = nuxt.options.runtimeConfig.public;
    const existingNuxtComponentPreview = publicConfig.nuxtComponentPreview ?? {};
    publicConfig.nuxtComponentPreview = {
      ...existingNuxtComponentPreview,
      cdnFetchPaths: options.cdnFetchPaths ?? []
    };
    addPlugin({
      src: resolver.resolve("./runtime/plugins/cdn-fetch-paths.client"),
      mode: "client"
    });
    nuxt.hook("pages:routerOptions", (options2) => {
      options2.files.push({
        path: resolver.resolve("./runtime/router.options"),
        optional: true
      });
    });
    if (nuxt.options.dev) {
      nuxt.hook("ready", () => {
        const appDir = nuxt.options.appDir.replace(/\/+$/, "");
        const rootDir = nuxt.options.rootDir.replace(/\/+$/, "");
        const relativeAppDir = appDir.startsWith(rootDir) ? appDir.slice(rootDir.length + 1) : appDir;
        const buildId = nuxt.options.appConfig?.nuxt?.buildId;
        resolvedEntryPath = `/_nuxt/${relativeAppDir}/entry.js` + (buildId ? `?v=${buildId}` : "");
      });
    }
    if (!nuxt.options.dev) {
      nuxt.hook("build:manifest", (manifest) => {
        let entryChunk = Object.values(manifest).find((chunk) => chunk.isEntry);
        if (!entryChunk) {
          const entryKey = Object.keys(manifest).find((key) => key.includes("entry"));
          if (entryKey) {
            entryChunk = manifest[entryKey];
          }
        }
        if (entryChunk && "file" in entryChunk) {
          const chunk = entryChunk;
          resolvedEntryPath = `/_nuxt/${chunk.file}`;
          if (Array.isArray(chunk.css)) {
            resolvedEntryCssPaths = chunk.css.map((css) => `/_nuxt/${css}`);
          }
        }
      });
    }
    nuxt.hook("nitro:config", (nitroConfig) => {
      nitroConfig.virtual = nitroConfig.virtual || {};
      nitroConfig.virtual["#nuxt-entry-path"] = () => {
        return `export default '${resolvedEntryPath}'`;
      };
      nitroConfig.virtual["#nuxt-entry-css-paths"] = () => {
        return `export default ${JSON.stringify(resolvedEntryCssPaths)}`;
      };
      if (nuxt.options._generate) {
        nitroConfig.prerender = nitroConfig.prerender || {};
        nitroConfig.prerender.routes = nitroConfig.prerender.routes || [];
        nitroConfig.prerender.routes.push("/nuxt-component-preview/app-loader.js");
      }
    });
    addServerHandler({
      route: "/nuxt-component-preview/entry.js",
      handler: resolver.resolve("./runtime/server/routes/nuxt-component-preview/entry.js.get")
    });
    addServerHandler({
      route: "/nuxt-component-preview/app-loader.js",
      handler: resolver.resolve("./runtime/server/api/app-loader.js.get")
    });
    if (options.componentIndex.enabled) {
      const configPath = resolve(nuxt.options.buildDir, "nuxt-component-preview-config.json");
      const indexOptions = {
        category: options.componentIndex.category,
        status: options.componentIndex.status,
        includePackages: options.componentIndex.includePackages,
        includeDirectories: options.componentIndex.include.directories,
        excludeDirectories: options.componentIndex.exclude.directories,
        excludeComponents: options.componentIndex.exclude.components,
        overrides: options.componentIndex.overrides
      };
      nuxt.hook("app:templatesGenerated", async () => {
        const globalComponents = nuxt.apps.default.components.filter((c) => c.global);
        const components = globalComponents.filter((c) => !c.filePath.includes("node_modules")).map((c) => ({
          pascalName: c.pascalName,
          kebabName: c.kebabName,
          filePath: c.filePath,
          shortPath: c.shortPath,
          global: c.global
        }));
        fs.writeFileSync(configPath, JSON.stringify({
          components,
          tsconfigPath: resolve(nuxt.options.rootDir, "tsconfig.json"),
          options: indexOptions
        }));
      });
      nuxt.hook("nitro:config", (nitroConfig) => {
        nitroConfig.virtual = nitroConfig.virtual || {};
        nitroConfig.virtual["#nuxt-component-preview-config-path"] = () => {
          return `export default ${JSON.stringify(configPath)}`;
        };
      });
      if (nuxt.options.dev || nuxt.options._generate) {
        addServerHandler({
          route: "/nuxt-component-preview/component-index.json",
          handler: resolver.resolve("./runtime/server/routes/nuxt-component-preview/component-index.json.get")
        });
        if (nuxt.options._generate) {
          nuxt.hook("nitro:config", (nitroConfig) => {
            nitroConfig.prerender = nitroConfig.prerender || {};
            nitroConfig.prerender.routes = nitroConfig.prerender.routes || [];
            nitroConfig.prerender.routes.push("/nuxt-component-preview/component-index.json");
          });
        }
      } else {
        nuxt.hook("nitro:build:public-assets", async (nitro) => {
          const { prepareComponentIndex } = await import('../dist/runtime/server/utils/prepareComponentIndex.js');
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          const indexData = prepareComponentIndex(config);
          if (indexData) {
            const outputDir = resolve(nitro.options.output.publicDir, "nuxt-component-preview");
            fs.mkdirSync(outputDir, { recursive: true });
            fs.writeFileSync(resolve(outputDir, "component-index.json"), JSON.stringify(indexData));
          }
        });
      }
    }
  }
});

export { module$1 as default };
