import { useEditorState } from '@tiptap/react';

/**
 * Re-renders the calling component on every editor transaction, and returns the transaction
 * count (handy as a memo dependency).
 *
 * TipTap 3's useEditor does not re-render React on transactions, so a component that reads the
 * editor while rendering (`editor.isActive('bold')`, an active colour, the table under the
 * cursor) shows whatever was true the last time something else re-rendered it. The toolbar's
 * buttons never lit up, and never followed the cursor, for exactly that reason. A component that
 * needs only one derived value should select it with useEditorState instead.
 *
 * @param {import('@tiptap/core').Editor|null} editor
 * @returns {number}
 */
export function useEditorTransaction(editor) {
    return useEditorState({ editor, selector: ({ transactionNumber }) => transactionNumber }) ?? 0;
}
