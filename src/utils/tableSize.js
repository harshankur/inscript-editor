/**
 * How many cells tables come to once made rectangular (every row as wide as the widest, spans and
 * spans carried down from rows above counted), read from the cells' attributes: never by building
 * the table's map, which for a crafted table is itself the millions of cells this guards against.
 * What a crafted table blows up is its excess: the cells it comes to beyond those it holds (spans
 * claiming columns, padding the table plugin adds). A table rectangular already has none, however large.
 */
import { Fragment } from '@tiptap/pm/model';
import { lowerBound } from './lowerBound.js';

/**
 * Excess cells (see excessOf) the tables of a document may come to, however they came (opened, pasted
 * or made by edits: a document the editor lets a reader make always opens again as it was), and cells
 * a table pasted into may grow by.
 */
export const TABLE_GROWTH_LIMIT = 20000;
/** A column width a document may give (in pixels): wider is read as this. */
export const MAX_COLUMN_WIDTH = 4000;
/** The columns a cell may span (as HTML reads it: wider is read as this), and so the widths it may give. */
export const COLSPAN_LIMIT = 1000;
/** The rows a cell may span (as HTML reads it). */
export const ROWSPAN_LIMIT = 65534;

const isTable = node => node.type.spec.tableRole === 'table';
/** Whether a node may hold a table (a text block, or a leaf, holds none: a walk need not go in). */
const mayHoldTables = node => !node.isTextblock && !node.isLeaf;
const isCell = node => node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell';

/**
 * A span as the table plugin reads it: it counts up to the value as a number (`"200000"` is 200000,
 * `2.5` is 3), so these checks do too. One that is no number at all counts as 1; one that never ends
 * (`Infinity`) as more than any limit.
 */
const spanAttr = value => {
    const span = Number(value);
    if (Number.isNaN(span) || span <= 1) return 1;
    return Number.isFinite(span) ? Math.ceil(span) : Number.MAX_SAFE_INTEGER;
};

/**
 * The widest row of a table given as rows of { colspan, rowspan } (spans already read), spans
 * carried down from the rows above counted, each rowspan cut to the rows left. Shared by the HTML
 * parser (parseDom) and the document checks here.
 * @param {Array<Array<{ colspan: number, rowspan: number }>>} rows
 */
export function widestRow(rows) {
    const carriedEnds = new Array(rows.length + 1).fill(0);
    let carried = 0;
    let widest = 0;
    rows.forEach((cells, index) => {
        carried += carriedEnds[index];
        let width = carried;
        for (const { colspan, rowspan } of cells) {
            const down = Math.min(rowspan, rows.length - index);
            width += colspan;
            if (down > 1) {
                carried += colspan;
                carriedEnds[index + down] -= colspan;
            }
        }
        widest = Math.max(widest, width);
    });
    return widest;
}

/**
 * A table's excess, given as rows of { colspan, rowspan }: the cells it comes to once rectangular (its
 * widest row, see widestRow, times its rows) beyond those it really holds. Shared by the HTML parser
 * (parseDom), the document checks and the JSON check here.
 * @param {Array<Array<{ colspan: number, rowspan: number }>>} rows
 */
export function rowsExcess(rows) {
    const cells = rows.reduce((sum, row) => sum + row.length, 0);
    return Math.max(0, widestRow(rows) * rows.length - cells);
}

/** Whether column widths are other than MAX_COLUMN_WIDTH allows (see boundedColwidth). */
const hasOddWidths = widths => Array.isArray(widths)
    && (widths.length > COLSPAN_LIMIT || widths.some(width => !(Number.isFinite(width) && width >= 0 && width <= MAX_COLUMN_WIDTH)));

/** Column widths as a document may give them: at most COLSPAN_LIMIT, each a number from 0 to MAX_COLUMN_WIDTH. */
export const boundedColwidth = widths => widths.slice(0, COLSPAN_LIMIT).map(width => Math.min(Math.max(Number(width) || 0, 0), MAX_COLUMN_WIDTH));

/** A row's cells' spans as the editor keeps them (capped as HTML reads them back: see boundedCellAttrs). */
const JSON_CELL_TYPES = ['tableCell', 'tableHeader'];
const rowSpans = cells => cells
    // Cells only: a node's by its table role, JSON's by its type (anything else in a row holds no column).
    .filter(cell => cell && (cell.type?.spec ? isCell(cell) : JSON_CELL_TYPES.includes(cell.type)))
    .map(cell => ({ colspan: Math.min(spanAttr(cell.attrs?.colspan), COLSPAN_LIMIT), rowspan: Math.min(spanAttr(cell.attrs?.rowspan), ROWSPAN_LIMIT) }));
