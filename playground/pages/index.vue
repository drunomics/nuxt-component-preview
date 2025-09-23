<template>
  <div>
    <h1>Nuxt Component Preview Playground</h1>
    <p>This is the playground for testing the nuxt-component-preview module.</p>

    <div style="margin: 2rem 0;">
      <h2>Test the Component Preview</h2>
      <p>Click the links below to test the component preview functionality:</p>

      <div style="margin: 1.5rem 0; padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
        <h3 style="margin-top: 0;">Manual Integration Approach</h3>
        <p style="margin: 0.5rem 0;">Tests the traditional method where you manually set up Nuxt containers, config, and load entry scripts.</p>
        <p style="margin: 0.5rem 0; font-size: 0.9em; color: #666;">Requires multiple script tags and manual configuration setup.</p>
        <a
          href="/preview-test.html"
          style="display: inline-block; padding: 0.8rem 1.5rem; background: #42b883; color: white; text-decoration: none; border-radius: 4px; margin-top: 0.5rem;"
        >
          Test Manual Integration
        </a>
      </div>

      <div style="margin: 1.5rem 0; padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
        <h3 style="margin-top: 0;">Loader Script Approach (Recommended)</h3>
        <p style="margin: 0.5rem 0;">Tests the simplified loader script that automatically handles all Nuxt initialization.</p>
        <p style="margin: 0.5rem 0; font-size: 0.9em; color: #666;">Single script tag: <code style="background: #e0e0e0; padding: 2px 4px; border-radius: 3px;">&lt;script src="/nuxt-component-preview/app-loader.js"&gt;</code></p>
        <a
          href="/preview-test-loader.html"
          style="display: inline-block; padding: 0.8rem 1.5rem; background: #007ACC; color: white; text-decoration: none; border-radius: 4px; margin-top: 0.5rem;"
        >
          Test Loader Script
        </a>
      </div>
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
