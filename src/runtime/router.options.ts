import type { RouterConfig } from '@nuxt/schema'
import { createMemoryHistory } from 'vue-router'

export default <RouterConfig>{
  // Only change history mode on client when preview mode is enabled
  history: (base) => {
    if (import.meta.client && typeof window !== 'undefined') {
      const componentPreview = useNuxtApp().payload.config?.public?.componentPreview as { active?: boolean } | undefined
      if (componentPreview?.active) {
        console.log('[Component Preview] Using memory history')
        return createMemoryHistory(base)
      }
    }
    // Use Nuxt's default history otherwise (no return statement lets Nuxt handle it)
  },
}
