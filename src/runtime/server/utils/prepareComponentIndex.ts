import { scanComponentDirs } from './scanComponents'
import { generateComponentIndex, type ComponentIndexData, type ComponentIndexOptions } from './generateComponentIndex'

export interface PrepareComponentIndexConfig {
  componentDirs: string[]
  tsconfigPath: string
  options: ComponentIndexOptions
}

/**
 * Prepare component index by scanning directories and generating metadata.
 * Used both at build time (production) and runtime (dev mode).
 */
export function prepareComponentIndex(config: PrepareComponentIndexConfig): ComponentIndexData | null {
  try {
    const components = scanComponentDirs(config.componentDirs)

    if (components.length === 0) {
      return { version: '1.0', components: [] }
    }

    return generateComponentIndex(
      components,
      config.tsconfigPath,
      config.options,
    )
  }
  catch (error) {
    console.error('[nuxt-component-preview] Error preparing component index:', error)
    return null
  }
}
