/**
 * True when the editor has a live ProseMirror view to read from.
 *
 * In TipTap v3 `editor.view` is never falsy: with no view mounted (before mount, after
 * `unmount()`, after `destroy()`) it is a Proxy that throws on property access, so
 * `!editor.view` and `editor?.view?.dom` are not valid guards. `isDestroyed` is true in
 * exactly those cases, so it is the guard to use, and it must be re-checked inside any
 * deferred callback (rAF, timers, observers), since the view can go away in between.
 */
export const hasView = (editor) => !!editor && !editor.isDestroyed;

/** The editor's root DOM element, or null when there is no live view. */
export const viewDom = (editor) => (hasView(editor) ? editor.view.dom : null);

// Results of editor.isActive per editor state. The toolbar and the selection menu ask the same
// questions on every transaction, and each answer walks the whole selection: with a long document
// selected that was about 55 walks per transaction. A state never changes, so its answers can be
// kept, and they go with it.
const activeCache = new WeakMap();

/**
 * editor.isActive(name, attributes), answered once per editor state.
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} name
 * @param {Record<string, unknown>} [attributes]
 * @returns {boolean}
 */
export function isActiveCached(editor, name, attributes) {
    if (!hasView(editor)) return false;
    const { state } = editor;
    let answers = activeCache.get(state);
    if (!answers) {
        answers = new Map();
        activeCache.set(state, answers);
    }
    const key = attributes ? `${name}:${JSON.stringify(attributes)}` : name;
    if (!answers.has(key)) answers.set(key, attributes ? editor.isActive(name, attributes) : editor.isActive(name));
    return answers.get(key);
}
