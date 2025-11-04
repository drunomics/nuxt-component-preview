<script setup>
import { h, resolveComponent, onBeforeMount } from 'vue'
import { useState, useNuxtApp } from '#imports'

const previews = useState('componentPreviews', () => [])
let resolveCustomElement = null

// Initialize resolveCustomElement if drupal-ce is configured
onBeforeMount(() => {
  if (useNuxtApp().$config?.public?.drupalCe) {
    try {
      // Try to use useDrupalCe if available (from nuxtjs-drupal-ce module)
      // @ts-expect-error - useDrupalCe is optionally available from #imports
      const { resolveCustomElement: resolveFromDrupalCe } = useDrupalCe()
      resolveCustomElement = resolveFromDrupalCe
    }
    catch {
      // drupal-ce not available, will use standard resolution
    }
  }
})

// Helper function to render components using Vue's h() function
function renderComponent(preview) {
  const { element, props = {}, slots = {} } = preview.content

  // Use custom element resolution with fallback if drupal-ce is configured
  const component = resolveCustomElement
    ? resolveCustomElement(element)
    : resolveComponent(element)

  if (!component || typeof component === 'string') {
    console.warn(`Component "${element}" not found for preview`)
    return h('div', { class: 'preview-error' }, `Component "${element}" not found`)
  }

  // Convert HTML strings to VNodes for slots
  const slotContent = {}
  for (const [slotName, htmlContent] of Object.entries(slots)) {
    if (htmlContent) {
      slotContent[slotName] = () => h('div', { innerHTML: htmlContent, style: { display: 'contents' } })
    }
  }
  return h(component, props, slotContent)
}
</script>

<template>
  <div style="display: none;">
    <template
      v-for="(preview, index) in previews"
      :key="index"
    >
      <Teleport :to="preview.target">
        <component :is="renderComponent(preview)" />
      </Teleport>
    </template>
  </div>
</template>
