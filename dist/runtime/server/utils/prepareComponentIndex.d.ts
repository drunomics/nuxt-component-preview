import type { Component } from '@nuxt/schema';
import { type ComponentIndexData, type ComponentIndexOptions } from './generateComponentIndex.js';
export interface PrepareComponentIndexConfig {
    components: Pick<Component, 'pascalName' | 'kebabName' | 'filePath' | 'shortPath' | 'global'>[];
    tsconfigPath: string;
    options: ComponentIndexOptions;
}
/**
 * Prepare component index from pre-resolved components and generate metadata.
 * Used both at build time (production) and runtime (dev mode).
 */
export declare function prepareComponentIndex(config: PrepareComponentIndexConfig): ComponentIndexData | null;
