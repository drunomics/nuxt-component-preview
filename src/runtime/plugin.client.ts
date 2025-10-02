import { defineNuxtPlugin, useState, useRuntimeConfig, onNuxtReady, nextTick } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  // Only activate when preview mode is enabled
  const config = useRuntimeConfig()
  if (!config.public.componentPreview) {
    return
  }

  const previews = useState('componentPreviews', () => [])

  /**
   * Creates a preview of a component and renders it to a target element
   *
   * @param {string} componentName - The name of the registered Vue component
   * @param {object} props - Props to pass to the component
   * @param {object} slots - Optional slot content as HTML strings keyed by slot name
   * @param {string|Element} target - CSS selector or DOM element where the component will be rendered
   * @returns {Promise<object>} A promise that resolves with an unmount method when rendering is complete
   */
  async function previewComponent(componentName, props = {}, slots = {}, target) {
    const targetEl = typeof target === 'string'
      ? document.querySelector(target)
      : target

    if (!targetEl) {
      throw new Error(`Target element "${target}" not found in DOM`)
    }

    const previewData = {
      target: targetEl,
      content: {
        element: componentName,
        props,
        slots,
      },
    }

    previews.value.push(previewData)

    // Wait for Vue to render the component.
    await nextTick()

    return {
      unmount() {
        previews.value = previews.value.filter(c => c.target !== targetEl)
      },
    }
  }

  nuxtApp.provide('previewComponent', previewComponent)

  // Store nuxtApp globally and dispatch event when ready.
  onNuxtReady(() => {
    window.__nuxtComponentPreviewApp = nuxtApp
    const event = new CustomEvent('nuxt-component-preview:ready', {
      detail: { nuxtApp },
    })
    window.dispatchEvent(event)
  })
})
