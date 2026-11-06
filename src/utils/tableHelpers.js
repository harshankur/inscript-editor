import { TableMap, isInTable, selectedRect } from '@tiptap/pm/tables';
import { COLUMN_ALIGNMENTS } from '../constants.js';
import { isHistoryTransaction } from '@tiptap/pm/history';
import { columnAlignOf, readingAlign } from './cellAlignment.js';
import { cachedPerState } from './editorView.js';

export const getTableNode = (state) => {
    if (!state) return null;
    const { selection } = state;
    const $pos = selection.$anchorCell || selection.$from;
    if (!$pos) return null;
    for (let d = $pos.depth; d > 0; d--) {
        const node = $pos.node(d);
        if (node.type.name === 'table') {
            return { node, pos: $pos.before(d) };
        }
    }
    return null;
};

export const isHeaderRowActive = (editor) => {
    if (!editor) return false;
    const info = getTableNode(editor.state);
    if (!info) return false;
    const firstRow = info.node.firstChild;
    return firstRow?.firstChild?.type.name === 'tableHeader';
};

export const isHeaderColumnActive = (editor) => {
    if (!editor) return false;
    const info = getTableNode(editor.state);
    if (!info) return false;
    let active = info.node.childCount > 0;
    info.node.forEach(row => { if (row.firstChild?.type.name !== 'tableHeader') active = false; });
    return active;
};

export const setTableLayout = (editor, attrs) => {
    if (!editor) return;
    const info = getTableNode(editor.state);
    if (!info) return;
    editor.chain().focus().command(({ tr }) => {
        tr.setNodeMarkup(info.pos, undefined, { ...info.node.attrs, ...attrs });
        return true;
    }).run();
};


/**
 * The cells lying in columns `left` to `right` (exclusive), each once: `{ offset, top }`, its offset
 * inside the table and its first row. A merged cell reaching outside those columns is not theirs and
 * is left out: aligning one column must not realign its neighbour. Linear in the cells it looks at
 * (a cell's extent comes from its neighbours in the map, not from searching the map for it).
 */
function cellsInColumns(map, left, right) {
    const seen = new Set();
    const cells = [];
    const at = (row, column) => map.map[row * map.width + column];
    for (let column = left; column < right; column++) {
        for (let row = 0; row < map.height; row++) {
            const offset = at(row, column);
            if (seen.has(offset)) continue; // a merged cell spanning rows or these columns
            seen.add(offset);
            // Iterating columns from `left`, a cell first met here starts here, unless it reaches in
            // from the column before `left`. It ends where the map stops repeating it.
            const startsBefore = column === left && column > 0 && at(row, column - 1) === offset;
            let last = column;
            while (last + 1 < map.width && at(row, last + 1) === offset) last++;
            if (!startsBefore && last < right) cells.push({ offset, top: row });
        }
    }
    return cells;
}

/**
 * The document positions of the cells in the columns the selection covers (a cell selection's
 * columns, or the column of the cell holding the cursor), header row included. Null outside a
 * table.
 */
function columnCellPositions(state) {
    if (!state || !isInTable(state)) return null;
    const { map, tableStart, left, right } = selectedRect(state);
    return cellsInColumns(map, left, right).map(({ offset }) => tableStart + offset);
}

/** Is this a value a column can be aligned to (`null` clears it)? */
const isColumnAlign = align => align === null || COLUMN_ALIGNMENTS.includes(align);

const isTableNode = node => node.type.spec.tableRole === 'table';
const isHeaderCell = node => node.type.spec.tableRole === 'header_cell';

/**
 * Each textblock of a cell, not those of a table nested in it (that table's columns are its own).
 * `visit` gets the block and its offset inside the cell.
 */
function forEachCellTextblock(cell, visit) {
    cell.descendants((child, offset) => {
        if (isTableNode(child)) return false;
        if (child.isTextblock) { visit(child, offset); return false; }
        return true;
    });
}

/**
 * How a cell's text is aligned as a reader sees it (see readingAlign): one value when all its
 * paragraphs agree, undefined when they differ.
 */
function cellTextAlign(cell) {
    const seen = new Set();
    forEachCellTextblock(cell, block => { seen.add(readingAlign(cell.attrs.align, block.attrs.textAlign)); });
    if (seen.size === 0) return readingAlign(cell.attrs.align, null);
    return seen.size === 1 ? [...seen][0] : undefined;
}

/** A cell as the column rule (columnAlignOf) reads it. */
const readCell = cell => ({ align: cellTextAlign(cell), isHeader: isHeaderCell(cell) });

