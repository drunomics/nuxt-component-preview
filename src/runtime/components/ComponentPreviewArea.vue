<script setup>
import { h, resolveComponent } from 'vue'
import { useState } from '#imports'

const previews = useState('componentPreviews', () => [])

// Helper function to render components using Vue's h() function
function renderComponent(preview) {
  const { element, props = {}, slots = {} } = preview.content

  // Resolve the component - it should be globally available
  const component = resolveComponent(element)

  if (!component) {
    console.warn(`Component "${element}" not found for preview`)
    return h('div', { class: 'preview-error' }, `Component "${element}" not found`)
  }

  // Convert HTML strings to VNodes for slots
  const slotContent = {}
  for (const [slotName, htmlContent] of Object.entries(slots)) {
    if (htmlContent) {
      slotContent[slotName] = () => h('div', { innerHTML: htmlContent })
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
