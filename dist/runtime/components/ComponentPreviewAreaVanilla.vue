<script setup>
import { h, resolveComponent } from "vue";
import { useState } from "#imports";
const previews = useState("componentPreviews", () => []);
function renderComponent(preview) {
  const { element, props = {}, slots = {} } = preview.content;
  const component = resolveComponent(element);
  if (!component || typeof component === "string") {
    console.warn(`Component "${element}" not found for preview`);
    return h("div", { class: "preview-error" }, `Component "${element}" not found`);
  }
  const slotContent = {};
  for (const [slotName, content] of Object.entries(slots)) {
    if (content) {
      slotContent[slotName] = () => {
        if (content instanceof HTMLElement) {
          return h("div", {
            ref: (el) => {
              if (el && content.childNodes.length > 0) {
                while (content.firstChild) {
                  el.appendChild(content.firstChild);
                }
                content.remove();
              }
            },
            style: { display: "contents" }
          });
        }
        return h("div", { innerHTML: content, style: { display: "contents" } });
      };
    }
  }
  return h(component, props, slotContent);
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
