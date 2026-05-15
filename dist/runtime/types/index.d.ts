import type { NuxtApp } from '#app'

declare global {
  interface Window {
    __nuxtComponentPreviewApp?: NuxtApp
  }
}

export {}
