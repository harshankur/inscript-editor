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
