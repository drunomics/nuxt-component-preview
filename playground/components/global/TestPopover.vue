<template>
  <div
    ref="popoverContainer"
    class="popover-container"
  >
    <div
      ref="triggerEl"
      class="popover-trigger"
      @click="handleTriggerClick"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <slot name="trigger">
        <button class="default-trigger">
          Click me
        </button>
      </slot>
    </div>

    <Teleport to="body">
      <Transition name="popover">
        <div
          v-if="isOpen"
          ref="popoverEl"
          class="popover-content"
          :class="`placement-${placement}`"
          :style="popoverStyle"
          @click.stop
        >
          <div
            v-if="showArrow"
            class="popover-arrow"
            :style="arrowStyle"
          />
          <slot>
            <div class="default-content">
              Popover content goes here
            </div>
          </slot>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, watch, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  /** Popover placement @example bottom */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
  /** Trigger type @example click */
  trigger?: 'click' | 'hover'
  /** Offset in pixels @example 8 */
  offset?: number
  /** Show arrow pointer */
  showArrow?: boolean
  /** Close on click outside */
  closeOnClickOutside?: boolean
  /** Delay in milliseconds */
  delay?: number
}>(), {
  placement: 'bottom',
  trigger: 'click',
  offset: 8,
  showArrow: true,
  closeOnClickOutside: true,
  delay: 0,
})

const isOpen = ref(false)
const triggerEl = ref(null)
const popoverEl = ref(null)
const popoverContainer = ref(null)
const popoverStyle = ref({})
const arrowStyle = ref({})
let hoverTimeout = null

const calculatePosition = () => {
  if (!triggerEl.value || !popoverEl.value) return

  const triggerRect = triggerEl.value.getBoundingClientRect()
  const popoverRect = popoverEl.value.getBoundingClientRect()
  const offset = props.offset + (props.showArrow ? 8 : 0)

  let top = 0
  let left = 0
  let arrowTop = '50%'
  let arrowLeft = '50%'
  let arrowTransform = 'translate(-50%, -50%)'

  switch (props.placement) {
    case 'top':
      top = triggerRect.top - popoverRect.height - offset
      left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2
      arrowTop = '100%'
      arrowTransform = 'translate(-50%, -50%) rotate(180deg)'
      break

    case 'top-start':
      top = triggerRect.top - popoverRect.height - offset
      left = triggerRect.left
      arrowTop = '100%'
      arrowLeft = '20px'
      arrowTransform = 'translate(0, -50%) rotate(180deg)'
      break

    case 'top-end':
      top = triggerRect.top - popoverRect.height - offset
      left = triggerRect.right - popoverRect.width
      arrowTop = '100%'
      arrowLeft = 'calc(100% - 20px)'
      arrowTransform = 'translate(-100%, -50%) rotate(180deg)'
      break

    case 'bottom':
      top = triggerRect.bottom + offset
      left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2
      arrowTop = '0'
      arrowTransform = 'translate(-50%, -50%)'
      break

    case 'bottom-start':
      top = triggerRect.bottom + offset
      left = triggerRect.left
      arrowTop = '0'
      arrowLeft = '20px'
      arrowTransform = 'translate(0, -50%)'
      break

    case 'bottom-end':
      top = triggerRect.bottom + offset
      left = triggerRect.right - popoverRect.width
      arrowTop = '0'
      arrowLeft = 'calc(100% - 20px)'
      arrowTransform = 'translate(-100%, -50%)'
      break

    case 'left':
      top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2
      left = triggerRect.left - popoverRect.width - offset
      arrowTop = '50%'
      arrowLeft = '100%'
      arrowTransform = 'translate(-50%, -50%) rotate(90deg)'
      break

    case 'right':
      top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2
      left = triggerRect.right + offset
      arrowTop = '50%'
      arrowLeft = '0'
      arrowTransform = 'translate(-50%, -50%) rotate(-90deg)'
      break
  }

  // Viewport boundary checks
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const scrollX = window.scrollX
  const scrollY = window.scrollY

  // Adjust if going off screen
  if (left < 0) left = offset
  if (left + popoverRect.width > viewportWidth) {
    left = viewportWidth - popoverRect.width - offset
  }
  if (top < 0) top = offset
  if (top + popoverRect.height > viewportHeight) {
    top = viewportHeight - popoverRect.height - offset
  }

  popoverStyle.value = {
    position: 'absolute',
    top: `${top + scrollY}px`,
    left: `${left + scrollX}px`,
    zIndex: 9999,
  }

  arrowStyle.value = {
    top: arrowTop,
    left: arrowLeft,
    transform: arrowTransform,
  }
}

const handleTriggerClick = () => {
  if (props.trigger === 'click') {
    isOpen.value = !isOpen.value
  }
}

const handleMouseEnter = () => {
  if (props.trigger === 'hover') {
    clearTimeout(hoverTimeout)
    hoverTimeout = setTimeout(() => {
      isOpen.value = true
    }, props.delay)
  }
}

const handleMouseLeave = () => {
  if (props.trigger === 'hover') {
    clearTimeout(hoverTimeout)
    hoverTimeout = setTimeout(() => {
      isOpen.value = false
    }, 100)
  }
}

const handleClickOutside = (event) => {
  if (!props.closeOnClickOutside) return

  if (popoverContainer.value && !popoverContainer.value.contains(event.target)
    && popoverEl.value && !popoverEl.value.contains(event.target)) {
    isOpen.value = false
  }
}

const handleScroll = () => {
  if (isOpen.value) {
    calculatePosition()
  }
}

watch(isOpen, async (newVal) => {
  if (newVal) {
    await nextTick()
    calculatePosition()
    document.addEventListener('click', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', calculatePosition)
  }
  else {
    document.removeEventListener('click', handleClickOutside)
    window.removeEventListener('scroll', handleScroll, true)
    window.removeEventListener('resize', calculatePosition)
  }
})

onBeforeUnmount(() => {
  clearTimeout(hoverTimeout)
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('resize', calculatePosition)
})
</script>

<style scoped>
.popover-container {
  display: inline-block;
  position: relative;
}

.popover-trigger {
  display: inline-block;
}

.default-trigger {
  padding: 0.5rem 1rem;
  background: #007acc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.default-trigger:hover {
  background: #005a9e;
}

.popover-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 5px 10px rgba(0, 0, 0, 0.08);
  padding: 1rem;
  max-width: 300px;
  font-size: 0.95rem;
  line-height: 1.5;
}

.default-content {
  color: #333;
}

.popover-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 8px 8px 0 8px;
  border-color: white transparent transparent transparent;
  filter: drop-shadow(0 -2px 2px rgba(0, 0, 0, 0.1));
}

/* Transition animations */
.popover-enter-active,
.popover-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.popover-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.popover-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Placement-specific adjustments */
.placement-top .popover-arrow,
.placement-top-start .popover-arrow,
.placement-top-end .popover-arrow {
  border-width: 0 8px 8px 8px;
  border-color: transparent transparent white transparent;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.1));
}

.placement-left .popover-arrow {
  border-width: 8px 0 8px 8px;
  border-color: transparent transparent transparent white;
  filter: drop-shadow(2px 0 2px rgba(0, 0, 0, 0.1));
}

.placement-right .popover-arrow {
  border-width: 8px 8px 8px 0;
  border-color: transparent white transparent transparent;
  filter: drop-shadow(-2px 0 2px rgba(0, 0, 0, 0.1));
}
</style>
