<script setup lang="ts">
withDefaults(defineProps<{
  /**
   * List of tags
   * @example ["foo", "bar", "baz"]
   * @maxItems 10
   */
  tags?: string[]
  /**
   * Numbers for chart data
   */
  numbers: number[]
  /**
   * Gallery images
   * @maxItems 20
   */
  images?: CanvasImage[]
}>(), {
  tags: () => ['default-tag'],
})
</script>

<template>
  <div class="test-array-types">
    <div class="tags">
      <span
        v-for="tag in tags"
        :key="tag"
        class="tag"
      >{{ tag }}</span>
    </div>
    <div class="numbers">
      <span
        v-for="num in numbers"
        :key="num"
      >{{ num }}</span>
    </div>
    <div class="images">
      <img
        v-for="img in images"
        :key="img.src"
        :src="img.src"
        :alt="img.alt"
      >
    </div>
  </div>
</template>
