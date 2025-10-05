<template>
  <div class="test-card">
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /**
   * Card title
   * @example Featured Article
   * @example Product Showcase
   */
  title?: string
  /**
   * Card description text
   * @example Learn more about our services
   * @example Discover new features
   */
  description?: string
}>(), {
  title: 'Default Title',
  description: 'Default description',
})
</script>

<style scoped>
.test-card {
  padding: 1rem;
  border: 2px solid #42b883;
  border-radius: 8px;
  background: #f9f9f9;
  margin: 1rem 0;
}
</style>
