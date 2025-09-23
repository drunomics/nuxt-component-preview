import { defineEventHandler, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
// @ts-ignore
import entryPath from '#nuxt-entry-path'

export default defineEventHandler((event) => {
  // Get runtime config for buildId and any runtime public config
  const config = useRuntimeConfig()

  // Prepare all variables
  const buildId = config.app.buildId
  const baseURL = config.app.baseURL || '/'
  const buildAssetsDir = config.app.buildAssetsDir || '/_nuxt/'
  const cdnURL = config.app.cdnURL || ''
  const entryPathValue = entryPath

  // Serialize public config (with componentPreview enabled)
  // Only include what's needed for the client
  const publicConfigStr = JSON.stringify({
    ...config.public,
    componentPreview: true
  })

  // Generate the script with prepared values
  const script = `(function() {
    // Check if already initialized
    if (document.getElementById('__nuxt')) return;

    // Create hidden Nuxt app container
    const nuxt = document.createElement('div');
    nuxt.id = '__nuxt';
    nuxt.style.display = 'none';
    document.body.insertBefore(nuxt, document.body.firstChild);

    // Create teleports container
    const teleports = document.createElement('div');
    teleports.id = 'teleports';
    document.body.insertBefore(teleports, nuxt.nextSibling);

    // Add Nuxt data script
    const nuxtData = document.createElement('script');
    nuxtData.type = 'application/json';
    nuxtData.setAttribute('data-nuxt-data', 'nuxt-app');
    nuxtData.setAttribute('data-ssr', 'false');
    nuxtData.id = '__NUXT_DATA__';
    nuxtData.textContent = '[{"serverRendered":1},false]';
    document.head.appendChild(nuxtData);

    // Add Nuxt config with componentPreview enabled
    const nuxtConfig = document.createElement('script');
    nuxtConfig.textContent = 'window.__NUXT__ = {};' +
      'window.__NUXT__.config = {' +
        'public: ' + '${publicConfigStr}' + ',' +
        'app: {' +
          'baseURL: "${baseURL}",' +
          'buildId: "${buildId}",' +
          'buildAssetsDir: "${buildAssetsDir}",' +
          'cdnURL: "${cdnURL}"' +
        '}' +
      '};';
    document.head.appendChild(nuxtConfig);

    // Add import map
    const importMap = document.createElement('script');
    importMap.type = 'importmap';
    importMap.textContent = '{"imports":{"#entry":"${entryPathValue}"}}';
    document.head.appendChild(importMap);

    // Load entry module
    const entry = document.createElement('script');
    entry.type = 'module';
    entry.src = '${entryPathValue}';
    document.head.appendChild(entry);

    // Add event listener for component preview
    window.addEventListener('nuxt-component-preview:ready', function(event) {
      console.log('Nuxt Component Preview initialized via loader');
    });
  })();`

  // Set headers using h3 helper
  setResponseHeader(event, 'Content-Type', 'application/javascript')

  // Always use no-cache headers since URL doesn't change across builds
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')
  setResponseHeader(event, 'Pragma', 'no-cache')
  setResponseHeader(event, 'Expires', '0')

  return script
})