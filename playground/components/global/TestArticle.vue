<template>
  <article>
    <h1>{{ title }}</h1>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div
      v-if="summary"
      class="summary"
      v-html="summary"
    />
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div
      v-if="content"
      class="content"
      v-html="content"
    />
  </article>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /**
   * Article title
   */
  title?: string
  /**
   * Short summary with inline formatting only
   * @contentMediaType text/html
   * @formattingContext inline
   * @example This is <strong>important</strong> news
   */
  summary?: string
  /**
   * Full article content with block-level formatting
   * @contentMediaType text/html
   * @example <p>First paragraph with <em>emphasis</em>.</p><p>Second paragraph.</p>
   */
  content?: string
}>(), {
  title: 'Untitled',
})
</script>
