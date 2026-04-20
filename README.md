# Nuxt Component Preview

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![ci](https://github.com/drunomics/nuxt-component-preview/actions/workflows/ci.yml/badge.svg)](https://github.com/drunomics/nuxt-component-preview/actions/workflows/ci.yml)
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

> A Nuxt module by [drunomics](https://drunomics.com/en) for previewing Vue components in external contexts (like iframes or separate HTML pages). Originally developed for use with decoupled Drupal environments like [Lupus Decoupled Drupal](https://lupus-decoupled.org), but can be used with any backend.

## Features

- 🎭 **Component Preview Mode**: Render components in isolation via Vue Teleport — embed previews in iframes or external pages
- 🚀 **Production Safe**: Inactive by default, only activates when explicitly enabled
- 📋 **Component Index**: Auto-generates JSON metadata for global components from TypeScript props and JSDoc annotations
- 🔌 **Framework Agnostic**: Works with any backend. Built-in support for [Drupal Canvas](https://www.drupal.org/project/canvas) via [canvas_extjs](https://www.drupal.org/project/canvas_extjs)

## Quick Setup

Install the module to your Nuxt application:

```bash
npm install nuxt-component-preview
```

Add it to your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: [
    'nuxt-component-preview',
  ]
})
```

### Cross-domain configuration

When embedding component previews on a different domain, disable the app manifest in development mode only:

```ts
export default defineNuxtConfig({
  modules: [
    'nuxt-component-preview',
  ],

  // Disable appManifest in development only
  $development: {
    experimental: {
      appManifest: false
    }
  }
})
```

**Why?** In dev mode, Nuxt's appManifest feature (default since v3.8) tries to fetch metadata using relative URLs that fail in cross-domain contexts. Production builds work fine with appManifest enabled. Since component preview doesn't require this feature, it's safe to disable in development.

### CORS Configuration

For cross-origin embedding, configure CORS in your Nuxt app:

```ts
export default defineNuxtConfig({
  // Development: Vite dev server CORS
  vite: {
    server: {
      cors: {
        origin: ['https://your-backend.com'],
      },
    },
  },

  // SSR production: Nitro route rules for CORS headers
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'Access-Control-Allow-Origin': 'https://your-backend.com',
          'Access-Control-Allow-Methods': 'GET',
        },
      },
    },
  },
})
```

> **Note:** When using [nuxtjs-drupal-ce](https://github.com/drunomics/nuxtjs-drupal-ce), CORS is configured automatically based on `drupalCe.drupalBaseUrl` — no manual setup needed.

> **SSG:** For static builds, Nitro route rules have no effect since there is no server. CORS headers must be configured on the web server or CDN serving the static files.

### Reverse Proxy / CDN Configuration

When Nuxt runs behind a reverse proxy, be sure to configure the Nuxt CDN URL so component preview generates correct absolute URLs for loading assets:

```bash
export NUXT_APP_CDN_URL=https://your-frontend-url.com
```

### Static Site Generation

For static builds (`nuxt generate`), configuring [`app.cdnURL`](https://nuxt.com/docs/api/nuxt-config#cdnurl) is recommended when assets are served from a different domain than the embedding page.

### Preview Rendering

Add the `<ComponentPreviewArea />` to your `app.vue` so previews render when preview mode is active:

```vue
<template>
  <ComponentPreviewArea v-if="useRuntimeConfig().public.componentPreview?.active" />
  <NuxtPage v-else />
</template>
```

For embedding previews in external pages (e.g., Drupal Canvas editor), see the [App Loader documentation](./docs/app-loader.md).

### Updating Component Props

After `$previewComponent()` resolves, the target element has an `updateComponent()` method that allows updating props in-place without re-mounting:

```javascript
const { unmount } = await nuxtApp.$previewComponent('MyComponent', props, {}, '#target');

