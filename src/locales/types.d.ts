export type InscriptEditorLocaleBundle = Record<string, string>;

export const INSCRIPT_EDITOR_NAMESPACE: 'inscript-editor';

/** Lang code -> full bundle of every string inscript-editor ships. Only English (`en`)
 *  is bundled; add other languages from your own app via the `overrides` option. */
export const inscriptEditorTranslations: Record<string, InscriptEditorLocaleBundle>;

export interface RegisterInscriptEditorTranslationsOptions {
    /** Whitelist of bundled language codes to register (drops the rest). Defaults to all shipped languages. */
    languages?: string[];
    /** lang -> partial-or-full bundle, deep-merged over the library defaults last. Can introduce languages the library doesn't ship. */
    overrides?: Record<string, Partial<InscriptEditorLocaleBundle>>;
    /** When true, overrides/library strings replace resources the consumer already registered. Defaults to false. */
    overwrite?: boolean;
}

/**
 * Registers inscript-editor's bundled translations on a consumer-owned i18next instance.
 * See the README's i18n section for usage examples.
 */
export function registerInscriptEditorTranslations(
    i18n: { addResourceBundle: (lng: string, ns: string, resources: object, deep?: boolean, overwrite?: boolean) => void },
    options?: RegisterInscriptEditorTranslationsOptions
): void;
