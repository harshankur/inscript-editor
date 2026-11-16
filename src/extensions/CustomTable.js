import { mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Fragment, Slice } from '@tiptap/pm/model';
import { Table } from '@tiptap/extension-table';
import { TABLE_ALIGN, DEFAULT_TABLE_ALIGN, TABLE_ALIGN_ATTRIBUTE } from '../constants.js';
import { alignNewTableCells, applyColumnAlign, canApplyColumnAlign, getTableNode } from '../utils/tableHelpers.js';
import { CellSelection, TableMap, addColumnAfter, addColumnBefore, addRowAfter, addRowBefore, cellAround, isInTable, mergeCells, selectedRect, splitCell } from '@tiptap/pm/tables';
import { changedRange, perTransaction, replacesWholeDocument } from '../utils/transactions.js';
import { COLSPAN_LIMIT, ROWSPAN_LIMIT, TABLE_GROWTH_LIMIT, excessOnceUnpacked, holdsCells, holdsTables, isCell, oddCells, oversizedTableReplacements, pastedGrid, tableCounts, tableGrid, unpackOversizedTables } from '../utils/tableSize.js';

const tableAlignKey = new PluginKey('tableAlign');
const columnAlignKey = new PluginKey('tableColumnAlign');
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

const tableSizeKey = new PluginKey('inscriptTableSize');

/**
 * Whether adding a row or a column at a side of the selection (`left`/`right`: a column, `top`/`bottom`:
 * a row, as the table commands add them) keeps the document's tables within TABLE_GROWTH_LIMIT (the
 * size check refuses a change past it), and every span within what HTML reads back (COLSPAN_LIMIT,
 * ROWSPAN_LIMIT): one past either is neither offered nor reported done, as the document would not open
 * again as it was. What it adds is exact, read from the table's map: each row (or column) whose cell
 * spans the line the new column (or row) goes in grows that cell by one; anywhere else a new cell goes in.
 */
function growthFits(state, side) {
    if (!isInTable(state)) return true;
    const rect = selectedRect(state);
    const { map, table } = rect;
    const column = side === 'left' || side === 'right';
    const line = rect[side];
    let grown = 0;
    let widest = 0;
    const across = column ? map.height : map.width;
    if (line > 0 && line < (column ? map.width : map.height)) {
        for (let index = 0; index < across; index++) {
            const before = column ? map.map[index * map.width + line - 1] : map.map[(line - 1) * map.width + index];
            const after = column ? map.map[index * map.width + line] : map.map[line * map.width + index];
            if (before !== after) continue;
            grown += 1;
            const attrs = table.nodeAt(before)?.attrs;
            widest = Math.max(widest, column ? attrs?.colspan ?? 1 : attrs?.rowspan ?? 1);
        }
    }
    if (!grown) return true;
    if (widest + 1 > (column ? COLSPAN_LIMIT : ROWSPAN_LIMIT)) return false;
    const { excess } = tableCounts(state.doc);
    return excess + grown <= Math.max(TABLE_GROWTH_LIMIT, excess);
}

/**
 * Whether merging the selected cells keeps the document's tables within TABLE_GROWTH_LIMIT (the size
 * check refuses a change past it), and the merged cell's spans within what HTML reads back
 * (COLSPAN_LIMIT, ROWSPAN_LIMIT), so a merge past either is neither offered (`can()`) nor reported
 * done. Merging cells into one adds to the excess one cell fewer than it merges: the area stays, held
 * by a single cell.
 */
function mergeFits(state) {
    if (!(state.selection instanceof CellSelection)) return true;
    let merged = 0;
    state.selection.forEachCell(() => { merged += 1; });
    if (merged <= 1) return true;
    const { left, right, top, bottom } = selectedRect(state);
    if (right - left > COLSPAN_LIMIT || bottom - top > ROWSPAN_LIMIT) return false;
    const { excess } = tableCounts(state.doc);
    return excess + merged - 1 <= Math.max(TABLE_GROWTH_LIMIT, excess);
}

/** A cell's attributes that size its table (set by an attribute step of their own, or with the cell). */
const SIZING_ATTRS = ['colspan', 'rowspan', 'colwidth'];
const bringsCells = perTransaction(tr => tr.steps.some(step => (step.slice && holdsCells(step.slice.content)) || SIZING_ATTRS.includes(step.attr)));
/** Whether a transaction puts in a whole table (content brought in, not cells added to a table). */
const bringsTables = perTransaction(tr => tr.steps.some(step => step.slice && holdsTables(step.slice.content)));
const OUTSIDE_EVENTS = ['paste', 'drop'];
const fromOutside = tr => replacesWholeDocument(tr) || OUTSIDE_EVENTS.includes(tr.getMeta('uiEvent')) || bringsTables(tr);

