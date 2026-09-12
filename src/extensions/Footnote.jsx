import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
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
            className="cursor-pointer text-[var(--inscript-color-accent)] font-semibold px-0.5"
            onClick={handleClick}
        >
            [{index}]
        </NodeViewWrapper>
    );
};

export const FootnoteReference = Node.create({
    name: 'footnoteReference',
    priority: 100,
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
        return [
            {
                tag: 'sup',
                priority: 500,
                getAttrs: node => node.hasAttribute('data-footnote-ref') ? null : false,
            },
            {
                tag: 'footnote-reference', // backup custom element
            }
        ];
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
        <NodeViewWrapper className="flex gap-2 items-start text-sm text-[var(--inscript-color-muted)] my-1" data-footnote-id={node.attrs.id}>
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
            insertFootnote: () => ({ tr, state, dispatch }) => {
                const { schema } = state;
                const refType = schema.nodes.footnoteReference;
                const defType = schema.nodes.footnoteDefinition;
                const secType = schema.nodes.footnotesSection;
                const pType = schema.nodes.paragraph;
                if (!refType || !defType || !secType || !pType) return false;
                if (!dispatch) return true;

                const id = `fn-${Math.random().toString(36).slice(2, 11)}`;

                // 1. Insert the inline reference at the cursor. Every step after this
                //    must account for the shift it introduces — so read section/end
                //    positions from the ORIGINAL doc and map them through `tr`, rather
                //    than using stale positions against the already-modified doc (that
                //    off-by-one is what nested the 2nd definition inside the 1st and
                //    left a stray paragraph on the 1st).
                tr.insert(state.selection.$to.pos, refType.create({ id }));

                const defNode = defType.create({ id }, pType.create());

                let sectionPos = null, sectionNode = null;
                state.doc.descendants((n, pos) => {
                    if (n.type.name === 'footnotesSection') { sectionPos = pos; sectionNode = n; return false; }
                    return true;
                });

                let caretBase;
                if (sectionPos !== null) {
                    // Append the definition just before the section's closing token.
                    const insertAt = tr.mapping.map(sectionPos + sectionNode.nodeSize - 1);
                    tr.insert(insertAt, defNode);
                    caretBase = insertAt;                 // -> footnoteDefinition open
                } else {
                    // No section yet: create one at the very end of the updated doc.
                    const insertAt = tr.doc.content.size;
                    tr.insert(insertAt, secType.create(null, defNode));
                    caretBase = insertAt + 1;             // step into the section
                }

                // Caret into the new definition's paragraph (+1 into the definition,
                // +1 into the paragraph). `near` snaps to the nearest valid inline spot.
                const caret = Math.min(caretBase + 2, tr.doc.content.size);
                tr.setSelection(TextSelection.near(tr.doc.resolve(caret)));
                tr.scrollIntoView();
                return true;
            },
        };
    },
});
