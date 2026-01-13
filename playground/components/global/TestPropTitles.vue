<template>
  <div class="prop-titles-test">
    <p>Explicit: {{ explicitTitle }}</p>
    <p>Inferred: {{ inferredTitle }}</p>
    <p>Fallback: {{ fallbackTitle }}</p>
    <p>Single line: {{ singleLine }}</p>
    <p>No JSDoc: {{ noJsDoc }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /**
   * Description for this prop
   * @title Custom Title Override
   */
  explicitTitle?: string

  /**
   * Short JSDoc summary
   *
   * This is the longer description that
   * spans multiple lines.
   */
  inferredTitle?: string

  /**
   * This description line is way too long to be used as a title so it should fall back to name-based generation instead
   */
  fallbackTitle?: string

  /** No newlines, short enough */
  singleLine?: string

  noJsDoc?: string
}>()
</script>
