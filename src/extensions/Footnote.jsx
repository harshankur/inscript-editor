import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { touchesNodes } from '../utils/transactions.js';
import { lowerBound } from '../utils/lowerBound.js';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';

/**
 * The footnote references of a document, found once per document (not once per reference, which
 * was quadratic in the footnotes, and worse): their positions in order, and each id's number (that
 * of the last reference with it).
 */
const footnoteNumbers = new WeakMap();
function footnotesOf(doc) {
    let found = footnoteNumbers.get(doc);
    if (!found) {
        const positions = [];
        const numberById = new Map();
        // Every footnote node, references and definitions, in order (for their decorations).
        const nodes = [];
        doc.descendants((n, pos) => {
            if (n.type.name === 'footnoteDefinition') nodes.push({ node: n, pos });
            if (n.type.name !== 'footnoteReference') return true;
            positions.push(pos);
            nodes.push({ node: n, pos });
            numberById.set(n.attrs.id, positions.length);
            return false;
        });
        found = { positions, numberById, nodes };
        footnoteNumbers.set(doc, found);
    }
    return found;
}

/** The number of the reference at `pos`: one more than the references before it. */
function referenceNumber(doc, pos) {
    return lowerBound(footnotesOf(doc).positions, pos) + 1;
}

const REFERENCE = 'footnoteReference';
const DEFINITION = 'footnoteDefinition';
const isFootnote = node => node.type.name === REFERENCE || node.type.name === DEFINITION;
const footnoteNumbersKey = new PluginKey('inscriptFootnoteNumbers');

/**
 * Each footnote reference and definition carries its number as a node decoration. ProseMirror keeps a
 * node view whose node and decorations are unchanged, so without this a reference added before others
 * left theirs showing their old numbers: a changed number is a changed decoration, and redraws them.
 * Worked out again only when a change touches a footnote (see touchesNodes).
 */
function footnoteDecorations(doc) {
    const { numberById, nodes } = footnotesOf(doc);
    let references = 0;
    const found = nodes.map(({ node, pos }) => {
        const number = node.type.name === REFERENCE ? (references += 1) : (numberById.get(node.attrs.id) ?? 0);
        return Decoration.node(pos, pos + node.nodeSize, {}, { footnoteNumber: number });
    });
    return DecorationSet.create(doc, found);
}

/** The number a footnote's decorations carry (see footnoteDecorations), or null. */
const numberOf = decorations => decorations?.find?.(decoration => decoration.spec?.footnoteNumber !== undefined)?.spec.footnoteNumber ?? null;

/**
 * A footnote's node view, redrawn when its node or its number changes: TipTap redraws a React node
 * view only when its node changes, and a footnote whose number moved keeps its node.
 */
const footnoteNodeView = Component => ReactNodeViewRenderer(Component, {
    update: ({ oldNode, newNode, oldDecorations, newDecorations, updateProps }) => {
        if (oldNode.type !== newNode.type) return false;
        if (oldNode !== newNode || numberOf(oldDecorations) !== numberOf(newDecorations)) updateProps();
        return true;
    },
});

function footnoteNumbersPlugin() {
    return new Plugin({
        key: footnoteNumbersKey,
        state: {
            init: (_config, { doc }) => footnoteDecorations(doc),
            apply: (tr, set) => {
                if (!tr.docChanged) return set;
                // Only a footnote put in, taken out or changed whole moves a number (not text typed in one).
                return touchesNodes(tr, isFootnote, { inline: true, whole: true }) ? footnoteDecorations(tr.doc) : set.map(tr.mapping, tr.doc);
            },
        },
        props: { decorations: state => footnoteNumbersKey.getState(state) },
    });
}

const FootnoteReferenceComponent = ({ node, editor, getPos, decorations }) => {
    // Its number by document order, as its decoration carries it (see footnoteDecorations).
    const pos = typeof getPos === 'function' ? getPos() : null;
    const index = numberOf(decorations) ?? (editor?.state && typeof pos === 'number' ? referenceNumber(editor.state.doc, pos) : 1);

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
            className="cursor-pointer text-[var(--inscript-color-link)] font-semibold px-0.5"
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
        return footnoteNodeView(FootnoteReferenceComponent);
    },

    // Numbers kept current on every reference and definition (see footnoteNumbersPlugin).
    addProseMirrorPlugins() {
        return [footnoteNumbersPlugin()];
    },
});

const FootnoteDefinitionComponent = ({ node, editor, decorations }) => {
    // The definition's number is its reference's (the last one with its id), as its decoration carries it.
    const index = numberOf(decorations) || (editor?.state && footnotesOf(editor.state.doc).numberById.get(node.attrs.id)) || 1;

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
        return footnoteNodeView(FootnoteDefinitionComponent);
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
                // A reference cannot sit in code (a code block holds plain text only).
                if (state.selection.$from.parent.type.spec.code) return false;
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
