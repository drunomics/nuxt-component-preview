# Nuxt Component Preview

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

A Nuxt module that enables component previewing functionality for rendering Vue components in external contexts (like iframes or separate HTML pages).

- [✨ &nbsp;Release Notes](/CHANGELOG.md)

## Features

- 🎭 **Component Preview Mode**: Conditionally render components based on runtime configuration
- 🚀 **Production Safe**: Module is inactive by default, only activates when explicitly enabled
- 🔄 **Dynamic Rendering**: Use Vue's `h()` function to render components with props
- 📦 **Auto-imported Components**: Automatically registers `ComponentPreviewArea` component
- 🎯 **Target Rendering**: Render components to specific DOM elements using CSS selectors
- 🧪 **Testing Ready**: Includes comprehensive test coverage and playground setup

## Quick Setup

Install the module to your Nuxt application:

```bash
npm install nuxt-component-preview
```

Add the module to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ['nuxt-component-preview']
})
```

Update your `app.vue` to include the preview area:

```vue
<template>
  <ComponentPreviewArea v-if="useRuntimeConfig().public.componentPreview.inPreviewMode === true" />
  <NuxtPage v-else />
</template>
```


## Usage

### Basic HTML Setup

Create an HTML page that loads your Nuxt application with preview mode enabled:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Component Preview</title>
</head>
<body>
  <!-- Hidden Nuxt app container -->
  <div id="__nuxt" style="display:none;"></div>

  <!-- Target elements for component rendering -->
  <div id="preview-target-1" class="preview-container"></div>
  <div id="preview-target-2" class="preview-container"></div>

  <!-- Configure Nuxt with preview mode enabled -->
  <script>
    window.__NUXT__ = {
      config: {
        public: {
          componentPreview: {
            inPreviewMode: true
          }
        },
        app: {
          baseURL: "/",
          buildId: "dev",
          buildAssetsDir: "/_nuxt/",
          cdnURL: "http://localhost:3000"
        }
      }
    };
  </script>

  <!-- Load Nuxt -->
  <script type="module" src="http://localhost:3000/_nuxt/entry.js"></script>

  <!-- Preview components when ready -->
  <script>
    window.addEventListener('nuxt-component-preview:ready', (event) => {
      const { nuxtApp } = event.detail;

      // Preview a component
      nuxtApp.$previewComponent(
        'MyComponent',
        { title: 'Hello World', description: 'Component preview example' },
        '#preview-target-1'
      );
    });
  </script>
</body>
</html>
```

### API Reference

#### `$previewComponent(componentName, props, target)`

Renders a Vue component to a target element.

**Parameters:**
- `componentName` (string): Name of the registered Vue component
- `props` (object): Props to pass to the component
- `target` (string|Element): CSS selector or DOM element where component will be rendered

**Returns:**
- Object with `unmount()` method to remove the component

**Example:**
```javascript
const preview = nuxtApp.$previewComponent(
  'TestCard',
  { title: 'My Title', content: 'My content' },
  '#target-element'
);

// Later, remove the component
preview.unmount();
```

### Events

#### `nuxt-component-preview:ready`

Dispatched when Nuxt is ready and the preview functionality is available.

```javascript
window.addEventListener('nuxt-component-preview:ready', (event) => {
  const { nuxtApp } = event.detail;
  // nuxtApp.$previewComponent is now available
});
```

### Runtime Configuration

The module adds the following runtime configuration:

```typescript
{
  public: {
    componentPreview: {
      inPreviewMode: false // Set to true to enable preview mode
    }
  }
}
```

## Development

### Testing the Module

The module includes a playground with test components and a static HTML test page:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Visit the test page:
   ```
   http://localhost:3000/test-preview.html
   ```

3. Run tests:
   ```bash
   npm run test
   ```

## Contribution

<details>
  <summary>Local development</summary>
  
  ```bash
  # Install dependencies
  npm install
  
  # Generate type stubs
  npm run dev:prepare
  
  # Develop with the playground
  npm run dev
  
  # Build the playground
  npm run dev:build
  
  # Run ESLint
  npm run lint
  
  # Run Vitest
  npm run test
  npm run test:watch
  
  # Release new version
  npm run release
  ```

</details>


<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/nuxt-component-preview/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/nuxt-component-preview

[npm-downloads-src]: https://img.shields.io/npm/dm/nuxt-component-preview.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/nuxt-component-preview

[license-src]: https://img.shields.io/npm/l/nuxt-component-preview.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/nuxt-component-preview

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
