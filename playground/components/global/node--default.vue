<template>
  <article
    data-test-id="fallback-component"
    class="node-default"
  >
    <h2>{{ title || 'Default Node' }}</h2>
    <div class="content">
      {{ body || 'Default content' }}
    </div>
    <p class="fallback-notice">
      Rendered via node--default fallback
    </p>
  </article>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '',
  },
  body: {
    type: String,
    default: '',
  },
})
</script>

<style scoped>
.node-default {
  border: 2px solid #4CAF50;
  padding: 20px;
  background: #f0f9f0;
}
.fallback-notice {
  font-style: italic;
  color: #4CAF50;
  margin-top: 10px;
}
</style>
