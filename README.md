# Nuxt Component Preview

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![ci](https://github.com/drunomics/nuxt-component-preview/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/drunomics/nuxt-component-preview/actions/workflows/ci.yml)
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

> A Nuxt module by [drunomics](https://drunomics.com/en) for previewing Vue components in external contexts (like iframes or separate HTML pages). Originally developed for use with decoupled Drupal environments, but can be used with any backend.

- [✨ &nbsp;Release Notes](/CHANGELOG.md)

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
  ],
  // Optionally configure here
  // componentPreview: { ... }
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

### Using the App Loader (Recommended)

The simplest way to enable component preview in an external HTML page is using the app-loader script. This single script automatically handles all the setup:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Component Preview</title>
  <!-- Single script that handles everything -->
  <script src="/nuxt-component-preview/app-loader.js"></script>
</head>
<body>
  <h1>Component Preview Page</h1>

  <!-- Preview targets where components will render -->
  <div id="preview-target-1"></div>
  <div id="preview-target-2"></div>

  <script>
    // Wait for the preview system to be ready
    window.addEventListener('nuxt-component-preview:ready', (event) => {
      const { nuxtApp } = event.detail;

      // Render components into targets
      nuxtApp.$previewComponent('MyComponent', { prop: 'value' }, '#preview-target-1');
      nuxtApp.$previewComponent('OtherComponent', { data: 123 }, '#preview-target-2');
    });
  </script>
</body>
</html>
```

The app-loader script automatically:
- Creates the necessary DOM containers (`#__nuxt` and `#teleports`)
- Sets up the runtime configuration with `componentPreview: true`
- Loads the Nuxt entry module
- Fires the `nuxt-component-preview:ready` event when ready

See [playground/public/preview-test-loader.html](./playground/public/preview-test-loader.html) for a complete working example.

This setup is ideal for integrating with a Drupal backend (or any backend) that needs to render Nuxt components in isolation, such as for CMS previews or design systems.

### API Reference

#### `$previewComponent(componentName, props, targetSelector)`

The `$previewComponent` method is available on the Nuxt app instance after the `nuxt-component-preview:ready` event fires:

- **componentName** (string): Name of the registered Vue component to render
- **props** (object): Props to pass to the component
- **targetSelector** (string | Element): CSS selector or DOM element where the component will be rendered

```javascript
// Example usage
nuxtApp.$previewComponent(
  'TestCard',
  { title: 'My Card', description: 'Card content' },
  '#preview-target'
);
```

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
[nuxt-src]: https://img.shields.io/badge/Nuxt-3-green.svg
[nuxt-href]: https://nuxt.com
