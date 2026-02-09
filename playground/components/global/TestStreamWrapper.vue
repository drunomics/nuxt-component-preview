<script setup lang="ts">
/**
 * Test component for @schemaRef JSDoc tag functionality.
 * Tests Canvas stream-wrapper URI schema references.
 */
defineProps<{
  /**
   * Image URI
   *
   * An image file stored in Drupal's public files directory.
   * @schemaRef canvas/stream-wrapper-image-uri
   * @example public://images/hero.jpg
   */
  imageUri?: string

  /**
   * Web image URL
   *
   * An image URL from the web (http/https).
   * @schemaRef canvas/image-uri
   * @example https://example.com/images/photo.jpg
   */
  webImageUrl?: string

  /**
   * Regular text
   *
   * A regular string prop without schema ref for comparison.
   */
  caption?: string
}>()
</script>

<template>
  <div class="stream-wrapper-test">
    <img
      v-if="imageUri"
      :src="imageUri"
      alt="Stream wrapper image"
    >
    <img
      v-if="webImageUrl"
      :src="webImageUrl"
      alt="Web image"
    >
    <p v-if="caption">
      {{ caption }}
    </p>
  </div>
</template>
