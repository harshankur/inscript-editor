import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

export const DefinitionList = Node.create({
    name: 'definitionList',
    group: 'block',
    content: '(definitionTerm definitionDescription+)+',

    parseHTML() {
        return [{ tag: 'dl' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['dl', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            toggleDefinitionList: () => ({ state, dispatch }) => {
                const { schema, selection } = state;
                const { $from } = selection;

                const dlType = schema.nodes.definitionList;
                const dtType = schema.nodes.definitionTerm;
                const ddType = schema.nodes.definitionDescription;
                const pType = schema.nodes.paragraph;

                if (!dlType || !dtType || !ddType || !pType) return false;

                // Resolve position inside content if selection is at root level (depth 0)
                const $resolved = $from.depth > 0 ? $from : state.doc.resolve(Math.min($from.pos + 1, state.doc.content.size));
                const depth = $resolved.depth;

                // Find an enclosing definitionList (and its depth), if any.
                let dlDepth = null;
                for (let i = depth; i > 0; i--) {
                    if ($resolved.node(i).type === dlType) {
                        dlDepth = i;
                        break;
                    }
                }

                if (dlDepth != null) {
                    // Unwrap: replace the whole list with plain blocks (the term becomes a paragraph, each
                    // description's blocks are kept as-is). The old `commands.lift('definitionTerm')` lifted
                    // INLINE term content straight into the doc, which left the selection pointing at a
                    // non-inline node and corrupted the document (a hard crash in a real webview).
                    if (!dispatch) return true;
                    const dlNode = $resolved.node(dlDepth);
                    const dlStart = $resolved.before(dlDepth);
                    const blocks = [];
                    dlNode.forEach((child) => {
                        if (child.type === dtType) {
                            blocks.push(pType.create(null, child.content));
                        } else if (child.type === ddType) {
                            child.forEach((block) => blocks.push(block));
                        }
                    });
                    if (blocks.length === 0) blocks.push(pType.create());
                    const tr = state.tr.replaceWith(dlStart, dlStart + dlNode.nodeSize, blocks);
                    const caret = Math.min(dlStart + 1, tr.doc.content.size);
                    tr.setSelection(TextSelection.create(tr.doc, caret));
                    dispatch(tr.scrollIntoView());
                    return true;
                }

                // Wrap current block in a definitionList
                if (dispatch) {
                    const blockPos = $resolved.before(Math.max(1, depth));
                    const blockNode = state.doc.nodeAt(blockPos);
                    if (!blockNode) return false;

                    // Create definition list nodes
                    const termNode = dtType.create(null, blockNode.isTextblock ? blockNode.content : null);
                    const descNode = ddType.create(null, pType.create());
                    const dlNode = dlType.create(null, [termNode, descNode]);

                    const tr = state.tr.replaceWith(blockPos, blockPos + blockNode.nodeSize, dlNode);
                    // Put the cursor inside the term's INLINE content (dl open +1, dt open +1 => +2), so
                    // an immediate re-toggle (or edit) has a valid text selection rather than one left at
                    // the definitionList boundary (which ProseMirror rejects as a non-inline endpoint).
                    const caret = Math.min(blockPos + 2, tr.doc.content.size);
                    tr.setSelection(TextSelection.create(tr.doc, caret));
                    dispatch(tr);
                }
                return true;
            },
        };
    },
});

export const DefinitionTerm = Node.create({
    name: 'definitionTerm',
    content: 'inline*',
    defining: true,

    parseHTML() {
        return [{ tag: 'dt' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['dt', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },
});

export const DefinitionDescription = Node.create({
    name: 'definitionDescription',
    content: 'block+',
    defining: true,

    parseHTML() {
        return [{ tag: 'dd' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['dd', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },
});