const childrenOf = node => {
    const children = [];
    node.forEach(child => children.push(child));
    return children;
};
const spansOf = table => childrenOf(table).map(row => rowSpans(childrenOf(row)));

/** A table node's width (widest row) and height (rows), spans counted. */
export function tableGrid(table) {
    return { width: widestRow(spansOf(table)), height: table.childCount };
}

/**
 * A table node's excess: the cells it comes to once rectangular beyond those it really holds (made
 * up by spans, or added as padding). A table already rectangular, however large, has none.
 */
const excessOf = table => rowsExcess(spansOf(table));

const countsByDoc = new WeakMap();

/**
 * A document's tables: their cells once rectangular (`grid`), the cells they really hold (`nodes`),
 * and the difference (`excess`, see excessOf). Kept per document; one walk.
 */
export function tableCounts(doc) {
    let counts = countsByDoc.get(doc);
    if (!counts) {
        let grid = 0;
        let nodes = 0;
        doc.descendants(child => {
            if (isTable(child)) {
                const { width, height } = tableGrid(child);
                grid += width * height;
            } else if (isCell(child)) nodes += 1;
            return mayHoldTables(child);
        });
        counts = { grid, nodes, excess: Math.max(0, grid - nodes) };
        countsByDoc.set(doc, counts);
    }
    return counts;
}

/** Whether a fragment holds a node `test` takes (stops at the first). */
const holdsNode = (fragment, test) => {
    let found = false;
    fragment.descendants(child => {
        if (!found && test(child)) found = true;
        // A text block holds no table: never walked into.
        return !found && mayHoldTables(child);
    });
    return found;
};

/** Whether a fragment holds table cells (a change that may grow a table). */
export const holdsCells = fragment => holdsNode(fragment, child => isCell(child) || isTable(child) || child.type.spec.tableRole === 'row');

/** Whether a fragment holds a whole table (content brought in, not cells added to a table). */
export const holdsTables = fragment => holdsNode(fragment, isTable);

/** A table cell or header cell node. */
export { isCell };

/** The cells spans claim beyond the cells themselves. */
const spannedBy = cells => cells.reduce((sum, { colspan, rowspan }) => sum + colspan * rowspan - 1, 0);

/**
 * The grid of cells a paste merges into the table it lands in, read as the table plugin reads a
 * paste (its pastedCells): a lone table, or rows or cells cut from one; null for anything else (a
 * table among other content, which goes in whole, nested in the cell).
 * @param {import('@tiptap/pm/model').Slice} slice
 * @returns {{ width: number, height: number, spanned: number } | null} Its size, and the cells its
 *   spans claim beyond their own (what it adds to a table's excess: the rest is filled with real cells).
 */
export function pastedGrid(slice) {
    if (!slice.size) return null;
    let { content, openStart, openEnd } = slice;
    while (content.childCount === 1 && ((openStart > 0 && openEnd > 0) || isTable(content.child(0)))) {
        openStart -= 1;
        openEnd -= 1;
        content = content.child(0).content;
    }
    if (!content.childCount) return null;
    const role = content.child(0).type.spec.tableRole;
    if (role === 'row') {
        const rows = childrenOf(content).map(row => rowSpans(childrenOf(row)));
        return { width: widestRow(rows), height: rows.length, spanned: spannedBy(rows.flat()) };
    }
    if (role === 'cell' || role === 'header_cell') {
        const cells = rowSpans(childrenOf(content));
        return { width: cells.reduce((sum, { colspan }) => sum + colspan, 0), height: 1, spanned: spannedBy(cells) };
    }
    return null;
}

const unpackingByDoc = new WeakMap();

/**
 * The tables to read as their cells' contents so that all a document's tables together have at most
 * `limit` excess cells (see excessOf), those of most excess first, sorted by position; null when they
 * already do or no table may be unpacked. A table already rectangular, however large, has none and is
 * kept. Kept per document for the same limit and change (the size check and its unpacking both ask).
 * @param {import('@tiptap/pm/model').Node} doc
 * @param {number} limit
 * @param {{ range: { from: number, to: number }, had: import('@tiptap/pm/model').Node } | null} change - A
 *   change to the document `had` that put content in `range`: only the tables it brought are unpacked
 *   (one there, and not the same node `had` holds; never one the change only edited inside).
 */
