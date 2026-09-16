import { Extension } from '@tiptap/core';

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
});

/**
 * Read the live host-handlers object off the editor (or {} when absent).
 * @param {import('@tiptap/core').Editor | null | undefined} editor
 * @returns {Record<string, (() => void) | undefined>}
 */
export function getHostHandlers(editor) {
    const ext = editor?.extensionManager?.extensions?.find((e) => e.name === 'hostBridge');
    return ext?.options?.handlersRef?.current ?? {};
}
