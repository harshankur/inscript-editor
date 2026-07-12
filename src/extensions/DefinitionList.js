import { Node, mergeAttributes } from '@tiptap/core';

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
            toggleDefinitionList: () => ({ state, dispatch, commands }) => {
                const { schema, selection } = state;
                const { $from, $to } = selection;

                const dlType = schema.nodes.definitionList;
                const dtType = schema.nodes.definitionTerm;
                const ddType = schema.nodes.definitionDescription;
                const pType = schema.nodes.paragraph;

                if (!dlType || !dtType || !ddType) return false;

                // Resolve position inside content if selection is at root level (depth 0)
                const $resolved = $from.depth > 0 ? $from : state.doc.resolve(Math.min($from.pos + 1, state.doc.content.size));
                const depth = $resolved.depth;

                // Check if already inside a definitionList
                let insideDL = false;
                for (let i = depth; i > 0; i--) {
                    if ($resolved.node(i).type === dlType) {
                        insideDL = true;
                        break;
                    }
                }

                if (insideDL) {
                    // Lift the term and description content out to paragraphs
                    return commands.lift('definitionTerm');
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
