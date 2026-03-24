import { readFileSync } from 'node:fs'
import { defineEventHandler, setHeader, createError } from 'h3'
// @ts-expect-error - virtual module
import configPath from '#nuxt-component-preview-config-path'

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
export default defineEventHandler(async (event) => {
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
