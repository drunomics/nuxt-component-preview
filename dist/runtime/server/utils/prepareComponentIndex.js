import { generateComponentIndex } from "./generateComponentIndex.js";
export function prepareComponentIndex(config) {
  try {
    if (config.components.length === 0) {
      return { version: "1.0", components: [] };
    }
    return generateComponentIndex(
      config.components,
      config.tsconfigPath,
      config.options
    );
  } catch (error) {
    console.error("[nuxt-component-preview] Error preparing component index:", error);
    return null;
  }
}
