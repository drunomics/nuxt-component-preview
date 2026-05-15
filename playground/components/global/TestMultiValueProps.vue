<script setup lang="ts">
withDefaults(defineProps<{
  /**
   * Plain text values
   * @example ["Hello World", "Sample Text"]
   */
  textValues?: string[]
  /**
   * Limited plain text (max 3)
   * @maxItems 3
   */
  textLimited?: string[]
  /**
   * Required text values
   * @minItems 1
   */
  requiredText: string[]
  /**
   * Numbers
   * @example [42, 100]
   */
  numbers?: number[]
  /**
   * Links (absolute URLs)
   * @itemsFormat uri
   * @example ["https://drupal.org", "https://example.com"]
   */
  links?: string[]
  /**
   * Limited links (max 3)
   * @itemsFormat uri
   * @maxItems 3
   */
  linksLimited?: string[]
  /**
   * Relative links
   * @itemsFormat uri-reference
   * @example ["/about", "/contact"]
   */
  relativeLinks?: string[]
  /**
   * DateTimes
   * @itemsFormat date-time
   */
  dateTimes?: string[]
  /**
   * Dates
   * @itemsFormat date
   */
  dates?: string[]
  /**
   * Text list (string enum)
   * @example ["option_one", "option_two"]
   */
  listText?: ('option_one' | 'option_two' | 'option_three' | 'option_four')[]
  /**
   * Limited text list
   * @maxItems 3
   * @enumLabels {"draft": "Draft", "review": "In Review", "live": "Live"}
   */
  listTextLimited?: ('draft' | 'review' | 'live')[]
  /**
   * Integer list (numeric enum)
   * @example [10, 20]
   * @enumLabels {"10": "Ten", "20": "Twenty", "30": "Thirty", "40": "Forty"}
   */
  listInt?: (10 | 20 | 30 | 40)[]
  /**
   * Gallery images
   * @maxItems 5
   */
  images?: CanvasImage[]
  /**
   * Public file attachments
   * @itemsSchemaRef canvas/stream-wrapper-uri
   */
  attachments?: string[]
}>(), {})
</script>

<template>
  <div class="test-multi-value-props" />
</template>
