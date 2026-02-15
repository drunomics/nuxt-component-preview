<template>
  <div class="subfolder-example">
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /**
   * Example title
   */
  title?: string
  /**
   * Example description
   */
  description?: string
}>()
</script>
