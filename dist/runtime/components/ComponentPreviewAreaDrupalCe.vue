<script setup>
import { h } from "vue";
import { useState, useDrupalCe } from "#imports";
const previews = useState("componentPreviews", () => []);
const { resolveCustomElement } = useDrupalCe();
function renderComponent(preview) {
  const { element, props = {}, slots = {} } = preview.content;
  const component = resolveCustomElement(element);
  if (!component || typeof component === "string") {
    console.error(`Component "${element}" not found via drupal-ce resolver`);
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
                const fragment = document.createDocumentFragment();
                while (content.firstChild) {
                  fragment.appendChild(content.firstChild);
                }
                el.appendChild(fragment);
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
