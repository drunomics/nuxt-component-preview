<template>
  <div v-html="content" class="test-markup"></div>
</template>

<script setup>
defineProps({
  content: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.test-markup {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}
</style>