import { Extension } from '@tiptap/core';
import { editorI18n } from '../utils/editorT.js';

/**
 * Carries a live ref of host handlers (onAddCitation, onAddYoutube,
 * onShowMediaLibrary, onAddWikilink, onAddAbbreviation) on the editor so both
 * consumers can read the SAME handlers:
 *   - the slash-command items, built once at editor construction, and
 *   - <InscriptEditor>, read at render for the toolbar / bubble menu.
 *
 * This lets a host supply each callback once (via `editorOptions`) instead of
 * duplicating it across `editorOptions` (slash) and `<InscriptEditor>` props.
 * The ref is refreshed by useInscriptEditor during render, so changing a handler's
 * identity never recreates the editor and reads are always current.
 *
 * The ref lives in the extension's own `options` (set synchronously at configure
 * time) rather than in `editor.storage`, because the `onCreate` lifecycle hook runs
 * deferred and would not be set for the synchronous first render.
 */
export const HostBridge = Extension.create({
    name: 'hostBridge',

    addOptions() {
        return { handlersRef: null };
    },

    // The external-link opener <InscriptEditor> was given as its `onOpenExternal` prop, published
    // here (setExternalOpener) so a node view, which has no props, opens links the same way.
    // Likewise its insert-handler props (onShowMediaLibrary, onAddYoutube, ...), which win over the
    // editorOptions ones everywhere: the toolbar, the selection menu and the slash menu.
    addStorage() {
        // i18n: the i18next instance the host's React tree gives this editor, for the text built
        // outside React (node views, the slash menu), which cannot read React context.
        // languageListeners: node views' language-change listeners (onEditorLanguageChanged), moved to
        // a new instance when the editor is given one.
        return { openExternal: null, handlerProps: {}, i18n: null, languageListeners: new Map() };
    },
});

/**
 * Read the live host-handlers object off the editor (or {} when absent).
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @returns {Record<string, (() => void) | undefined>}
 */
export function getHostHandlers(editor) {
    const ext = editor?.extensionManager?.extensions?.find((e) => e.name === 'hostBridge');
    const fromOptions = ext?.options?.handlersRef?.current ?? {};
    const fromProps = editor?.storage?.hostBridge?.handlerProps ?? {};
    const merged = { ...fromOptions };
    for (const [name, value] of Object.entries(fromProps)) {
        if (typeof value === 'function') merged[name] = value;
    }
    return merged;
}

/** The insert handlers a host can give: <InscriptEditor> props and editorOptions alike. */
export const HOST_HANDLER_NAMES = Object.freeze(['onAddCitation', 'onAddYoutube', 'onShowMediaLibrary', 'onAddWikilink', 'onAddAbbreviation']);

/**
 * Publish <InscriptEditor>'s insert-handler props on the editor (an empty object clears them).
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @param {Record<string, unknown>} handlers
 */
export function setHostHandlerProps(editor, handlers) {
    const storage = editor?.storage?.hostBridge;
    if (!storage) return;
    const props = {};
    for (const name of HOST_HANDLER_NAMES) {
        if (typeof handlers?.[name] === 'function') props[name] = handlers[name];
    }
    storage.handlerProps = props;
}

/**
 * Publish <InscriptEditor>'s `onOpenExternal` prop on the editor (null clears it).
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @param {((url: string) => void) | null | undefined} openExternal
 */
export function setExternalOpener(editor, openExternal) {
    const storage = editor?.storage?.hostBridge;
    if (storage) storage.openExternal = typeof openExternal === 'function' ? openExternal : null;
}

/**
 * The host's external-link opener, or null to let the browser open the link: the
 * <InscriptEditor> prop when given, else `editorOptions.onOpenExternal`.
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @returns {((url: string) => void) | null}
 */
export function getExternalOpener(editor) {
    const fromProp = editor?.storage?.hostBridge?.openExternal;
    if (typeof fromProp === 'function') return fromProp;
    const fromOptions = getHostHandlers(editor).onOpenExternal;
    return typeof fromOptions === 'function' ? fromOptions : null;
}

/**
 * Give the editor the i18next instance its host's React tree uses (useInscriptEditor does this), so
 * the text built outside React is in the same language as the rest of the editor.
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @param {object | null | undefined} i18n - An i18next instance, or react-i18next's wrapper of one.
 */
export function setEditorI18n(editor, i18n) {
    const storage = editor?.storage?.hostBridge;
    if (!storage) return;
    const instance = i18n?.__original ?? i18n;
    const next = instance && typeof instance.t === 'function' ? instance : null;
    if (next === storage.i18n) return;
    storage.i18n = next;
    const after = editorI18n(editor);
    // Each listener moves from the instance it is on (it remembers it) to the editor's new one, and
    // runs once if the language differs: what it built is redrawn in the new one's language.
    for (const [listener, on] of storage.languageListeners) {
        if (on === after) continue;
        on?.off?.('languageChanged', listener);
        after?.on?.('languageChanged', listener);
        storage.languageListeners.set(listener, after);
        if (on?.language !== after?.language) listener();
    }
}