/** Tables unpacked by a step each (more are unpacked in one step: see applied). */
const SEPARATE_REPLACEMENTS = 50;

/**
 * A transaction on `state` unpacking tables (see oversizedTableReplacements; none: null). A few are
 * each replaced by their cells' blocks, last to first, nothing else touched, so the selection and the
 * undo history map through it. Many (a step each would rebuild the document as many times) are
 * unpacked in one step over the children of their common parent, from the first to the last.
 */
function applied(state, unpacking) {
    if (!unpacking) return null;
    const { parts, rebuildChild } = unpacking;
    const tr = state.tr;
    if (parts.length <= SEPARATE_REPLACEMENTS) {
        for (let index = parts.length - 1; index >= 0; index--) {
            const { from, to, blocks } = parts[index];
            tr.replaceWith(from, to, Fragment.fromArray(blocks));
        }
        return tr;
    }
    const last = parts[parts.length - 1];
    const $first = state.doc.resolve(parts[0].from);
    const depth = $first.sharedDepth(last.to - 1);
    const parent = $first.node(depth);
    const firstIndex = $first.index(depth);
    const lastIndex = state.doc.resolve(last.to - 1).index(depth);
    const from = $first.posAtIndex(firstIndex, depth);
    const out = [];
    let pos = from;
    for (let index = firstIndex; index <= lastIndex; index++) {
        const child = parent.child(index);
        rebuildChild(child, pos, out);
        pos += child.nodeSize;
    }
    return tr.replaceWith(from, pos, Fragment.fromArray(out));
}

/**
 * JSON content with its tables of most excess read as their cells' contents (see
 * unpackOversizedTables), or as it is when the schema refuses it (TipTap then reads it as an empty
 * document) or none is to be.
 */
export function unpackedJsonTables(schema, content) {
    try {
        const bounded = unpackOversizedTables(schema.nodeFromJSON(content), TABLE_GROWTH_LIMIT);
        return bounded ? bounded.toJSON() : content;
    } catch {
        return content;
    }
}

/**
 * Tables cannot be blown up. A table pasted into a table (the table plugin widens and lengthens the
 * one it lands in to fit, padding every row) that would grow it by more than TABLE_GROWTH_LIMIT cells
 * is pasted as its cells' content. Tables brought in (a load, setContent, a paste, a drop, a table
 * inserted) that take the document's excess (cells beyond those its tables hold: spans claiming
 * columns, padding to come) past TABLE_GROWTH_LIMIT, or past what it already was, are read as their
 * cells' contents, those of most excess first, before the table plugin pads them; a table that is
 * rectangular already is never touched, nor one the reader had. Any other change (a merge, a row added)
 * may not take the excess past the same limit, so a document made here opens again as it was. Read
 * from the cells' attributes, never from the (possibly huge) table map.
 */