/**
 * The alignment the selected columns' text shares, as a reader sees it: 'left', 'center' or
 * 'right', null when none is set, and undefined when the cells differ, when one is justified, or
 * outside a table. A paragraph's own alignment counts over its cell's.
 * @param {import('@tiptap/pm/state').EditorState} state
 * @returns {'left'|'center'|'right'|null|undefined}
 */
export function getColumnAlign(state) {
    if (!state) return undefined;
    // Read while rendering the table menu, which re-renders on every transaction: once per state.
    return cachedPerState(state, 'columnAlign', () => {
        // The cells the column command writes: a merged cell reaching into another column belongs
        // to neither, so the button shows what pressing it did.
        const positions = columnCellPositions(state);
        if (!positions || positions.length === 0) return undefined;
        return columnAlignOf(positions.map(pos => readCell(state.doc.nodeAt(pos))));
    });
}

/**
 * Align the selected columns: set `align` on every cell of each, header included, and clear the
 * alignment of the paragraphs and headings inside them (a paragraph's own alignment would
 * override the column's, so the column would not read as aligned). `null` clears the column's
 * alignment. A merged cell reaching into another column is left alone. Adds the steps to `tr`;
 * returns false, changing nothing, outside a table or for a value that is not 'left', 'center',
 * 'right' or null.
 * @param {import('@tiptap/pm/state').EditorState} state
 * @param {import('@tiptap/pm/state').Transaction} tr
 * @param {'left'|'center'|'right'|null} align
 * @returns {boolean}
 */
export function applyColumnAlign(state, tr, align) {
    if (!isColumnAlign(align)) return false;
    const positions = columnCellPositions(state);
    if (!positions) return false;
    for (const pos of positions) {
        const cell = tr.doc.nodeAt(pos);
        if (!cell) continue;
        if (cell.attrs.align !== align) tr.setNodeMarkup(pos, undefined, { ...cell.attrs, align });
        // Attribute changes keep every position, so the cell's own content positions still hold.
        forEachCellTextblock(cell, (block, offset) => {
            if (block.attrs.textAlign != null) tr.setNodeMarkup(pos + 1 + offset, undefined, { ...block.attrs, textAlign: null });
        });
    }
    return true;
}

/** Can the selected columns be aligned to this value (in a table, a valid alignment)? */
export const canApplyColumnAlign = (state, align) => isColumnAlign(align) && !!state && isInTable(state);

const isRowNode = node => node.type.spec.tableRole === 'row';

/** Does this fragment hold a table row? Stops at the first one, and never enters text. */
function holdsRow(fragment) {
    for (let index = 0; index < fragment.childCount; index++) {
        const node = fragment.child(index);
        if (isRowNode(node)) return true;
        if (!node.isTextblock && holdsRow(node.content)) return true;
    }
    return false;
}

/** The ranges the row-inserting steps of these transactions inserted, in the final document's positions. */
function insertedRanges(transactions) {
    let ranges = [];
    for (const tr of transactions) {
        for (const step of tr.steps) {
            const map = step.getMap();
            // Earlier ranges move with this step (there are only as many as steps that insert rows).
            if (ranges.length) ranges = ranges.map(([from, to]) => [map.map(from, 1), map.map(to, -1)]).filter(([from, to]) => to > from);
            if (step.slice && holdsRow(step.slice.content)) {
                map.forEach((oldStart, oldEnd, newStart, newEnd) => { if (newEnd > newStart) ranges.push([newStart, newEnd]); });
            }
        }
    }
    return ranges;
}

/**
 * For an appendTransaction: give the cells of rows a change added (Add Row Above or Below, Tab in
 * the last cell) the alignment of their column, so an aligned column stays aligned. A column is
 * aligned when every cell of the rows that were already there reads the same alignment (see
 * cellTextAlign) and one of them lies outside the header rows; a column whose cells differ, have
 * none, or are only a header row's, gives its new cells nothing. A row
 * counts as added when it lies wholly inside what a step inserted, so a cell that only changed (a
 * header toggled, cells merged, a column resized) is not new. Undo, redo and changes kept out of
 * the history (a load, a sync) are left exactly as they are. Only the tables the rows went into are
 * looked at, and nothing at all unless a step inserts a row. Null when nothing needs it.
 * Its arguments are appendTransaction's; the old state is not needed (the steps tell what is new).
 * @param {readonly import('@tiptap/pm/state').Transaction[]} transactions
 * @param {import('@tiptap/pm/state').EditorState} _oldState
 * @param {import('@tiptap/pm/state').EditorState} newState
 * @returns {import('@tiptap/pm/state').Transaction|null}
 */
