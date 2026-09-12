import en from './en.json';

export const INSCRIPT_EDITOR_NAMESPACE = 'inscript-editor';

/**
 * Lang code -> full bundle of every string inscript-editor ships. Only English is
 * bundled: it is the single source of truth (and the built-in `defaultValue` on every
 * t() call), so adding a string never requires translating it into other languages.
 * Ship additional languages from your own app via the `overrides` option below.
 */
export const inscriptEditorTranslations = {
    en,
};

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) {
        return override !== undefined ? override : base;
    }
    const result = { ...base };
    for (const key of Object.keys(override)) {
        result[key] = deepMerge(base[key], override[key]);
    }
    return result;
}

/**
 * Register inscript-editor's bundled translations on a consumer-owned i18next instance.
 *
 * @param {object} i18n - an i18next instance (the default export of the `i18next` package, or a custom instance).
 * @param {object} [options]
 * @param {string[]} [options.languages] - whitelist of bundled language codes to register (drops the rest).
 * @param {Record<string, object>} [options.overrides] - lang -> partial-or-full bundle, deep-merged over the
 *   library defaults last. Can also introduce languages the library doesn't ship at all.
 * @param {boolean} [options.overwrite=false] - when true, `overrides`/library strings replace resources the
 *   consumer already registered for that language+namespace. Defaults to false so anything the consumer
 *   registered first wins.
 */
export function registerInscriptEditorTranslations(i18n, { languages, overrides = {}, overwrite = false } = {}) {
    if (!i18n || typeof i18n.addResourceBundle !== 'function') {
        throw new Error('registerInscriptEditorTranslations: `i18n` must be an i18next instance.');
    }

    const shippedLangs = languages && languages.length
        ? languages.filter((lang) => inscriptEditorTranslations[lang])
        : Object.keys(inscriptEditorTranslations);

    shippedLangs.forEach((lang) => {
        const bundle = overrides[lang]
            ? deepMerge(inscriptEditorTranslations[lang], overrides[lang])
            : inscriptEditorTranslations[lang];
        i18n.addResourceBundle(lang, INSCRIPT_EDITOR_NAMESPACE, bundle, true, overwrite);
    });

    // Overrides can also register languages the library doesn't ship at all.
    Object.keys(overrides).forEach((lang) => {
        if (shippedLangs.includes(lang)) return;
        i18n.addResourceBundle(lang, INSCRIPT_EDITOR_NAMESPACE, overrides[lang], true, overwrite);
    });
}
