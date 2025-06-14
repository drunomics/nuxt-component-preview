<template>
  <div class="test-card">
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: 'Default Title',
  },
  description: {
    type: String,
    default: 'Default description',
  },
})
</script>

<style scoped>
.test-card {
  padding: 1rem;
  border: 2px solid #42b883;
  border-radius: 8px;
  background: #f9f9f9;
  margin: 1rem 0;
}
</style>
