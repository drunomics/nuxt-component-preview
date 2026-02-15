import type { Component } from '@nuxt/schema'
import { generateComponentIndex, type ComponentIndexData, type ComponentIndexOptions } from './generateComponentIndex'

export interface PrepareComponentIndexConfig {
  components: Pick<Component, 'pascalName' | 'kebabName' | 'filePath' | 'shortPath' | 'global'>[]
  tsconfigPath: string
  options: ComponentIndexOptions
}

/**
 * Prepare component index from pre-resolved components and generate metadata.
 * Used both at build time (production) and runtime (dev mode).
 */
export function prepareComponentIndex(config: PrepareComponentIndexConfig): ComponentIndexData | null {
  try {
    if (config.components.length === 0) {
      return { version: '1.0', components: [] }
    }

    return generateComponentIndex(
      config.components as Component[],
      config.tsconfigPath,
      config.options,
    )
  }
  catch (error) {
    console.error('[nuxt-component-preview] Error preparing component index:', error)
    return null
  }
}
