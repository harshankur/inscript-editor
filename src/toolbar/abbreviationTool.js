import { isActiveCached } from '../utils/editorView.js';

/**
 * The Abbreviation button, shared by the toolbar and the selection menu: its action, whether it is
 * lit, and whether it is a toggle. An abbreviation needs its expansion (the <abbr title>): a host
 * can own that input through `onAddAbbreviation`; otherwise a native prompt asks for it, and the
 * button removes an abbreviation around the cursor. With the host's handler, pressing it opens the
 * host's editor rather than removing the mark, so it is no toggle then.
 * @param {import('@tiptap/core').Editor} editor
 * @param {(key: string, fallback: string) => string} t
 * @param {(() => void) | undefined} onAddAbbreviation
 */
export function abbreviationTool(editor, t, onAddAbbreviation) {
    const active = isActiveCached(editor, 'abbreviation');
    return {
        active,
        toggle: !onAddAbbreviation,
        action: () => {
            if (onAddAbbreviation) return onAddAbbreviation();
            if (isActiveCached(editor, 'abbreviation')) { editor.chain().focus().unsetAbbreviation().run(); return; }
            const title = window.prompt(t('abbreviationPrompt', 'Enter the full form (e.g. HyperText Markup Language):'));
            if (title) editor.chain().focus().setAbbreviation(title).run();
        },
    };
}
