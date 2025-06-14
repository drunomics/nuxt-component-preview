// vitest.config.ts
import { fileURLToPath } from 'node:url'
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environmentOptions: {
      nuxt: {
        rootDir: fileURLToPath(new URL('./playground', import.meta.url)),
        port: 3001,
        overrides: {
          modules: ['../src/module.ts'],
        },
      },
    },
    testTimeout: 5000,
    include: ['test/**/*.test.ts'],
  },
})
