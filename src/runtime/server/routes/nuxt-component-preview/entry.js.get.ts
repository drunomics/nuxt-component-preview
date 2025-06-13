export default defineEventHandler(async (event) => {
  // In development mode, dynamically discover the entry.js path
  if (process.dev || import.meta.dev) {
    const host = getHeader(event, 'host') || 'localhost:3000'
    const protocol = getHeader(event, 'x-forwarded-proto') || 'http'
    
    try {
      // Fetch the main page to extract the actual entry.js path
      const html = await $fetch('/', {
        baseURL: `${protocol}://${host}`,
        headers: { 'accept': 'text/html' }
      })
      
      // Extract the entry.js path from the HTML
      const entryMatch = html.match(/src="([^"]*entry\.js[^"]*)"/)
      if (entryMatch && entryMatch[1]) {
        await sendRedirect(event, entryMatch[1], 302)
        return
      }
    } catch (error) {
      // Fallback if we can't fetch the main page
    }
    
    // Dev mode fallback
    await sendRedirect(event, '/_nuxt/entry.js', 302)
  } else {
    // Production mode - redirect to the built entry file
    await sendRedirect(event, '/_nuxt/entry.js', 302)
  }
})