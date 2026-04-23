<template>
  <ComponentPreviewArea v-if="useRuntimeConfig().public.componentPreviewActive" />
  <NuxtPage v-else />
</template>

<script setup>
</script>
