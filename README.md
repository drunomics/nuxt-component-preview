# Nuxt Component Preview

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![ci](https://github.com/drunomics/nuxt-component-preview/actions/workflows/ci.yml/badge.svg)](https://github.com/drunomics/nuxt-component-preview/actions/workflows/ci.yml)
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

> A Nuxt module by [drunomics](https://drunomics.com/en) for previewing Vue components in external contexts (like iframes or separate HTML pages). Originally developed for use with decoupled Drupal environments like [Lupus Decoupled Drupal](https://lupus-decoupled.org), but can be used with any backend.

## Features

- 🎭 **Component Preview Mode**: Conditionally render components for previewing in isolation
- 🚀 **Production Safe**: Inactive by default, only activates when explicitly enabled
- 🎯 **Target Rendering**: Render components to specific DOM elements using CSS selectors
- 📋 **Component Index**: Auto-generates JSON metadata for global components (Drupal Canvas compatible)
- 🧪 **Testing Ready**: Comprehensive test coverage and playground setup

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
  // Development: Vite server CORS
  vite: {
    server: {
      cors: {
        origin: ['https://your-backend.com'],
      },
    },
  },

  // Production: Nitro route rules
  nitro: {
    routeRules: {
      '/nuxt-component-preview/*.js': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': 'https://your-backend.com',
        },
      },
      '/_nuxt/**': {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': 'https://your-backend.com',
        },
      },
    },
  },
})
```

### Reverse Proxy / CDN Configuration

When Nuxt runs behind a reverse proxy, be sure to configure the Nuxt CDN URL so component preview generates correct absolute URLs for loading assets:

```bash
export NUXT_APP_CDN_URL=https://your-frontend-url.com
```

### Static Site Generation

For static builds (`nuxt generate`), configuring [`app.cdnURL`](https://nuxt.com/docs/api/nuxt-config#cdnurl) is **required** for component previews to work.

## Usage

### Rendering Component Previews

To render a component preview, use the `<ComponentPreviewArea />` component in your app.

**Example `app.vue`**

```vue
<template>
  <ComponentPreviewArea v-if="useRuntimeConfig().public.componentPreview" />
  <NuxtPage v-else />
</template>
```

### Using the App Loader

The app-loader script automatically sets up everything needed for component preview:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Component Preview</title>
  <script src="http://localhost:3000/nuxt-component-preview/app-loader.js"></script>
</head>
<body>
  <h1>Component Preview Page</h1>

  <!-- Preview targets where components will render -->
  <div id="preview-target-1"></div>
  <div id="preview-target-2"></div>

  <script>
    // Helper function that handles both sync and async cases:
    const onNuxtComponentPreviewReady = (callback) =>
      window.__nuxtComponentPreviewApp
        ? callback(window.__nuxtComponentPreviewApp)
        : window.addEventListener('nuxt-component-preview:ready', event => callback(event.detail.nuxtApp), { once: true })

    // Example usage of the helper:
    onNuxtComponentPreviewReady((nuxtApp) => {
      nuxtApp.$previewComponent('MyComponent', { prop: 'value' }, {}, '#preview-target-1');
      nuxtApp.$previewComponent('OtherComponent', { data: 123 }, {}, '#preview-target-2');
      nuxtApp.$previewComponent('LayoutComponent', {}, { slot_name: '<p>HTML content for slot</p>' }, '#preview-target-3');
    });
  </script>
</body>
</html>
```

See [playground/public/preview-test-loader.html](./playground/public/preview-test-loader.html) for a working example.

### API Reference

#### `nuxt-component-preview:ready` Event

Fired when the Nuxt app is ready for component preview:

```javascript
window.addEventListener('nuxt-component-preview:ready', (event) => {
  const { nuxtApp } = event.detail;
  // Use nuxtApp.$previewComponent() here
});
```

#### Helper Function Pattern

For convenience, you can use this helper that works whether Nuxt is already ready or still loading:

```javascript
const onNuxtComponentPreviewReady = (callback) =>
  window.__nuxtComponentPreviewApp
    ? callback(window.__nuxtComponentPreviewApp)
    : window.addEventListener('nuxt-component-preview:ready', event => callback(event.detail.nuxtApp), { once: true })

// Usage
onNuxtComponentPreviewReady((nuxtApp) => {
  nuxtApp.$previewComponent('MyComponent', props, slots, '#target');
});
```

