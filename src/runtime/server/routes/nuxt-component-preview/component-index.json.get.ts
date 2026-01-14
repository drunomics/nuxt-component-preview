import { defineEventHandler, setHeader, createError } from 'h3'
// @ts-expect-error - virtual module
import cachedComponentIndexData from '#nuxt-component-preview-index-data'
// @ts-expect-error - virtual module
import devConfig from '#nuxt-component-preview-dev-config'

export default defineEventHandler(async (event) => {
  let componentIndexData = cachedComponentIndexData

  // In dev mode, regenerate on each request for fresh data
  if (devConfig) {
    try {
      const { generateComponentIndex } = await import('../../utils/generateComponentIndex')
      componentIndexData = generateComponentIndex(
        devConfig.components,
        devConfig.tsconfigPath,
        devConfig.options,
      )
    }
    catch (error) {
      console.error('[nuxt-component-preview] Error generating component index:', error)
      componentIndexData = null
    }
  }

  if (!componentIndexData) {
    throw createError({
      statusCode: 500,
      message: 'Component index generation failed.',
    })
  }

  setHeader(event, 'Content-Type', 'application/json')
  // Allow client cache but must revalidate, no proxy caching
  setHeader(event, 'Cache-Control', 'private, must-revalidate, max-age=0')

  return componentIndexData
})
