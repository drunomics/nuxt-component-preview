import { defineEventHandler, setResponseHeader, getRequestURL } from 'h3'
import { useRuntimeConfig } from '#imports'
// @ts-expect-error - Virtual import
import entryPath from '#nuxt-entry-path'

export default defineEventHandler((event) => {
  // Get runtime config for buildId and any runtime public config
  const config = useRuntimeConfig()

  // Prepare all variables
  const buildId = config.app.buildId
  const baseURL = config.app.baseURL || '/'
  const buildAssetsDir = config.app.buildAssetsDir || '/_nuxt/'

  // Set cdnURL - use config if set, otherwise use the current request's origin.
  let cdnURL = config.app.cdnURL
  if (!cdnURL) {
    const requestURL = getRequestURL(event)
    cdnURL = requestURL.port
      ? `${requestURL.protocol}//${requestURL.hostname}:${requestURL.port}`
      : `${requestURL.protocol}//${requestURL.host}`
  }

  const entryPathValue = cdnURL + entryPath

  // Serialize public config (with componentPreview enabled)
  // Only include what's needed for the client
  const publicConfig = {
    ...config.public,
    componentPreview: true,
  }
  const publicConfigStr = JSON.stringify(publicConfig)

  // Generate the script with prepared values
  const script = `(function() {
    // Set Nuxt config IMMEDIATELY when script runs, before DOM ready
    // This ensures app.vue can read the config when it evaluates
    window.__NUXT__ = {
      config: {
        public: ${publicConfigStr},
        app: {
          baseURL: "${baseURL}",
          buildId: "${buildId}",
          buildAssetsDir: "${buildAssetsDir}",
          cdnURL: "${cdnURL}"
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

      // Add import map (must be in head before module scripts)
      const importMap = document.createElement('script');
      importMap.type = 'importmap';
      importMap.textContent = '{"imports":{"#entry":"${entryPathValue}"}}';
      document.head.appendChild(importMap);

      // Load entry module
      const entry = document.createElement('script');
      entry.type = 'module';
      entry.crossOrigin = 'use-credentials';
      entry.src = '${entryPathValue}';
      document.head.appendChild(entry);
    }

    // Wait for DOM to be ready before adding DOM elements
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNuxt);
    } else {
      // DOM is already ready
      initNuxt();
    }
  })();`

  // Set headers using h3 helper
  setResponseHeader(event, 'Content-Type', 'application/javascript')

  // Cache for 5 minutes to avoid constant reloads, but revalidate to catch new builds
  // private ensures proxies/CDNs don't cache it
  setResponseHeader(event, 'Cache-Control', 'private, max-age=300, must-revalidate')

  return script
})
