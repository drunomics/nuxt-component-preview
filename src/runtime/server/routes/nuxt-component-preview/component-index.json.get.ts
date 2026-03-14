import { readFileSync } from 'node:fs'
import { defineEventHandler, setHeader, createError } from 'h3'
// @ts-expect-error - virtual module
import configPath from '#nuxt-component-preview-config-path'

/**
 * Serves the component index JSON.
 *
 * Reads the config file written by the module's app:templatesGenerated hook
 * and generates the component index via vue-component-meta. In dev mode and
 * during prerendering this runs the full generation. In production SSR, the
 * prerendered static file is served by nitro directly — this handler is only
 * a fallback that returns 404, avoiding bundling vue-component-meta and the
 * TypeScript compiler (~8.7 MB) into the production server.
 */
export default defineEventHandler(async (event) => {
  if (!import.meta.dev && !import.meta.prerender) {
    throw createError({
      statusCode: 404,
      message: 'Component index is only available as a prerendered static asset.',
    })
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'))
  const { prepareComponentIndex } = await import('../../utils/prepareComponentIndex')
  const componentIndexData = prepareComponentIndex(config)

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
