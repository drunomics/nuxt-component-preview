<template>
  <!-- eslint-disable-next-line -->
  <div v-html="content" class="markup"></div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /** HTML content to render */
  content?: string
}>(), {
  content: '',
})
</script>

<style scoped>
.test-markup {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}
</style>
