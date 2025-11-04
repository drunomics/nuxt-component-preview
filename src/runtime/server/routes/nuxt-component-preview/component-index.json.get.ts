import { defineEventHandler, setHeader, createError } from 'h3'
// @ts-expect-error - virtual module
import componentIndexData from '#nuxt-component-preview-index-data'

export default defineEventHandler((event) => {
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
