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

  // Convert slots to VNodes (supports both HTML strings and DOM elements)
  const slotContent = {}
  for (const [slotName, content] of Object.entries(slots)) {
    if (content) {
      slotContent[slotName] = () => {
        // Check if slot content is a pre-existing DOM element that needs to be moved
        if (content instanceof HTMLElement) {
          // Use ref callback to move children from the container into the Vue slot.
          // Vue calls this function with the mounted DOM element, allowing us to
          // imperatively move existing DOM nodes without recreating them.
          // This preserves event listeners and JavaScript references.
          return h('div', {
            ref: (el) => {
              if (el && content.childNodes.length > 0) {
                // Move all children from the slot container to this Vue slot element
                while (content.firstChild) {
                  el.appendChild(content.firstChild)
                }
                // Remove the now-empty wrapper
                content.remove()
              }
            },
            style: { display: 'contents' },
          })
        }
        // Fallback: Handle HTML string slots (backward compatibility)
        return h('div', { innerHTML: content, style: { display: 'contents' } })
      }
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
