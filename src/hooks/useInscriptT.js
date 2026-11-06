import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fillPlaceholders } from '../utils/fillPlaceholders.js';
import { translatedOr, unescapedValues } from '../utils/editorT.js';

/**
 * The editor's `t`, in its own `inscript-editor` namespace: react-i18next's, with two differences
 * for a string with values (`t(key, defaultValue, { size })` or `t(key, { size, defaultValue })`).
 * Its `{{placeholders}}` are filled even when the host has no i18next instance (react-i18next then
 * returns the English default untouched), and the values are not HTML-escaped: the result is text
 * that React renders or puts in an attribute, which escapes it already, so a translated name with
 * an apostrophe would otherwise be read out as `&#39;`.
 * @returns {{ t: (key: string, defaultValue?: string | object, options?: object) => string, i18n: import('i18next').i18n }}
 */
export function useInscriptT() {
    const { t, i18n } = useTranslation('inscript-editor');
    // Only when there is no initialized i18next to fill them (react-i18next then has no instance and
    // hands back the default as is, or one that is not initialized yet). A loading namespace still goes through i18next, which fills them, so a
    // value that itself holds {{…}} is never filled a second time. A flag, not the `i18n` object,
    // which react-i18next makes anew on every render when there is no instance.
    // The instance itself: react-i18next's wrapper copies it, and its isInitialized can be stale.
    const instance = i18n?.__original ?? i18n;
    const noI18next = typeof instance?.t !== 'function' || !instance.isInitialized;
    const translate = useCallback((key, defaultValue, options) => {
        const values = defaultValue !== null && typeof defaultValue === 'object' ? defaultValue : options;
        const fallback = typeof defaultValue === 'string' ? defaultValue : values?.defaultValue ?? key;
        if (!values) return translatedOr(() => t(key, defaultValue), fallback);
        const unescaped = unescapedValues(values);
        // Filled once: here when there is no i18next to do it, or by translatedOr's fallback.
        return translatedOr(() => {
            const text = values === defaultValue ? t(key, unescaped) : t(key, defaultValue, unescaped);
            return typeof text === 'string' && noI18next ? fillPlaceholders(text, values) : text;
        }, fallback, values);
    }, [t, noI18next]);
    return { t: translate, i18n };
}
