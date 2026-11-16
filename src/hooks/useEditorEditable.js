import { useEffect, useState } from 'react';
import { followEditable } from '../extensions/HostBridge.js';

/**
 * Whether the editor can be edited, following it as it changes. A change of editability (setEditable)
 * comes without a transaction (and without an update when so asked), so a component re-rendered only
 * on transactions (useEditorTransaction) would keep what it read before (see followEditable).
 * @param {import('@tiptap/core').Editor|null} editor
 * @returns {boolean}
 */
export function useEditorEditable(editor) {
    const [editable, setEditable] = useState(() => editor?.isEditable !== false);
    useEffect(() => {
        if (!editor) return undefined;
        setEditable(editor.isEditable);
        return followEditable(editor, setEditable);
    }, [editor]);
    return editable;
}
