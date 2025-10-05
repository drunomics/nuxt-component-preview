// @ts-expect-error - virtual module
import componentIndexData from '#component-index-data'

export default defineEventHandler((event) => {
  if (!componentIndexData) {
    throw createError({
      statusCode: 404,
      message: 'Component index not generated. Ensure componentIndex is enabled.',
    })
  }

  setHeader(event, 'Content-Type', 'application/json')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')

  return componentIndexData
})