function tableSizePlugin() {
    return new Plugin({
        key: tableSizeKey,
        props: {
            // The table pasted into grows only where the paste reaches past its edges (from the cell it
            // lands in); past the limit, the paste is its cells' content.
            handlePaste(view, _event, slice) {
                const { state } = view;
                const around = getTableNode(state);
                // Into selected cells, a paste is clipped to them (never grows the table).
                if (!around || !holdsCells(slice.content) || state.selection instanceof CellSelection) return false;
                // Only a paste the table plugin merges into the table (other content goes in whole).
                const pasted = pastedGrid(slice);
                if (!pasted) return false;
                const into = tableGrid(around.node);
                let left = 0;
                let top = 0;
                try {
                    const $cell = cellAround(state.selection.$from);
                    if ($cell) {
                        const map = TableMap.get(around.node);
                        const rect = map.findCell($cell.pos - around.pos - 1);
                        left = rect.left;
                        top = rect.top;
                    }
                } catch { /* where it lands is not known: at the far corner */
                    left = into.width;
                    top = into.height;
                }
                const width = Math.max(into.width, left + pasted.width);
                const height = Math.max(into.height, top + pasted.height);
                // The growth is weighed, not the table's size: a large table may take a row or two more.
                // So is what it adds to the document's excess (its spans: the table plugin fills the rest
                // with real cells): a paste the size check would refuse goes in as its cells' content.
                const growth = width * height - into.width * into.height;
                if (growth <= TABLE_GROWTH_LIMIT && tableCounts(state.doc).excess + pasted.spanned <= TABLE_GROWTH_LIMIT) return false;
                // The cells' own content, as blocks in the cell it lands in (text, images and all).
                const blocks = [];
                slice.content.descendants(node => {
                    if (isCell(node)) {
                        node.forEach(block => blocks.push(block));
                        return false;
                    }
                    return true;
                });
                if (!blocks.length) return true;
                view.dispatch(state.tr.replaceSelection(new Slice(Fragment.fromArray(blocks), 0, 0)).scrollIntoView());
                return true;
            },
        },
        // Before the table plugin's (this plugin comes first), which pads every row to full width. Part of
        // the change it follows in the history (an appended transaction joins its undo step): an undo
        // takes back both together, never bringing oversized tables back, and earlier steps are kept. (A
        // document opened with such JSON is bounded before it is drawn: see DocumentValues' onBeforeCreate.)
        appendTransaction(transactions, oldState, state) {
            const changed = transactions.filter(tr => tr.docChanged);
            if (!changed.length) return null;
            // A change that brings no cells (text pasted, a block moved) cannot add excess.
            if (!changed.some(bringsCells)) return null;
            let tr = null;
            const whole = changed.some(replacesWholeDocument);
            const { excess } = tableCounts(state.doc);
            // Only a change that adds excess is weighed (the document may already have more, by edits):
            // a paste of text or a block moved never rebuilds the document.
            const limit = Math.max(TABLE_GROWTH_LIMIT, whole ? 0 : tableCounts(oldState.doc).excess);
            const range = whole ? null : changedRange(changed);
            if (excess > limit && (whole || range)) {
                tr = applied(state, oversizedTableReplacements(state.doc, limit, range && { range, had: oldState.doc }));
            }
            // Spans and column widths bounded where cells came or changed (JSON content, a column dragged
            // wider), as a reload would read them (see boundedCellAttrs).
            if (whole || range) {
                const doc = tr ? tr.doc : state.doc;
                const from = whole ? 0 : Math.min(tr ? tr.mapping.map(range.from, -1) : range.from, doc.content.size);
                const to = whole ? doc.content.size : Math.min(tr ? tr.mapping.map(range.to) : range.to, doc.content.size);
                for (const { pos, changes } of oddCells(doc, from, Math.max(from, to))) {
                    tr = tr ?? state.tr;
                    for (const [name, value] of Object.entries(changes)) tr.setNodeAttribute(pos, name, value);
                }
            }
            return tr;
        },
        filterTransaction(tr, state) {
            if (!tr.docChanged || !bringsCells(tr)) return true;
            // Content set as a whole (a load, setContent): bounded by the unpacking right after it,
            // before the table plugin pads anything, rather than refused.
            if (replacesWholeDocument(tr)) return true;
            // Only cells made up (by spans, or padding to come) are weighed: a row or column added to a
            // table rectangular already, an undo, adds none.
            const bound = Math.max(TABLE_GROWTH_LIMIT, tableCounts(state.doc).excess);
            if (tableCounts(tr.doc).excess <= bound) return true;
            // Content brought in (a paste, a drop, a table inserted) is let through when unpacking the
            // tables it brought (as appendTransaction does) brings the document within the bound.
            if (!fromOutside(tr)) return false;
            const range = changedRange([tr]);
            const left = range && excessOnceUnpacked(tr.doc, bound, { range, had: state.doc });
            return left !== null && left <= bound;
        },
    });
}

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
    addCommands() {
        return {
            ...this.parent?.(),
            // A merge the size check would refuse is not offered (see mergeFits).
            mergeCells: () => ({ state, dispatch }) => mergeFits(state) && mergeCells(state, dispatch),
            mergeOrSplit: () => ({ state, dispatch }) => (mergeFits(state) && mergeCells(state, dispatch)) || splitCell(state, dispatch),
            // A row or column the size check would refuse is not offered (see growthFits).
            addColumnBefore: () => ({ state, dispatch }) => growthFits(state, 'left') && addColumnBefore(state, dispatch),
            addColumnAfter: () => ({ state, dispatch }) => growthFits(state, 'right') && addColumnAfter(state, dispatch),
            addRowBefore: () => ({ state, dispatch }) => growthFits(state, 'top') && addRowBefore(state, dispatch),
            addRowAfter: () => ({ state, dispatch }) => growthFits(state, 'bottom') && addRowAfter(state, dispatch),
            /**
             * Align the columns the selection covers ('left', 'center', 'right', or null to clear):
             * every cell of each column, header included, so it is an aligned column to a reader of
             * the HTML and to a Markdown writer (`---:`). See applyColumnAlign.
             */
            setColumnAlign: align => ({ state, tr, dispatch }) => {
                if (!dispatch) return canApplyColumnAlign(state, align);
                return applyColumnAlign(state, tr, align);
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
            // First, so its paste is weighed before the table plugin's.
            tableSizePlugin(),
            ...parentPlugins,
            // Cells a change creates (a row added, by a button or by Tab in the last cell) take their
            // column's alignment, in the same undo step, so an aligned column stays aligned.
            new Plugin({
                key: columnAlignKey,
                appendTransaction: alignNewTableCells,
            }),
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
