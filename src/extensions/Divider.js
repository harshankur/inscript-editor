import { Extension } from '@tiptap/core';

/**
 * `insertDivider`: a horizontal rule at the cursor, as the toolbar and the slash menu insert it.
 * Inside a definition list (which holds only terms and descriptions) the rule goes after the
 * whole list, with the cursor in the paragraph after it: TipTap's own command split the list
 * there and left the cursor between blocks.
 */
export const Divider = Extension.create({
    name: 'divider',

    addCommands() {
        return {
            insertDivider: () => ({ state, chain }) => {
                const { $from } = state.selection;
                for (let depth = $from.depth; depth > 0; depth--) {
                    if ($from.node(depth).type.name !== 'definitionList') continue;
                    const after = $from.after(depth);
                    const next = state.doc.nodeAt(after);
                    const content = next?.isTextblock ? [{ type: 'horizontalRule' }] : [{ type: 'horizontalRule' }, { type: 'paragraph' }];
                    // The rule takes one position; the cursor goes inside the paragraph after it.
                    return chain().insertContentAt(after, content).setTextSelection(after + 2).run();
                }
                return chain().setHorizontalRule().run();
            },
        };
    },
});
