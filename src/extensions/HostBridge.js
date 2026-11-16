import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { followedHref } from '../utils/url.js';
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
 * The link (`<a href>`) a click landed on within `container`, or null. Realm-safe: an editor in a frame
 * or a popup has elements of its own window's classes, so the target is read by its node type.
 * @param {Event} event
 * @param {Element} container
 * @returns {Element | null}
 */
export function clickedLink(event, container) {
    // A click may land on the link's text (a text node) rather than an element.
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    const anchor = target ? target.closest('a[href]') : null;
    return anchor && container.contains(anchor) ? anchor : null;
}

/**
 * Open a link the reader clicked to another site outside the editor's page, never in its place (a
 * desktop app's page would be replaced): through the host's opener, else a new tab with no way back
 * to this page. Only a web address on another site (resolved as the browser would follow it); one on
 * the page's own site (the host's router, or its own page), an anchor in the page or another scheme
 * is left to the browser.
 * @param {import('@tiptap/core').Editor} editor
 * @param {string | null | undefined} href
 * @param {Document} page - The page the link is on.
 * @param {{ ownSite?: boolean }} [options] - `ownSite`: a web address on the page's own site opens
 *   outside too (a version's link in the history panel, which is no page of the host's to route).
 * @returns {boolean} Whether the click is the editor's (opened outside, or kept from replacing an app's page).
 */
export function openOutside(editor, href, page, { ownSite = false } = {}) {
    const base = page?.baseURI ?? '';
    const address = followedHref(href, base);
    if (!address) return staysInApp(href, base);
    try {
        if (!ownSite && new URL(address).origin === new URL(base).origin) return false;
    } catch { /* no page address to compare: opened outside */ }
    // The click is the editor's whatever the opener does: one that throws must not let the browser
    // follow the link in place of the page.
    try {
        const open = getExternalOpener(editor);
        if (open) open(address);
        else page?.defaultView?.open(address, '_blank', 'noopener,noreferrer');
    } catch (error) {
        console.error('[inscript-editor] Opening a link failed:', error);
    }
    return true;
}

/**
 * Whether a link that is no web address would take an app's own page away: on a page not served over
 * http(s) (a desktop app's `file:` or `app:` page), a link to that page's own scheme (a relative one)
 * would replace the app, so it is followed nowhere (the click is the editor's). So is a link with an
 * empty address (one whose address was refused), which on any page would load the page again. A mail
 * link, an anchor in the page, or a link on a web page is left to the browser.
 */
function staysInApp(href, base) {
    if (typeof href !== 'string') return false;
    if (!href.trim()) return true;
    if (href.trim().startsWith('#')) return false;
    try {
        const pageUrl = new URL(base);
        if (pageUrl.protocol === 'http:' || pageUrl.protocol === 'https:') return false;
        return new URL(href, base).protocol === pageUrl.protocol;
    } catch {
        return false;
    }
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
