import { readFileSync } from 'node:fs'
import { defineEventHandler, setHeader, createError } from 'h3'
// @ts-expect-error - virtual module
import cachedComponentIndexData from '#nuxt-component-preview-index-data'
// @ts-expect-error - virtual module
import devConfigPath from '#nuxt-component-preview-dev-config-path'

export default defineEventHandler(async (event) => {
  let componentIndexData = cachedComponentIndexData

  // In dev mode, read the latest config from file and regenerate on each
  // request. The config file is updated by the module's
  // app:templatesGenerated hook whenever components are added or removed.
  // The generateComponentIndex call re-reads Vue files via
  // vue-component-meta, so prop changes are also reflected immediately.
  if (devConfigPath) {
    const config = JSON.parse(readFileSync(devConfigPath, 'utf-8'))
    const { prepareComponentIndex } = await import('../../utils/prepareComponentIndex')
    componentIndexData = prepareComponentIndex(config)
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
