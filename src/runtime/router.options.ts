import type { RouterConfig } from '@nuxt/schema'
import { createMemoryHistory } from 'vue-router'

export default <RouterConfig>{
  // Only change history mode on client when preview mode is enabled
  history: (base) => {
    if (import.meta.client && typeof window !== 'undefined') {
      // Primary: componentPreviewActive. Legacy: componentPreview === true.
      const pub = useNuxtApp().payload.config?.public as
        { componentPreviewActive?: boolean, componentPreview?: unknown } | undefined
      if (pub?.componentPreviewActive === true || pub?.componentPreview === true) {
        console.log('[Component Preview] Using memory history')
        return createMemoryHistory(base)
      }
    }
    // Use Nuxt's default history otherwise (no return statement lets Nuxt handle it)
  },
}