#### `$previewComponent(componentName, props, slots, targetSelector)`

Renders a Vue component to a target element. **Returns a Promise** that resolves when rendering completes.

**Parameters (in order):**
- **componentName** (string): Name of the registered Vue component
- **props** (object, optional): Props to pass to the component (default: `{}`)
- **slots** (object, optional): Slot content as HTML strings OR DOM elements, keyed by slot name (default: `{}`)
- **targetSelector** (string | Element): CSS selector or DOM element where component will be rendered

**Returns:** `Promise<{unmount: Function}>`

**Basic Example (HTML strings):**
```javascript
// Simple component
await nuxtApp.$previewComponent('TestCard', { title: 'My Card' }, {}, '#preview-target');

// Component with slots
await nuxtApp.$previewComponent(
  'TwoColumnLayout',
  { width: 33 },
  {
    'column-one': '<h3>First Column</h3><p>Content</p>',
    'column-two': '<h3>Second Column</h3><p>Content</p>'
  },
  '#preview-target'
);
```

**Pass pre-exsiting DOM elements to slots**

Slots can also accept pre-existing DOM elements instead of HTML strings. This is useful when:
- Slot content already exists in the DOM (e.g., server-rendered content)
- Processing needs to happen on slot content before Nuxt renders

```javascript
// Extract existing DOM elements to use as slots
const container = document.getElementById('preview-target');
const slotElements = {};
container.querySelectorAll('[data-slot]').forEach(el => {
  slotElements[el.dataset.slot] = el; // Pass the element directly
});

await nuxtApp.$previewComponent(
  'TwoColumnLayout',
  { width: 50 },
  slotElements, // DOM elements instead of strings
  '#preview-target'
);
```
See [playground/public/preview-test-dom-slots.html](./playground/public/preview-test-dom-slots.html) for a complete working example.

**Nested Components:** Slots can contain additional preview containers. An example implementing rendering with an
arbitrary depth can be found at the [example](./playground/public/preview-test-loader.html), which can be tested via `npm run dev`.

## Component Index

This module automatically generates a component index JSON file containing metadata for all global components. This is particularly useful for integration with [Drupal Canvas External JS](https://www.drupal.org/project/canvas_extjs) module.

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
      category: 'Nuxt Components', // default category
      status: 'stable', // default: stable, experimental, deprecated, obsolete

      // Exclude components (overwrites defaults)
      exclude: {
        components: ['*--default'], // default: excludes *--default pattern
        directories: [] // exclude by directory pattern
      },

      // Package filtering for component index (default: false = exclude all packages)
      includePackages: false,           // Exclude all package components from node_modules
      // includePackages: true,          // Include all package components (not recommended)
      // includePackages: ['my-package'], // Include only components from specific packages

      // Override metadata for specific components
      overrides: {
        TestButton: { category: 'Forms', status: 'experimental' }
      }
    }
  }
})
```

#### Package Filtering

The `includePackages` option controls which npm package components are included in the component index:

- `false` (default): No components from node_modules packages are processed
- `true`: All package components are processed (may cause warnings for incompatible packages)
- `['package-name', '@org/package']`: Only components from specified packages are processed

Only affects components registered globally by Nuxt from npm packages.

### Requirements for Component Index

- Components must be **global** (registered with `global: true` in Nuxt)
  - Components in `components/global/` directory are automatically global
  - Nuxt modules can also register global components
- Use TypeScript inline syntax with JSDoc for best metadata extraction:

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

**Supported JSDoc tags:**
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

### Canvas Schema References

Use `@schemaRef` to reference Canvas JSON schema definitions, useful for `stream-wrapper-uri` and `stream-wrapper-image-uri` types. Use shorthand `prefix/name` notation (e.g., `canvas/stream-wrapper-uri` expands to `json-schema-definitions://canvas.module/stream-wrapper-uri`).

See [TestStreamWrapper.vue](./playground/components/global/TestStreamWrapper.vue) for usage examples.

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
