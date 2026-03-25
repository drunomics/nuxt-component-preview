<template>
  <div class="banner">
    <img
      v-if="image"
      :src="image.src"
      :alt="image.alt"
      :width="image.width"
      :height="image.height"
    >
    <h2>{{ heading }}</h2>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /**
   * Banner heading (required)
   * @example Welcome to our site
   */
  heading: string
  /**
   * Banner image using key-value syntax
   * @example src=https://placehold.co/600x400 alt="Banner image" width=600 height=400
   */
  image?: CanvasImage
}>()
</script>
