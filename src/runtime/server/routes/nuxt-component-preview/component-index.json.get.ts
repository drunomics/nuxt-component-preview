// @ts-expect-error - virtual module
import componentIndexData from '#nuxt-component-preview-index-data'

export default defineEventHandler((event) => {
  if (!componentIndexData) {
    throw createError({
      statusCode: 404,
      message: 'Component index not generated. Ensure componentIndex is enabled.',
    })
  }

  setHeader(event, 'Content-Type', 'application/json')
  // Private cache only, revalidate on each request, no proxy caching
  setHeader(event, 'Cache-Control', 'private, must-revalidate, no-store, max-age=0')

  return componentIndexData
})
