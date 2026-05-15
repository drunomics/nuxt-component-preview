import { defineNuxtPlugin, useState, useRuntimeConfig, onNuxtReady, nextTick } from "#imports";
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const pub = config.public;
  if (pub.componentPreviewActive !== true && pub.componentPreview !== true) {
    return;
  }
  const previews = useState("componentPreviews", () => []);
  async function previewComponent(componentName, props = {}, slots = {}, target) {
    const targetEl = typeof target === "string" ? document.querySelector(target) : target;
    if (!targetEl) {
      throw new Error(`Target element "${target}" not found in DOM`);
    }
    const previewData = {
      target: targetEl,
      content: {
        element: componentName,
        props,
        slots
      }
    };
    previews.value.push(previewData);
    await nextTick();
    if (props["data-extjs-uuid"]) {
      targetEl.setAttribute("data-extjs-uuid", props["data-extjs-uuid"]);
    }
    targetEl.updateComponent = (propUpdates) => {
      const proxy = previews.value.find((p) => p.target === targetEl);
      if (!proxy) return false;
      proxy.content.props = { ...proxy.content.props, ...propUpdates };
      return true;
    };
    return {
      unmount() {
        previews.value = previews.value.filter((c) => c.target !== targetEl);
        delete targetEl.updateComponent;
      }
    };
  }
  nuxtApp.provide("previewComponent", previewComponent);
  onNuxtReady(() => {
    window.__nuxtComponentPreviewApp = nuxtApp;
    const event = new CustomEvent("nuxt-component-preview:ready", {
      detail: { nuxtApp }
    });
    window.dispatchEvent(event);
  });
});
