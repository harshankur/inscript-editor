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

// Answers about an editor state, kept with it. The toolbar and the selection menu ask the same
// questions on every transaction, and each answer walks the whole selection: with a long document
// selected that was about 55 walks per transaction. A state never changes, so its answers can be
// kept, and they go with it.
const stateCache = new WeakMap();

/**
 * `compute()`, run once per editor state and key, the answer kept with the state.
 * @template T
 * @param {import('@tiptap/pm/state').EditorState} state
 * @param {string} key
 * @param {() => T} compute
 * @returns {T}
 */
export function cachedPerState(state, key, compute) {
    let answers = stateCache.get(state);
    if (!answers) {
        answers = new Map();
        stateCache.set(state, answers);
    }
    if (!answers.has(key)) answers.set(key, compute());
    return answers.get(key);
}

/**
 * editor.isActive(name, attributes), answered once per editor state.
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} name
 * @param {Record<string, unknown>} [attributes]
 * @returns {boolean}
 */
export function isActiveCached(editor, name, attributes) {
    if (!hasView(editor)) return false;
    // `name` may be the attributes object itself (editor.isActive({ textAlign: 'center' })).
    const nameKey = typeof name === 'string' ? name : JSON.stringify(name);
    const key = attributes ? `isActive:${nameKey}:${JSON.stringify(attributes)}` : `isActive:${nameKey}`;
    return cachedPerState(editor.state, key, () => (attributes ? editor.isActive(name, attributes) : editor.isActive(name)));
}
