import { getI18n } from 'react-i18next';
import { fillPlaceholders } from './fillPlaceholders.js';

/**
 * A translation, or its English default: `translate()` gives i18next's text, which is used when it
 * is a string; otherwise (i18next not initialized: undefined, or a throw) the default, its values
 * filled in. Shared by the components' `t` (useInscriptT) and editorT.
 * @param {() => unknown} translate
 * @param {string} defaultValue
 * @param {Record<string, unknown>} [values]
 * @returns {string}
 */
export function translatedOr(translate, defaultValue, values = {}) {
    try {
        const text = translate();
        if (typeof text === 'string') return text;
    } catch { /* not usable yet: the default below */ }
    return fillPlaceholders(defaultValue, values);
}

/** Options for a translation with values: no HTML escaping (React and the DOM escape text). */
export const unescapedValues = values => ({ ...values, interpolation: { ...values?.interpolation, escapeValue: false } });

/**
 * The i18next instance for an editor's text built outside React: the one its host's React tree gave
 * it (setEditorI18n, from useInscriptEditor), else react-i18next's, resolved as the components'
 * useTranslation resolves it; null when there is none (then, like the components, the English
 * defaults), so one editor never shows two languages.
 * @param {import('@tiptap/core').Editor | null | undefined} [editor]
 * @returns {object|null}
 */
export function editorI18n(editor) {
    return editor?.storage?.hostBridge?.i18n ?? getI18n() ?? null;
}

/**
 * The editor's translation for text built outside React (node views, the slash menu's items).
 * @param {string} key
 * @param {string} defaultValue
 * @param {Record<string, unknown>} [values]
 * @param {import('@tiptap/core').Editor | null} [editor] - Whose instance to use (see editorI18n).
 * @returns {string}
 */
export function editorT(key, defaultValue, values = {}, editor = null) {
    const i18n = editorI18n(editor);
    if (!i18n?.isInitialized || typeof i18n.t !== 'function') return fillPlaceholders(defaultValue, values);
    return translatedOr(() => i18n.t(key, { ...unescapedValues(values), ns: 'inscript-editor', defaultValue }), defaultValue, values);
}

/**
 * Call `listener` whenever the language of the editor's i18next instance changes, also after the
 * editor is given another instance (setEditorI18n moves the subscription). Returns the unsubscribe.
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @param {() => void} listener
 * @returns {() => void}
 */
export function onEditorLanguageChanged(editor, listener) {
    // Each listener remembers the instance it is on: unsubscribing (and moving it) uses that one,
    // whatever the editor would resolve to by then.
    const listeners = editor?.storage?.hostBridge?.languageListeners;
    let instance = editorI18n(editor);
    instance?.on?.('languageChanged', listener);
    listeners?.set(listener, instance);
    return () => {
        instance = listeners?.has(listener) ? listeners.get(listener) : instance;
        instance?.off?.('languageChanged', listener);
        listeners?.delete(listener);
    };
}
