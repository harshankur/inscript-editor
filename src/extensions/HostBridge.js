import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { editorI18n } from '../utils/editorT.js';

/**
 * The editor event for a change of editability, however it was made: TipTap's setEditable emits
 * `update` only when asked to, but the view is always told, and so this.
 */
export const EDITABLE_EVENT = 'inscript:editable';

/** The plugin that emits EDITABLE_EVENT: an editor with it says when its editability changes. */
export const editableWatchKey = new PluginKey('inscriptEditableWatch');

/**
 * Run `listener` whenever the editor's editability changes: on EDITABLE_EVENT (the host bridge), or
 * on an update (setEditable's default) for an editor without it, the change checked (an update comes
 * with every edit too). Usable before the editor has a view.
 * @param {import('@tiptap/core').Editor} editor
 * @param {(editable: boolean) => void} listener
 * @returns {() => void} Stops it.
 */
export function followEditable(editor, listener) {
    let editable = editor.isEditable;
    const check = () => {
        if (editable === editor.isEditable) return;
        editable = editor.isEditable;
        listener(editable);
    };
    editor.on(EDITABLE_EVENT, check);
    editor.on('update', check);
    return () => {
        editor.off(EDITABLE_EVENT, check);
        editor.off('update', check);
    };
}

/**
 * Carries a live ref of host handlers (onAddCitation, onAddYoutube,
 * onShowMediaLibrary, onImageFile, onAddWikilink, onAddAbbreviation) on the editor so both
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

    addProseMirrorPlugins() {
        const { editor } = this;
        let editable = editor.isEditable;
        return [
            new Plugin({
                key: editableWatchKey,
                view: () => ({
                    update: () => {
                        if (editable === editor.isEditable) return;
                        editable = editor.isEditable;
                        editor.emit(EDITABLE_EVENT, { editor, editable });
                    },
                }),
            }),
        ];
    },

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
 * @returns {Record<string, ((...args: any[]) => unknown) | undefined>}
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
export const HOST_HANDLER_NAMES = Object.freeze(['onAddCitation', 'onAddYoutube', 'onShowMediaLibrary', 'onImageFile', 'onAddWikilink', 'onAddAbbreviation']);

/**
 * The host handlers among build options (the insert handlers and `onOpenExternal`), for an editor
 * built without useInscriptEditor's live ref.
 * @param {Record<string, unknown>} options
 * @returns {Record<string, (...args: any[]) => unknown>}
 */
export function hostHandlersOf(options) {
    return functionsAmong(options, [...HOST_HANDLER_NAMES, 'onOpenExternal']);
}

/** The named values of `source` that are functions. */
function functionsAmong(source, names) {
    const found = {};
    for (const name of names) {
        if (typeof source?.[name] === 'function') found[name] = source[name];
    }
    return found;
}

/**
 * Publish <InscriptEditor>'s insert-handler props on the editor (an empty object clears them).
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @param {Record<string, unknown>} handlers
 */
export function setHostHandlerProps(editor, handlers) {
    const storage = editor?.storage?.hostBridge;
    if (!storage) return;
    storage.handlerProps = functionsAmong(handlers, HOST_HANDLER_NAMES);
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
