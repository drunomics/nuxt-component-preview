import { defineEventHandler, setResponseHeader, getRequestURL } from "h3";
import { useRuntimeConfig } from "#imports";
import entryPath from "#nuxt-entry-path";
import entryCssPaths from "#nuxt-entry-css-paths";
export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const buildId = config.app.buildId;
  const baseURL = config.app.baseURL || "/";
  const buildAssetsDir = config.app.buildAssetsDir || "/_nuxt/";
  let cdnURL = config.app.cdnURL;
  if (!cdnURL) {
    const requestURL = getRequestURL(event);
    cdnURL = requestURL.port ? `${requestURL.protocol}//${requestURL.hostname}:${requestURL.port}` : `${requestURL.protocol}//${requestURL.host}`;
  }
  const publicConfig = {
    componentPreview: true,
    ...config.public,
    componentPreviewActive: true
  };
  const publicConfigStr = JSON.stringify(publicConfig);
  const entryCssPathsStr = JSON.stringify(entryCssPaths || []);
  const script = `(function() {
    // Allow data-attribute overrides on the script element.
    var scriptEl = document.currentScript;
    var attrCdnURL = scriptEl && scriptEl.hasAttribute('data-cdn-url')
      ? scriptEl.getAttribute('data-cdn-url') : null;
    var attrBuildAssetsDir = scriptEl && scriptEl.hasAttribute('data-build-assets-dir')
      ? scriptEl.getAttribute('data-build-assets-dir') : null;

    // Derive the origin from the script's own URL so it works regardless of
    // which host/port serves the static files (important for nuxt generate).
    // Falls back to the build-time cdnURL when the script is inlined or the
    // src attribute is missing.
    var scriptOrigin = "${cdnURL}";
    if (scriptEl && scriptEl.src) {
      try { scriptOrigin = new URL(scriptEl.src).origin; } catch(e) {}
    }

    var effectiveCdnURL = attrCdnURL !== null ? attrCdnURL : scriptOrigin;
    var effectiveBuildAssetsDir = attrBuildAssetsDir !== null
      ? attrBuildAssetsDir : "${buildAssetsDir}";
    var effectiveEntryPath = (attrCdnURL !== null ? attrCdnURL : scriptOrigin) + "${entryPath}";

    // Set Nuxt config IMMEDIATELY when script runs, before DOM ready
    // This ensures app.vue can read the config when it evaluates
    window.__NUXT__ = {
      config: {
        public: ${publicConfigStr},
        app: {
          baseURL: "${baseURL}",
          buildId: "${buildId}",
          buildAssetsDir: effectiveBuildAssetsDir,
          cdnURL: effectiveCdnURL
        }
      }
    };

    // Function to initialize Nuxt DOM elements
    function initNuxt() {
      // Check if already initialized
      if (document.getElementById('__nuxt')) return;

      console.log('[nuxt] Nuxt app for component preview is initializing...');

      // Create hidden Nuxt app container
      const nuxt = document.createElement('div');
      nuxt.id = '__nuxt';
      nuxt.style.display = 'none';
      document.body.insertBefore(nuxt, document.body.firstChild);

      // Create teleports container
      const teleports = document.createElement('div');
      teleports.id = 'teleports';
      document.body.insertBefore(teleports, nuxt.nextSibling);

      // Add Nuxt data script - minimal client-side initialization
      const nuxtData = document.createElement('script');
      nuxtData.type = 'application/json';
      nuxtData.setAttribute('data-nuxt-data', 'nuxt-app');
      nuxtData.setAttribute('data-ssr', 'false');
      nuxtData.id = '__NUXT_DATA__';
      nuxtData.textContent = '[{"serverRendered":1},false]';
      document.body.appendChild(nuxtData);

      // Load entry CSS files. In SSR mode Nuxt injects these as <link> tags
      // in the rendered HTML. In CSR/preview mode we must add them explicitly.
      var entryCssPaths = ${entryCssPathsStr};
      entryCssPaths.forEach(function(cssPath) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = effectiveCdnURL + cssPath;
        link.crossOrigin = '';
        document.head.appendChild(link);
      });

      // Add import map (must be in head before module scripts)
      const importMap = document.createElement('script');
      importMap.type = 'importmap';
      importMap.textContent = '{"imports":{"#entry":"' + effectiveEntryPath + '"}}';
      document.head.appendChild(importMap);

      // Load entry module
      const entry = document.createElement('script');
      entry.type = 'module';
      entry.src = effectiveEntryPath;
      document.head.appendChild(entry);
    }

    // Wait for DOM to be ready before adding DOM elements
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNuxt);
    } else {
      // DOM is already ready
      initNuxt();
    }
  })();`;
  setResponseHeader(event, "Content-Type", "application/javascript");
  setResponseHeader(event, "Cache-Control", "private, max-age=300, must-revalidate");
  return script;
});