export function alignNewTableCells(transactions, _oldState, newState) {
    if (!transactions.some(tr => tr.docChanged)) return null;
    // Undo and redo put back exactly what was there; a load or a sync is not the reader's edit. The
    // first transaction is the one that started this round (others were appended by plugins).
    // In a later round ProseMirror passes only the transactions this plugin has not seen, and the
    // first of those may be another plugin's: its appendedTransaction meta names the root.
    const origin = transactions[0].getMeta('appendedTransaction') ?? transactions[0];
    if (isHistoryTransaction(origin) || origin.getMeta('addToHistory') === false) return null;
    // Only the steps that insert rows give ranges: none, and there is nothing to do.
    const ranges = insertedRanges(transactions);
    if (ranges.length === 0) return null;
    const insertedWhole = (from, to) => ranges.some(([start, end]) => start <= from && to <= end);

    // The tables the inserted ranges touch.
    const tables = new Map();
    for (const [from, to] of ranges) {
        newState.doc.nodesBetween(from, to, (node, pos) => {
            if (node.isTextblock) return false;
            if (isTableNode(node)) tables.set(pos, node);
            return true;
        });
    }

    const tr = newState.tr;
    for (const [pos, table] of tables) {
        const tableStart = pos + 1;
        const newRows = new Set();
        // A header row (all header cells) aligned on its own is the header's styling.
        const headerRows = new Set();
        table.forEach((row, offset, index) => {
            const rowPos = tableStart + offset;
            if (insertedWhole(rowPos, rowPos + row.nodeSize)) newRows.add(index);
            let allHeaders = row.childCount > 0;
            row.forEach(cell => { if (!isHeaderCell(cell)) allHeaders = false; });
            if (allHeaders) headerRows.add(index);
        });
        if (newRows.size === 0 || newRows.size === table.childCount) continue; // nothing added, or a new table
        const map = TableMap.get(table);
        for (let column = 0; column < map.width; column++) {
            const old = [];
            const fresh = [];
            let oldBody = false;
            let allCellsAligned = true;
            for (const { offset, top } of cellsInColumns(map, column, column + 1)) {
                const cell = table.nodeAt(offset);
                if (newRows.has(top)) fresh.push({ cell, offset });
                else {
                    old.push(readCell(cell));
                    // A cell outside the header rows (a body cell, or a header column's) makes it a column.
                    if (!headerRows.has(top)) oldBody = true;
                    if (cell.attrs.align == null) allCellsAligned = false;
                }
            }
            // Only a header row aligned, from the toolbar: the header's styling, not the column's
            // alignment. Aligned with the column tool (on the cells), it is the column's.
            if (fresh.length === 0 || !(oldBody || allCellsAligned)) continue;
            const align = columnAlignOf(old);
            if (!COLUMN_ALIGNMENTS.includes(align)) continue;
            // New body cells take what the body cells read: a header set to left over an unaligned
            // body is a left column in Markdown, but its new rows need no alignment of their own.
            const body = old.filter(cell => !cell.isHeader);
            if (body.length > 0 && !body.every(cell => cell.align === align)) continue;
            for (const { cell, offset } of fresh) {
                // A new cell aligned already (copied, or set by the same change) keeps its own, and
                // one that came with content (pasted, moved) is left as it came: only the empty cells
                // Add Row and Tab create take the column's alignment.
                if (cell.attrs.align != null || cellTextAlign(cell) !== null || cell.textContent !== '') continue;
                tr.setNodeMarkup(tableStart + offset, undefined, { ...cell.attrs, align });
            }
        }
    }
    return tr.docChanged ? tr : null;
}

const columnAlignSupport = new WeakMap();

/**
 * Does this editor have this library's table extension (its setColumnAlign command)? Answered once
 * per editor: reading `editor.commands` builds every command's wrapper anew.
 * @param {import('@tiptap/core').Editor|null|undefined} editor
 * @returns {boolean}
 */
export function canAlignColumns(editor) {
    if (!editor) return false;
    if (!columnAlignSupport.has(editor)) {
        // The command, and cells that keep an alignment (an older or custom cell type without the
        // attribute would drop it, while the paragraphs' alignment is cleared).
        const nodes = editor.schema?.nodes ?? {};
        const cellsKeepAlign = ['tableCell', 'tableHeader'].every(name => !nodes[name] || 'align' in (nodes[name].spec.attrs ?? {}));
        columnAlignSupport.set(editor, 'setColumnAlign' in (editor.extensionManager?.commands ?? {}) && cellsKeepAlign);
    }
    return columnAlignSupport.get(editor);
}

/**
 * Align the selected columns from a host or a menu (see applyColumnAlign). False when the editor
 * has no table extension of ours, outside a table, or for an invalid value.
 */
export const setColumnAlign = (editor, align) => {
    if (!canAlignColumns(editor)) return false;
    // A refused call changes nothing, focus included (it may be in the host's own field).
    if (!editor.can().setColumnAlign(align)) return false;
    return editor.chain().focus().setColumnAlign(align).run();
};
