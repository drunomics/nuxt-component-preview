/**
 * Image type compatible with Drupal Canvas.
 *
 * When used as a component prop type, generates JSON schema with:
 * - type: "object"
 * - $ref: "json-schema-definitions://canvas.module/image"
 *
 * This enables Canvas to:
 * - Show media library selection widget
 * - Handle responsive image generation
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * defineProps<{
 *   heroImage?: CanvasImage
 * }>()
 * </script>
 * ```
 */
export interface CanvasImage {
  /** Image URL (relative or absolute) */
  src: string
  /** Alternative text for accessibility */
  alt: string
  /** Image width in pixels */
  width: number
  /** Image height in pixels */
  height: number
}

/**
 * Video type compatible with Drupal Canvas.
 *
 * When used as a component prop type, generates JSON schema with:
 * - type: "object"
 * - $ref: "json-schema-definitions://canvas.module/video"
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * defineProps<{
 *   promoVideo?: CanvasVideo
 * }>()
 * </script>
 * ```
 */
export interface CanvasVideo {
  /** Video URL */
  src: string
  /** Poster image URL */
  poster?: string
}
