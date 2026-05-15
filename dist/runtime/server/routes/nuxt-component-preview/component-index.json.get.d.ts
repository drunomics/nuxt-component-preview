/**
 * Serves the component index JSON.
 *
 * Reads the config file written by the module's app:templatesGenerated hook
 * and generates the component index via vue-component-meta.
 *
 * This handler is only registered for dev mode (live reload) and SSG
 * (prerendering). For SSR production builds, the component-index is
 * generated at build time via a Nuxt hook instead, keeping
 * vue-component-meta and TypeScript out of the production server bundle.
 */
declare const _default: import("h3").EventHandler<import("h3").EventHandlerRequest, Promise<import("../../utils/generateComponentIndex.js").ComponentIndexData>>;
export default _default;
