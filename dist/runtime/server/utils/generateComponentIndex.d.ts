import type { Component } from '@nuxt/schema';
/**
 * Extract package name from a file path in node_modules
 * Handles scoped packages (@org/package) and regular packages
 */
export declare function extractPackageName(filePath: string): string | null;
export interface CategoryDirectoryOptions {
    directory: true;
    fallback?: string;
}
export interface ComponentIndexOptions {
    category: string | CategoryDirectoryOptions;
    status: 'experimental' | 'stable' | 'deprecated' | 'obsolete';
    includePackages?: boolean | string[];
    includeDirectories?: string[];
    excludeDirectories?: string[];
    excludeComponents?: string[];
    overrides?: Record<string, {
        name?: string;
        description?: string;
        category?: string;
        status?: 'experimental' | 'stable' | 'deprecated' | 'obsolete';
    }>;
}
/**
 * Resolve category for a component based on its shortPath and the category option.
 *
 * When category is a string, it's used as-is.
 * When category is { directory: true }, the parent folder name is used.
 * Falls back to explicit fallback, then to root folder name.
 *
 * @example
 * // shortPath: "components/Canvas/Base/base-button.vue"
 * // → parent folder: "Base"
 * // → root folder: "Canvas"
 */
export declare function resolveCategory(category: string | CategoryDirectoryOptions, shortPath: string): string;
/**
 * Component-level metadata extracted from JSDoc in <script setup>.
 */
export interface ComponentMeta {
    name?: string;
    description?: string;
    category?: string;
    status?: 'experimental' | 'stable' | 'deprecated' | 'obsolete';
}
/**
 * Extract component-level metadata from the first JSDoc comment in <script setup>.
 *
 * The first JSDoc block before any code is treated as component metadata:
 * - First line → custom display name (if short enough)
 * - @description tag → component description
 * - @category tag → category override
 * - @status tag → status override (experimental, stable, deprecated, obsolete)
 *
 * Also checks vue-component-meta's description field (works with export default).
 *
 */
export declare function extractComponentMeta(filePath: string, vcmDescription?: string): ComponentMeta;
interface PropDefinition {
    'type': string;
    'title': string;
    'description'?: string;
    'default'?: string | number | boolean | unknown[];
    'enum'?: (string | number)[];
    'meta:enum'?: Record<string, string>;
    'examples'?: (string | number | boolean | object)[];
    '$ref'?: string;
    'format'?: string;
    'pattern'?: string;
    'contentMediaType'?: string;
    'x-formatting-context'?: 'block' | 'inline';
    /** Allowed URI schemes for Canvas stream wrapper/URL props */
    'x-allowed-schemes'?: string[];
    'items'?: Partial<PropDefinition>;
    'maxItems'?: number;
    'minItems'?: number;
}
interface SlotDefinition {
    title: string;
    description?: string;
}
interface ComponentDefinition {
    id: string;
    name: string;
    category: string;
    status: string;
    props: {
        type: 'object';
        required?: string[];
        properties: Record<string, PropDefinition>;
    };
    slots?: Record<string, SlotDefinition>;
}
export interface ComponentIndexData {
    version: string;
    components: ComponentDefinition[];
}
export declare function generateComponentIndex(components: Component[], tsconfigPath: string, options: ComponentIndexOptions): ComponentIndexData;
export {};
