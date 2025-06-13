<template>
  <ComponentPreviewArea v-if="useRuntimeConfig().public.componentPreview" />
  <NuxtPage v-else />
</template>

<script setup>
</script>
