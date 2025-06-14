# Nuxt Component Preview

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![ci](https://github.com/drunomics/nuxt-component-preview/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/drunomics/nuxt-component-preview/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/drunomics/nuxt-component-preview/branch/main/graph/badge.svg)](https://codecov.io/gh/drunomics/nuxt-component-preview)
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

**Important:** Then, when rendering outside of a Nuxt app (e.g., in a static HTML file or external context), you must manually set the runtime config on `window.__NUXT__` before loading the Nuxt entry script to activate it. See the [playground/public/preview-test.html](./playground/public/preview-test.html) for a working example.

#### Example: Setting runtime config in a static HTML file

```html
<script>
  window.__NUXT__ = window.__NUXT__ || {};
  window.__NUXT__.config = {
    public: {
      componentPreview: true
    }
  };
</script>
```

You can then load the Nuxt entry script as shown in [preview-test.html](./playground/public/preview-test.html).

This setup is ideal for integrating with a Drupal backend (or any backend) that needs to render Nuxt components in isolation, such as for CMS previews or design systems.

## Testing

This module includes comprehensive tests. To run them:

```bash
npm run test
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
