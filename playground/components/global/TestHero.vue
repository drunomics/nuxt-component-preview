<template>
  <section class="hero">
    <h1>{{ title }}</h1>
    <p v-if="description">
      {{ description }}
    </p>
    <img
      v-if="image"
      :src="image.src"
      :alt="image.alt"
      :width="image.width"
      :height="image.height"
    >
  </section>
</template>

<script setup lang="ts">
/**
 * Test Hero
 * @description A hero section with title, description, and background image.
 * @category Hero
 * @status experimental
 */
withDefaults(defineProps<{
  /**
   * Hero title
   * @example Welcome to our site
   * @example Transform Your Business
   */
  title?: string
  /**
   * Hero description
   * @example We help businesses grow with innovative solutions
   */
  description?: string
  /**
   * Hero image
   * @example {"src": "https://placehold.co/800x600", "alt": "Example image", "width": 800, "height": 600}
   */
  image?: CanvasImage
}>(), {
  title: '',
  description: '',
  image: () => ({
    src: 'https://placehold.co/1200x800',
    alt: 'Default hero image',
    width: 1200,
    height: 800,
  }),
})
</script>
