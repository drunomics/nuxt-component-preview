# App Loader

The app-loader script automatically sets up everything needed for component preview.

## Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
  <title>Component Preview</title>
  <script src="http://localhost:3000/nuxt-component-preview/app-loader.js"></script>
</head>
```

## Overriding Asset Paths via Data Attributes

When the app-loader is served from a different path than the Nuxt build (e.g. from a [Lupus CSR](https://www.drupal.org/project/lupus_csr) theme), use `data-cdn-url` and `data-build-assets-dir` to override asset resolution at runtime:

```html
<script
  src="/themes/my_theme/dist/nuxt-component-preview/app-loader.js"
  data-cdn-url=""
  data-build-assets-dir="/themes/my_theme/dist/_nuxt/"
></script>
```

- **`data-cdn-url`**: Overrides the base origin for loading assets. Set to `""` for same-origin.
- **`data-build-assets-dir`**: Overrides the path to compiled Nuxt assets.

When omitted, build-time defaults are used.

## Full Example

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

See [playground/public/preview-test-loader.html](../playground/public/preview-test-loader.html) for a working example.

## API Reference

### `nuxt-component-preview:ready` Event

Fired when the Nuxt app is ready for component preview:

```javascript
window.addEventListener('nuxt-component-preview:ready', (event) => {
  const { nuxtApp } = event.detail;
  // Use nuxtApp.$previewComponent() here
});
```

### Helper Function Pattern

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

### `$previewComponent(componentName, props, slots, targetSelector)`

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

**Pass pre-existing DOM elements to slots**

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
See [playground/public/preview-test-dom-slots.html](../playground/public/preview-test-dom-slots.html) for a complete working example.

**Nested Components:** Slots can contain additional preview containers. An example implementing rendering with an
arbitrary depth can be found at the [example](../playground/public/preview-test-loader.html), which can be tested via `npm run dev`.
