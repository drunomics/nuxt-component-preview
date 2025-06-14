<script setup>
import { h } from 'vue'

const previews = useState('componentPreviews', () => [])

// Helper function to render components using Vue's h() function
function renderComponent(preview) {
  const { element, ...props } = preview.content

  // Resolve the component - it should be globally available
  const component = resolveComponent(element)

  if (!component) {
    console.warn(`Component "${element}" not found for preview`)
    return h('div', { class: 'preview-error' }, `Component "${element}" not found`)
  }

  return h(component, props)
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