// Later: update props in-place, triggers Vue re-render.
document.querySelector('#target').updateComponent({ title: 'New title' });
```

This is used by [canvas_extjs](https://www.drupal.org/project/canvas_extjs) for real-time preview updates in the Canvas editor.

## Component Index

This module automatically generates a component index JSON file containing metadata for all global components. This is particularly useful for integration with [Drupal Canvas External JS](https://www.drupal.org/project/canvas_extjs) module.

Components must be **global** (registered with `global: true` in Nuxt — components in `components/global/` are automatically global). Use TypeScript with JSDoc annotations for best metadata extraction.

### Endpoint

The component index is available at:
```
http://localhost:3000/nuxt-component-preview/component-index.json
```

### Configuration

```typescript
export default defineNuxtConfig({
  modules: ['nuxt-component-preview'],

  componentPreview: {
    componentIndex: {
      enabled: true, // default: true

      // Category from directory structure (e.g., Canvas/Layout/ → "Layout")
      category: { directory: true, fallback: 'Misc' },
      // Or use a static string:
      // category: 'Nuxt Components',

      // Include only components from specific directories (by path pattern).
      // When set, everything outside these directories is excluded.
      include: {
        directories: ['Canvas'], // Only index components under Canvas/
      },

      // Exclude components (overwrites defaults)
      exclude: {
        components: ['*--default'], // default: excludes *--default pattern
        directories: [] // exclude by directory pattern
      },

      // Include components from npm packages in node_modules (default: false)
      includePackages: false,           // Exclude all npm package components
      // includePackages: true,          // Include all npm package components
      // includePackages: ['my-package'], // Include only specific npm packages

      // Override metadata for specific components
      overrides: {
        TestButton: { name: 'Custom Button', description: 'A button', category: 'Forms', status: 'experimental' }
      }
    },

    // Client-side `$fetch` path prefixes resolved against `app.cdnURL`
    // instead of the embedding document's origin. See below.
    cdnFetchPaths: [
      '/nuxt-component-preview/',
      '/api/_nuxt_icon/',
      '/_i18n/',
    ]
  }
})
```

#### Package Filtering

The `includePackages` option controls which npm package components are included in the component index:

- `false` (default): No components from node_modules packages are processed
- `true`: All package components are processed (may cause warnings for incompatible packages)
- `['package-name', '@org/package']`: Only components from specified packages are processed

Only affects components registered globally by Nuxt from npm packages.

#### Directory Filtering

Filter the component index by directory path patterns. Works for both app-level and package-layer components.

- `include.directories`: when set, **only** components in these directories are indexed
- `exclude.directories`: exclude components in these directories

Both can be combined — e.g., include `Canvas` but exclude `Canvas/Internal`.

#### `cdnFetchPaths`

A `$fetch` override **for component previews**. During a preview the Nuxt app runs inside an embedder document (e.g. a Drupal admin page), so relative `$fetch('/...')` calls from modules like `@nuxtjs/i18n` or `@nuxt/icon` hit the embedder instead of Nitro. This plugin rewrites requests starting with one of the configured prefixes to use `app.cdnURL` (the Nuxt origin) as base URL.

Defaults to `['/nuxt-component-preview/', '/api/_nuxt_icon/', '/_i18n/']`. Set to `[]` to disable. `$fetch.native` callers bypass ofetch and are not intercepted.

### Component Metadata

> **Note:** Only globally registered components appear in the component index. Components in `components/global/` are automatically global, or register with `global: true` in `nuxt.config.ts`.

Define name, description, category, and status for a component via a JSDoc comment at the top of `<script setup>`:

```vue
<script setup lang="ts">
/**
 * Hero Billboard
 * @description A full-width hero section with background image and overlay.
 * @category Hero
 * @status stable
 */
