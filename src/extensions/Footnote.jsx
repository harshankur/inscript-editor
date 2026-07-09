import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';

const FootnoteReferenceComponent = ({ node, editor, getPos }) => {
    // Calculate index dynamically based on document order
    let index = 1;
    if (editor && editor.state) {
        editor.state.doc.descendants((n, pos) => {
            if (n.type.name === 'footnoteReference' && pos < getPos()) {
                index++;
            }
        });
    }

    const handleClick = () => {
        // Find corresponding definition and scroll to it
        const id = node.attrs.id;
        editor.state.doc.descendants((n, pos) => {
            if (n.type.name === 'footnoteDefinition' && n.attrs.id === id) {
                editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
            }
        });
    };

    return (
        <NodeViewWrapper 
            as="sup" 
            data-footnote-ref={node.attrs.id} 
            className="cursor-pointer text-emerald-600 dark:text-emerald-400 font-semibold px-0.5"
            onClick={handleClick}
        >
            [{index}]
        </NodeViewWrapper>
    );
};

export const FootnoteReference = Node.create({
    name: 'footnoteReference',
    group: 'inline',
    inline: true,
    selectable: true,
    atom: true,

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: element => element.getAttribute('data-footnote-ref'),
                renderHTML: attributes => {
                    return { 'data-footnote-ref': attributes.id };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'sup[data-footnote-ref]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['sup', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), '']; // Empty text, handled by node view if editable
    },

    addNodeView() {
        return ReactNodeViewRenderer(FootnoteReferenceComponent);
    },
});

const FootnoteDefinitionComponent = ({ node, editor, getPos }) => {
    let index = 1;
    // The definition's index should match the reference's index.
    // We find the reference with the same id to get its index.
    if (editor && editor.state) {
        const id = node.attrs.id;
        let refPos = null;
        editor.state.doc.descendants((n, pos) => {
            if (n.type.name === 'footnoteReference' && n.attrs.id === id) {
                refPos = pos;
            }
        });

        if (refPos !== null) {
            editor.state.doc.descendants((n, pos) => {
                if (n.type.name === 'footnoteReference' && pos < refPos) {
                    index++;
                }
            });
        }
    }

    return (
        <NodeViewWrapper className="flex gap-2 items-start text-sm text-zinc-600 dark:text-zinc-400 my-1" data-footnote-id={node.attrs.id}>
            <div className="font-semibold select-none pt-0.5">[{index}]</div>
            <NodeViewContent className="flex-1" />
        </NodeViewWrapper>
    );
};

export const FootnoteDefinition = Node.create({
    name: 'footnoteDefinition',
    group: 'block',
    content: 'block+',
    defining: true,

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: element => element.getAttribute('data-footnote-id'),
                renderHTML: attributes => {
                    return { 'data-footnote-id': attributes.id };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-footnote-id]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(FootnoteDefinitionComponent);
    },
});

export const FootnotesSection = Node.create({
    name: 'footnotesSection',
    group: 'block',
    content: 'footnoteDefinition*',
    
    parseHTML() {
        return [{ tag: 'section[data-footnotes]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['section', mergeAttributes({ 'data-footnotes': 'true' }, this.options.HTMLAttributes), 0];
    },

    addCommands() {
        return {
            insertFootnote: () => ({ tr, state, dispatch, editor }) => {
                const id = `fn-${Math.random().toString(36).substr(2, 9)}`;
                
                if (dispatch) {
                    const { selection } = state;
                    const position = selection.$to.pos;

                    // 1. Insert the reference
                    tr.insert(position, this.editor.schema.nodes.footnoteReference.create({ id }));
                    
                    // 2. Find or create the section
                    let sectionPos = null;
                    state.doc.descendants((n, pos) => {
                        if (n.type.name === 'footnotesSection') sectionPos = pos;
                    });

                    let defNode = this.editor.schema.nodes.footnoteDefinition.create(
                        { id },
                        this.editor.schema.nodes.paragraph.create()
                    );

                    if (sectionPos !== null) {
                        // Append to existing section
                        const sectionNode = state.doc.nodeAt(sectionPos);
                        tr.insert(sectionPos + sectionNode.nodeSize - 1, defNode);
                        
                        // Focus the new definition's paragraph
                        const newDefPos = sectionPos + sectionNode.nodeSize - 1;
                        tr.setSelection(state.selection.constructor.near(tr.doc.resolve(newDefPos + 2)));
                    } else {
                        // Create section at the very end of the doc
                        const section = this.editor.schema.nodes.footnotesSection.create({}, defNode);
                        const docEnd = state.doc.content.size;
                        tr.insert(docEnd, section);
                        
                        // Focus
                        tr.setSelection(state.selection.constructor.near(tr.doc.resolve(docEnd + 3)));
                    }
                }
                return true;
            },
        };
    },
});