function tablesToUnpack(doc, limit, change) {
    const key = `${limit}:${change?.range.from}:${change?.range.to}`;
    const kept = unpackingByDoc.get(doc);
    if (kept && kept.key === key && kept.had === (change?.had ?? null)) return kept.answer;
    const answer = chooseTablesToUnpack(doc, limit, change);
    unpackingByDoc.set(doc, { key, had: change?.had ?? null, answer });
    return answer;
}

function chooseTablesToUnpack(doc, limit, change) {
    const tables = [];
    doc.descendants((child, pos) => {
        if (isTable(child)) tables.push({ node: child, pos, end: pos + child.nodeSize, excess: excessOf(child) });
        return mayHoldTables(child);
    });
    let total = tables.reduce((sum, table) => sum + table.excess, 0);
    if (total <= limit) return null;
    let candidates = tables.filter(table => table.excess > 0);
    if (change) {
        const { range, had } = change;
        const kept = new Set();
        had.descendants(child => {
            if (isTable(child)) kept.add(child);
            return mayHoldTables(child);
        });
        candidates = candidates.filter(table => table.pos < range.to && table.end > range.from
            && !(table.pos < range.from && table.end > range.to) && !kept.has(table.node));
    }
    const chosen = [];
    for (const table of candidates.sort((a, b) => b.excess - a.excess)) {
        if (total <= limit) break;
        chosen.push(table);
        total -= table.excess;
    }
    return chosen.length ? { chosen: chosen.sort((a, b) => a.pos - b.pos), remaining: total } : null;
}

/**
 * The excess (see excessOf) a document's tables would have once the tables to unpack are (see
 * tablesToUnpack), without unpacking them; null when no table is to be.
 */
export function excessOnceUnpacked(doc, limit, change = null) {
    return tablesToUnpack(doc, limit, change)?.remaining ?? null;
}

/**
 * The chosen tables (sorted by position) as their cells' blocks: for each outermost one, the range it
 * takes and the blocks to put there (a chosen table within its cells unpacked too). Only the nodes
 * around a chosen table are copied.
 */
function unpackedParts(chosen) {
    const unpacked = new Set(chosen.map(table => table.pos));
    // Whether a chosen table lies within [from, to): a binary search over them by position.
    const holdsChosen = (from, to) => {
        const index = lowerBound(chosen, from, table => table.pos);
        return index < chosen.length && chosen[index].pos < to;
    };
    // A chosen table's cells' blocks (one at a time: a table may hold more than a call takes arguments).
    const cellBlocks = (table, pos, out) => {
        table.forEach((row, rowOffset) => row.forEach((cell, cellOffset) => {
            for (const block of rebuild(cell, pos + 1 + rowOffset + 1 + cellOffset + 1)) out.push(block);
        }));
        return out;
    };
    // `child` (at `pos`) rebuilt into `out`: itself, its cells' blocks, or a copy around those.
    const rebuildChild = (child, pos, out) => {
        if (!holdsChosen(pos, pos + child.nodeSize)) out.push(child);
        else if (unpacked.has(pos)) cellBlocks(child, pos, out);
        else out.push(child.copy(Fragment.fromArray(rebuild(child, pos + 1))));
    };
    // `node`'s children rebuilt, each starting at `start` (the position of its content).
    const rebuild = (node, start) => {
        const out = [];
        node.forEach((child, offset) => rebuildChild(child, start + offset, out));
        return out;
    };
    const parts = [];
    for (const table of chosen) {
        if (parts.length && table.pos < parts[parts.length - 1].to) continue;
        parts.push({ from: table.pos, to: table.end, blocks: cellBlocks(table.node, table.pos, []) });
    }
    return { parts, rebuild, rebuildChild };
}

/**
 * The document with the tables of most excess read as their cells' contents (see tablesToUnpack), or
 * null when no table is to be. One walk to find and choose them, one rebuild.
 * @param {import('@tiptap/pm/model').Node} doc
 * @param {number} limit
 * @param {{ range: { from: number, to: number }, had: import('@tiptap/pm/model').Node } | null} [change]
 * @returns {import('@tiptap/pm/model').Node | null}
 */