withDefaults(defineProps<{
  // ... props
}>(), {
  // ... defaults
})
</script>
```

- **First line** → custom display name (optional, falls back to auto-generated from PascalCase)
- **`@description`** → component description shown in the editor
- **`@category`** → category override (alternative to directory-based or config-based)
- **`@status`** → status override (`experimental`, `stable`, `deprecated`, `obsolete`)

All fields are optional. Config overrides take priority over JSDoc.

### Prop Metadata

```vue
<script setup lang="ts">
withDefaults(defineProps<{
  /**
   * Button label text
   * @example Submit
   * @example Cancel
   */
  label?: string
  /**
   * Button variant
   * @example primary
   * @enumLabels {"large": "Extra Large (XL)"}
   */
  variant?: 'primary' | 'secondary' | 'large'
}>(), {
  label: 'Click me',
  variant: 'primary'
})
</script>
```

**Supported prop JSDoc tags:**
- `@title` - Explicit prop title override
- `@example` - Adds to `examples` field
- `@enumLabels` - Custom labels for `meta:enum` (full or partial)
- `@contentMediaType text/html` - For string props: enables rich text editing in Canvas
- `@formattingContext block|inline` - Controls formatting (default: `block`)
- `@schemaRef` - Reference Canvas JSON schema definitions (see below)
- `@format` - JSON Schema format for semantic string validation and UI widgets (e.g., date picker). Supported: `date`, `date-time`, `time`, `duration`, `email`, `idn-email`, `hostname`, `idn-hostname`, `ipv4`, `ipv6`, `uuid`, `uri`, `uri-reference`, `iri`, `iri-reference`
- `@pattern` - JSON Schema regex pattern for string validation (e.g., `(.|\r?\n)*` for multiline/textarea)
- `@allowed-schemes` - Allowed URI schemes for Canvas field type determination (e.g., `public` or `http, https`)

Prop titles are auto-generated from the first line of JSDoc or prop name. Use `@title` to override.

See [TestArticle.vue](./playground/components/global/TestArticle.vue) for formatted text examples.

### Drupal Canvas Types

For [Drupal Canvas](https://www.drupal.org/project/canvas) integration, special prop types generate JSON schema matching [Canvas JSON-Schema definitions](https://git.drupalcode.org/project/canvas/-/blob/1.x/schema.json), enabling UI features like media library selection. See [Canvas prop types documentation](https://project.pages.drupalcode.org/canvas/sdc-components/props/#prop-types-and-examples) for details.

**Available TypeScript types** (auto-imported by Nuxt):
- `CanvasImage` - Image with media library integration
- `CanvasVideo` - Video with poster support

**`@example` formats** for Canvas types:
- Key-value: `src=https://... alt="text" width=800 height=600`
- JS object: `{ src: 'https://...', alt: 'text', width: 800 }`

See [TestHero.vue](./playground/components/global/TestHero.vue) and [TestBanner.vue](./playground/components/global/TestBanner.vue) for usage examples.

**Schema references** via `@schemaRef` allow referencing Canvas JSON schema definitions, useful for `stream-wrapper-uri` and `stream-wrapper-image-uri` types. Use shorthand `prefix/name` notation (e.g., `canvas/stream-wrapper-uri` expands to `json-schema-definitions://canvas.module/stream-wrapper-uri`). See [TestStreamWrapper.vue](./playground/components/global/TestStreamWrapper.vue) for examples.

## Testing

This module includes comprehensive tests. To run them:

```bash
npm run test
```

## Releasing

1. Update the version in `package.json`
2. Run `npm run lint && npm run test && npm run prepack`
3. Commit, tag, and push: `git commit -am "release: vX.Y.Z" && git tag vX.Y.Z && git push --follow-tags`
4. Publish: `npm publish --tag beta`
5. Ensure the `latest` dist-tag points to the new version: `npm dist-tag add nuxt-component-preview@X.Y.Z latest`

## About

This module is maintained by [drunomics](https://drunomics.com/en) and inspired by the needs of decoupled Drupal projects, such as [nuxtjs-drupal-ce](https://github.com/drunomics/nuxtjs-drupal-ce).

---

[npm-version-src]: https://img.shields.io/npm/v/nuxt-component-preview/latest.svg?style=flat-square
[npm-version-href]: https://npmjs.com/package/nuxt-component-preview
[npm-downloads-src]: https://img.shields.io/npm/dm/nuxt-component-preview.svg?style=flat-square
[npm-downloads-href]: https://npmjs.com/package/nuxt-component-preview
[license-src]: https://img.shields.io/npm/l/nuxt-component-preview.svg?style=flat-square
[license-href]: https://npmjs.com/package/nuxt-component-preview
[nuxt-src]: https://img.shields.io/badge/Nuxt-4-green.svg
[nuxt-href]: https://nuxt.com
