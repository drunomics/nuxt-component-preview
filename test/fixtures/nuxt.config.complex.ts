export default defineNuxtConfig({
  modules: ['../../src/module'],
  devtools: { enabled: true },
  sourcemap: true,
  // Complex public config to test escaping edge cases
  runtimeConfig: {
    public: {
      testConfig: {
        name: 'Test with "quotes"',
        description: "Test with 'single quotes'",
        nested: {
          value: "$t(\"some.translation.key\")",
          another: "GTM-K8BN8699",
          mixed: 'Value with "double" and \'single\' quotes',
          backslash: "Path\\with\\backslashes",
          complex: {
            array: [
              { name: "$t(\"test.name\")", value: "test's value" },
              { id: "GTM-123", desc: 'Item with "quotes"' }
            ]
          }
        }
      }
    }
  }
})