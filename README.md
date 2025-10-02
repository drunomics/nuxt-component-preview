# Nuxt Component Preview

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![ci](https://github.com/drunomics/nuxt-component-preview/actions/workflows/ci.yml/badge.svg)](https://github.com/drunomics/nuxt-component-preview/actions/workflows/ci.yml)
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

> A Nuxt module by [drunomics](https://drunomics.com/en) for previewing Vue components in external contexts (like iframes or separate HTML pages). Originally developed for use with decoupled Drupal environments, but can be used with any backend.

## Features

- 🎭 **Component Preview Mode**: Conditionally render components for previewing in isolation
- 🚀 **Production Safe**: Inactive by default, only activates when explicitly enabled
- 🎯 **Target Rendering**: Render components to specific DOM elements using CSS selectors
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
- **slots** (object, optional): Slot content as HTML strings, keyed by slot name (default: `{}`)
- **targetSelector** (string | Element): CSS selector or DOM element where component will be rendered

**Returns:** `Promise<{unmount: Function}>`

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

**Nested Components:** Slots can contain additional preview containers. An example implementing rendering with an
arbitrary depth can be found at the [example](./playground/public/preview-test-loader.html), which can be tested via `npm run dev`.

## Testing

This module includes comprehensive tests. To run them:

```bash
npm run test
```

## Releasing

Run command
```bash
npm run release -- --release-as 1.0.0-alpha.1
```

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
