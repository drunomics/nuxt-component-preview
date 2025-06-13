<template>
  <ComponentPreviewArea v-if="useRuntimeConfig().public.componentPreview === true" />
  <NuxtPage v-else />
</template>

<script setup>
</script>
