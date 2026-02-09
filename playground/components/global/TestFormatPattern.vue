<script setup lang="ts">
/**
 * Test component for @format, @pattern, and @allowed-schemes JSDoc tag functionality.
 */
defineProps<{
  /**
   * Event date
   *
   * A date value for the event.
   * @format date
   * @example 2024-12-25
   */
  eventDate?: string

  /**
   * Description
   *
   * Multi-line text description.
   * @pattern (.|\r?\n)*
   */
  description?: string

  /**
   * File URL
   *
   * A URL pointing to a file with restricted schemes.
   * @format uri
   * @allowed-schemes http, https
   */
  fileUrl?: string

  /** Regular text without format or pattern */
  title?: string
}>()
</script>

<template>
  <div class="format-pattern-test">
    <p v-if="eventDate">
      Date: {{ eventDate }}
    </p>
    <p v-if="description">
      {{ description }}
    </p>
    <p v-if="title">
      {{ title }}
    </p>
  </div>
</template>
