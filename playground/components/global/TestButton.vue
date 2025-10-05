<template>
  <button
    class="test-button"
    :class="[`variant-${variant}`, `size-${size}`, { disabled }]"
    :disabled="disabled"
    @click="handleClick"
  >
    <slot>{{ label }}</slot>
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /**
   * Button label text
   * @example Submit
   * @example Cancel
   * @example Learn More
   */
  label?: string
  /**
   * Visual style variant
   * @example primary
   * @example success
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  /**
   * Button size
   * @example medium
   * @enumLabels {"large": "Extra Large (XL)"}
   */
  size?: 'small' | 'medium' | 'large'
  /**
   * Whether the button is disabled
   */
  disabled?: boolean
}>(), {
  label: 'Click me',
  variant: 'primary',
  size: 'medium',
  disabled: false,
})

const emit = defineEmits(['click'])

const handleClick = (event) => {
  emit('click', event)
  console.log('Button clicked!')
}
</script>

<style scoped>
.test-button {
  font-family: inherit;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-block;
  text-align: center;
  text-decoration: none;
}

.test-button:hover:not(.disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.test-button:active:not(.disabled) {
  transform: translateY(0);
}

/* Size variants */
.size-small {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.size-medium {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}

.size-large {
  padding: 1rem 2rem;
  font-size: 1.125rem;
}

/* Color variants */
.variant-primary {
  background-color: #007acc;
  color: white;
}

.variant-primary:hover:not(.disabled) {
  background-color: #005a9e;
}

.variant-secondary {
  background-color: #6c757d;
  color: white;
}

.variant-secondary:hover:not(.disabled) {
  background-color: #5a6268;
}

.variant-success {
  background-color: #42b883;
  color: white;
}

.variant-success:hover:not(.disabled) {
  background-color: #36a372;
}

.variant-danger {
  background-color: #dc3545;
  color: white;
}

.variant-danger:hover:not(.disabled) {
  background-color: #c82333;
}

/* Disabled state */
.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
