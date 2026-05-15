import * as _nuxt_schema from '@nuxt/schema';

interface CategoryDirectoryOptions {
    directory: true;
    fallback?: string;
}
interface ModuleOptions {
    componentIndex?: {
        enabled?: boolean;
        category?: string | CategoryDirectoryOptions;
        status?: 'experimental' | 'stable' | 'deprecated' | 'obsolete';
        includePackages?: boolean | string[];
        include?: {
            directories?: string[];
        };
        exclude?: {
            components?: string[];
            directories?: string[];
        };
        overrides?: Record<string, {
            name?: string;
            description?: string;
            category?: string;
            status?: 'experimental' | 'stable' | 'deprecated' | 'obsolete';
        }>;
    };
    /**
     * Path prefixes for the component-preview `$fetch` override. Matching
     * client-side `$fetch` requests are rerouted from the embedder's
     * origin to `app.cdnURL` (the Nuxt origin). Active only when
     * component preview is active. Matched with `startsWith`. Defaults
     * to `['/nuxt-component-preview/', '/api/_nuxt_icon/', '/_i18n/']`;
     * set to `[]` to disable.
     */
    cdnFetchPaths?: string[];
}
declare const _default: _nuxt_schema.NuxtModule<ModuleOptions, ModuleOptions, false>;

export { _default as default };
export type { CategoryDirectoryOptions, ModuleOptions };
