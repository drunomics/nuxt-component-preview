<template>
  <div
    class="two-column-layout"
    :data-component-id="'canvas_test_sdc:two_column'"
  >
    <div :class="`column-one width-${width}`">
      <slot name="column-one">
        The contents of the one column.
      </slot>
    </div>
    <div :class="`column-two width-${secondColumnWidth}`">
      <slot name="column-two">
        The contents of the two column.
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /**
   * First column width as percentage
   * @example 33
   * @example 50
   * @example 66
   * @enumLabels {"25": "25% / 75%", "33": "33% / 67%", "34": "34% / 66%", "50": "50% / 50%", "66": "66% / 34%", "67": "67% / 33%", "75": "75% / 25%"}
   */
  width?: 25 | 33 | 34 | 50 | 66 | 67 | 75
}>(), {
  width: 50,
})

defineSlots<{
  /**
   * First column content
   */
  'column-one'?(): unknown
  /**
   * Second column content
   */
  'column-two'?(): unknown
}>()

const secondColumnWidth = computed(() => {
  return 100 - props.width
})
</script>

<style scoped>
/* Match the SDC CSS structure */
[data-component-id="canvas_test_sdc:two_column"] {
  display: flex;
}

.width-25 {
  flex: 0 1 25%;
  max-width: 25%;
}

.width-33 {
  flex: 0 1 33%;
  max-width: 33%;
}

.width-34 {
  flex: 0 1 34%;
  max-width: 34%;
}

.width-50 {
  flex: 0 1 50%;
  max-width: 50%;
}

.width-66 {
  flex: 0 1 66%;
  max-width: 66%;
}

.width-67 {
  flex: 0 1 67%;
  max-width: 67%;
}

.width-75 {
  flex: 0 1 75%;
  max-width: 75%;
}

/* Responsive behavior */
@media (max-width: 768px) {
  [data-component-id="canvas_test_sdc:two_column"] {
    flex-direction: column;
  }

  [data-component-id="canvas_test_sdc:two_column"] > div {
    flex: 1 1 100% !important;
    max-width: 100% !important;
    width: 100%;
  }
}
</style>
