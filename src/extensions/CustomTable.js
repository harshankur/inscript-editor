import { mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Table } from '@tiptap/extension-table';
import { TABLE_ALIGN, DEFAULT_TABLE_ALIGN, TABLE_ALIGN_ATTRIBUTE } from '../constants.js';

const tableAlignKey = new PluginKey('tableAlign');
const TABLE_NODE = 'table';
const MARGIN_FLUSH = '0';
const MARGIN_AUTO = 'auto';

const TABLE_ALIGN_VALUES = Object.values(TABLE_ALIGN);
/** A known placement, or the default for anything else (an absent or unknown attribute value). */
export const resolveTableAlign = value => (TABLE_ALIGN_VALUES.includes(value) ? value : DEFAULT_TABLE_ALIGN);

/** The side margins that put a table at `align`: flush on the side it sits against, auto elsewhere. */
export function tableAlignMargins(align) {
    const resolved = resolveTableAlign(align);
    return {
        left: resolved === TABLE_ALIGN.LEFT ? MARGIN_FLUSH : MARGIN_AUTO,
        right: resolved === TABLE_ALIGN.RIGHT ? MARGIN_FLUSH : MARGIN_AUTO,
    };
}

/**
 * TipTap's table spec without the width/min-width style TipTap generates when it is given no
 * style. Our placement margins used to stand in that style's place on every table; with the
 * default placement no longer written, an unplaced table must not gain TipTap's style instead.
 * A style the caller supplied is left alone.
 */
function withoutGeneratedStyle(spec, HTMLAttributes) {
    if (!Array.isArray(spec) || HTMLAttributes?.style) return spec;
    const table = spec[0] === TABLE_NODE ? spec : spec.find(part => Array.isArray(part) && part[0] === TABLE_NODE);
    const attributes = table?.[1];
    if (attributes && typeof attributes === 'object' && !Array.isArray(attributes)) delete attributes.style;
    return spec;
}

/** The <table> a table node rendered: the node's own DOM, or the table inside TipTap's wrapper. */
const tableElementOf = dom => (dom.nodeName === 'TABLE' ? dom : Array.from(dom.children || []).find(child => child.nodeName === 'TABLE'));

export const CustomTable = Table.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            align: {
                default: DEFAULT_TABLE_ALIGN,
                parseHTML: element => resolveTableAlign(element.getAttribute(TABLE_ALIGN_ATTRIBUTE)),
                renderHTML: () => ({}),
            },
        };
    },
    renderHTML({ node, HTMLAttributes }) {
        const align = resolveTableAlign(node.attrs.align);
        // The default placement adds no markup: only a placement the user chose is written. A
        // table that carries `data-align="center"` and centring margins it never asked for was
        // read downstream as column alignment, and bloats every saved table.
        if (align === DEFAULT_TABLE_ALIGN) return withoutGeneratedStyle(this.parent?.({ node, HTMLAttributes }), HTMLAttributes);
        const { left, right } = tableAlignMargins(align);
        return this.parent?.({
            node,
            HTMLAttributes: mergeAttributes(HTMLAttributes, {
                [TABLE_ALIGN_ATTRIBUTE]: align,
                style: `margin-left: ${left}; margin-right: ${right};`,
            }),
        });
    },
    addProseMirrorPlugins() {
        // When resizable:true, TipTap's Table.addNodeView() returns null and the columnResizing
        // plugin (added here by this.parent?.()) registers its own NodeView (TableView) which
        // creates div.tableWrapper > table. We cannot safely wrap that NodeView, so we use a
        // plugin instead: we walk all table nodes and set the margins on the <table> itself.
        // (On the wrapper they do nothing: it spans the full column, so the table inside it sat
        // at the left whatever its placement.) TableView.ignoreMutation() ignores style changes
        // outside its content, so this causes no re-render loop.
        const parentPlugins = this.parent?.() || [];
        return [
            ...parentPlugins,
            new Plugin({
                key: tableAlignKey,
                view(editorView) {
                    const applyAll = () => {
                        editorView.state.doc.descendants((node, pos) => {
                            if (node.type.name !== TABLE_NODE) return;
                            const dom = editorView.nodeDOM(pos);
                            const table = dom && tableElementOf(dom);
                            if (!table) return;
                            const { left, right } = tableAlignMargins(node.attrs.align);
                            table.style.marginLeft = left;
                            table.style.marginRight = right;
                        });
                    };
                    // Tables in the document the editor was created with get their placement too,
                    // not only those touched by a later change.
                    applyAll();
                    return {
                        update(view, prevState) {
                            if (!prevState || !prevState.doc.eq(view.state.doc)) applyAll();
                        },
                    };
                },
            }),
        ];
    },
});