export function unpackOversizedTables(doc, limit, change = null) {
    const unpacking = tablesToUnpack(doc, limit, change);
    return unpacking ? doc.copy(Fragment.fromArray(unpackedParts(unpacking.chosen).rebuild(doc, 0))) : null;
}

/**
 * The same as unpackOversizedTables, as replacements to make in the document (null when none is to
 * be): `parts`, each outermost table to unpack with its range and the blocks to put there, and
 * `rebuildChild(child, pos, out)`, which puts in `out` a node of the document (at `pos`) with the
 * chosen tables in it unpacked.
 * @param {import('@tiptap/pm/model').Node} doc
 * @param {number} limit
 * @param {{ range: { from: number, to: number }, had: import('@tiptap/pm/model').Node } | null} [change]
 * @returns {{ parts: Array<{ from: number, to: number, blocks: import('@tiptap/pm/model').Node[] }>, rebuildChild: Function } | null}
 */
export function oversizedTableReplacements(doc, limit, change = null) {
    const unpacking = tablesToUnpack(doc, limit, change);
    if (!unpacking) return null;
    const { parts, rebuildChild } = unpackedParts(unpacking.chosen);
    return { parts, rebuildChild };
}

/** A JSON table node's excess (see excessOf), read from the JSON itself (a cheap look before parsing it). */
export function jsonTableExcess(table) {
    const rows = Array.isArray(table?.content) ? table.content : [];
    return rowsExcess(rows.map(row => rowSpans(Array.isArray(row?.content) ? row.content : [])));
}

/**
 * A cell's attributes that are other than a document may give, with the values to give them: its spans
 * as HTML reads them back (whole, from 1 to COLSPAN_LIMIT or ROWSPAN_LIMIT: a document made here opens
 * again as it was) and its column widths (see boundedColwidth). Empty when they need nothing.
 * @param {Record<string, unknown> | null | undefined} attrs
 */
export function boundedCellAttrs(attrs) {
    const changes = {};
    if (!attrs) return changes;
    for (const [name, limit] of [['colspan', COLSPAN_LIMIT], ['rowspan', ROWSPAN_LIMIT]]) {
        if (!(name in attrs)) continue;
        const span = Math.min(spanAttr(attrs[name]), limit);
        if (attrs[name] !== span) changes[name] = span;
    }
    if (hasOddWidths(attrs.colwidth)) changes.colwidth = boundedColwidth(attrs.colwidth);
    return changes;
}

/**
 * A JSON table with each rowspan cut to the rows left from its own (as HTML reads one back: a rowspan
 * past the last row reaches no row), or itself when none needs it.
 */
export function boundedJsonTable(table) {
    const rows = Array.isArray(table?.content) ? table.content : [];
    let changed = false;
    const content = rows.map((row, index) => {
        const cells = Array.isArray(row?.content) ? row.content : null;
        if (!cells) return row;
        const left = rows.length - index;
        let rowChanged = false;
        const kept = cells.map(cell => {
            if (!cell?.attrs || spanAttr(cell.attrs.rowspan) <= left) return cell;
            rowChanged = true;
            return { ...cell, attrs: { ...cell.attrs, rowspan: left } };
        });
        if (!rowChanged) return row;
        changed = true;
        return { ...row, content: kept };
    });
    return changed ? { ...table, content } : table;
}

/** A JSON node with its cell attributes bounded (see boundedCellAttrs), or itself when they need nothing. */
export function boundedJsonCell(node) {
    if (!node.attrs || !('colspan' in node.attrs || 'rowspan' in node.attrs || 'colwidth' in node.attrs)) return node;
    const changes = boundedCellAttrs(node.attrs);
    return Object.keys(changes).length ? { ...node, attrs: { ...node.attrs, ...changes } } : node;
}

/**
 * The cells of a document (between `from` and `to`) whose spans or column widths are other than a
 * document may give (see boundedCellAttrs), with the values to give them.
 * @returns {Array<{ pos: number, changes: Record<string, unknown> }>}
 */
export function oddCells(doc, from = 0, to = doc.content.size) {
    const found = [];
    doc.nodesBetween(from, to, (node, pos) => {
        if (isCell(node)) {
            const changes = boundedCellAttrs(node.attrs);
            if (Object.keys(changes).length) found.push({ pos, changes });
        }
        return mayHoldTables(node);
    });
    return found;
}
