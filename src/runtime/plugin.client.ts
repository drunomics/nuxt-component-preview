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
   * @param {Object} props - Props to pass to the component
   * @param {string|Element} target - CSS selector or DOM element where the component will be rendered
   * @returns {Object} An object with unmount method
   */
  function previewComponent(componentName, props, target) {
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
        ...props
      }
    }

    previews.value.push(previewData)

    return {
      unmount() {
        previews.value = previews.value.filter(c => c.target !== targetEl)
      }
    }
  }

  // Provide the preview function
  nuxtApp.provide('previewComponent', previewComponent)

  // Dispatch ready event when Nuxt is ready
  onNuxtReady(() => {
    const event = new CustomEvent('nuxt-component-preview:ready', {
      detail: { nuxtApp }
    })
    window.dispatchEvent(event)
  })
})