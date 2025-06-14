<template>
  <div>
    <h1>Nuxt Component Preview Playground</h1>
    <p>This is the playground for testing the nuxt-component-preview module.</p>

    <div style="margin: 2rem 0;">
      <h2>Test the Component Preview</h2>
      <p>Click the link below to test the component preview functionality:</p>
      <a
        href="/preview-test.html"
        target="_blank"
        style="display: inline-block; padding: 1rem 2rem; background: #42b883; color: white; text-decoration: none; border-radius: 4px;"
      >
        Open Component Preview Test
      </a>
    </div>

    <div style="margin: 2rem 0;">
      <h2>Module Status</h2>
      <p><strong>Preview Mode:</strong> {{ $config.public.componentPreview ? 'Enabled' : 'Disabled' }}</p>
      <p>Preview mode should be disabled in normal app usage and only enabled when explicitly configured.</p>
    </div>
  </div>
</template>

<script setup>
const $config = useRuntimeConfig()
</script>

<style scoped>
div {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  font-family: Arial, sans-serif;
}
</style>
