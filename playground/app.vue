<template>
  <ComponentPreviewArea v-if="useRuntimeConfig().public.componentPreview?.active" />
  <NuxtPage v-else />
</template>

<script setup>
</script>
