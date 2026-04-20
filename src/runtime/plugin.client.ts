import { defineNuxtPlugin, useState, useRuntimeConfig, onNuxtReady, nextTick } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  // Only activate when preview mode is enabled. Primary flag is
  // `componentPreviewActive`; legacy `componentPreview === true` is also
  // honoured so pre-migration consumers keep working.
  const config = useRuntimeConfig()
  const pub = config.public as { componentPreviewActive?: boolean, componentPreview?: unknown }
  if (pub.componentPreviewActive !== true && pub.componentPreview !== true) {
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

    // Copy data-extjs-uuid to the target element so canvas_extjs can find
    // it via querySelector for real-time preview updates.
    if (props['data-extjs-uuid']) {
      targetEl.setAttribute('data-extjs-uuid', props['data-extjs-uuid'])
    }

    // Set updateComponent on the target element so props can be updated
    // in-place without a full re-render. Callers can use this for real-time
    // preview updates or any prop patching scenario.
    targetEl.updateComponent = (propUpdates) => {
      const proxy = previews.value.find(p => p.target === targetEl)
      if (!proxy) return false
      proxy.content.props = { ...proxy.content.props, ...propUpdates }
      return true
    }

    return {
      unmount() {
        previews.value = previews.value.filter(c => c.target !== targetEl)
        delete targetEl.updateComponent
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
