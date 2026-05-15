import { createMemoryHistory } from "vue-router";
export default {
  // Only change history mode on client when preview mode is enabled
  history: (base) => {
    if (import.meta.client && typeof window !== "undefined") {
      const pub = useNuxtApp().payload.config?.public;
      if (pub?.componentPreviewActive === true || pub?.componentPreview === true) {
        console.log("[Component Preview] Using memory history");
        return createMemoryHistory(base);
      }
    }
  }
};
