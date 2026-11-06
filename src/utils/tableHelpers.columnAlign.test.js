import { afterEach, describe, expect, it } from 'vitest';
import { CellSelection, addRowAfter } from '@tiptap/pm/tables';
import { EditorState, Plugin } from '@tiptap/pm/state';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { applyInscriptEditorTurndownRules } from '../markdown/turndownRules.js';
import { alignNewTableCells, getColumnAlign, setColumnAlign } from './tableHelpers.js';
import { COLUMN_ALIGNMENTS } from '../constants.js';

const TABLE = '<table><tbody>'
    + '<tr><th><p>H1</p></th><th><p>H2</p></th><th><p>H3</p></th></tr>'
    + '<tr><td><p>a1</p></td><td><p style="text-align: center">a2</p></td><td><p>a3</p></td></tr>'
    + '<tr><td><p>b1</p></td><td><p>b2</p></td><td><p>b3</p></td></tr>'
    + '</tbody></table>';

let editor;
afterEach(() => { editor?.destroy(); editor = null; });

const textPos = (text) => {
    let pos = null;
    editor.state.doc.descendants((node, p) => { if (pos === null && node.isText && node.text === text) pos = p; });
    return pos;
};
const cellPos = (text) => editor.state.doc.resolve(textPos(text)).before(-1);
/** The alignment of every cell, row by row. */
const aligns = () => {
    const rows = [];
    editor.state.doc.firstChild.forEach(row => {
        const cells = [];
        row.forEach(cell => cells.push(cell.attrs.align));
        rows.push(cells);
    });
    return rows;
};
const markdown = () => {
    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    td.use(gfm);
    applyInscriptEditorTurndownRules(td);
    return td.turndown(editor.getHTML());
};

describe('setColumnAlign', () => {
    it('aligns every cell of the cursor\'s column, header included, and only that column', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('b2') + 1);
        expect(editor.commands.setColumnAlign('right')).toBe(true);
        expect(aligns()).toEqual([[null, 'right', null], [null, 'right', null], [null, 'right', null]]);
        expect(getColumnAlign(editor.state)).toBe('right');
    });

    it('clears the paragraph alignment inside the column, which would override it', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('H2') + 1);
        editor.commands.setColumnAlign('right');
        expect(editor.getHTML()).not.toContain('text-align: center');
    });

    it('aligns every column a cell selection covers', () => {
        editor = createEditor({ content: TABLE });
        editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cellPos('a1'), cellPos('b2'))));
        editor.commands.setColumnAlign('center');
        expect(aligns()).toEqual([['center', 'center', null], ['center', 'center', null], ['center', 'center', null]]);
    });

    it('null clears the column', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('a3') + 1);
        editor.commands.setColumnAlign('left');
        expect(getColumnAlign(editor.state)).toBe('left');
        editor.commands.setColumnAlign(null);
        expect(getColumnAlign(editor.state)).toBe(null);
        expect(aligns().map(row => row[2])).toEqual([null, null, null]);
    });

    it.each(['justify', 'Right', 'start', undefined, ''])('refuses %j and changes nothing, not even the paragraphs', (value) => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('a2') + 1);
        const before = editor.getHTML();
        expect(editor.can().setColumnAlign(value)).toBe(false);
        expect(editor.commands.setColumnAlign(value)).toBe(false);
        expect(setColumnAlign(editor, value)).toBe(false);
        expect(editor.getHTML()).toBe(before);
    });

    it('reads what a reader sees: a paragraph\'s alignment over its cell\'s', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('b2') + 1);
        editor.commands.setColumnAlign('right');
        // One paragraph aligned left from the toolbar: the column no longer reads as right-aligned.
        editor.commands.setTextSelection(textPos('a2') + 1);
        editor.commands.setTextAlign('left');
        expect(getColumnAlign(editor.state)).toBeUndefined();
        // A column aligned paragraph by paragraph reads as aligned, as the Markdown writer reads it.
        editor.commands.setContent('<table><tbody><tr><th><p style="text-align: center">H</p></th></tr><tr><td><p style="text-align: center">x</p></td></tr></tbody></table>');
        editor.commands.setTextSelection(textPos('x') + 1);
        expect(getColumnAlign(editor.state)).toBe('center');
        // A justified column is no column alignment.
        editor.commands.setTextAlign('justify');
        editor.commands.setTextSelection(textPos('H') + 1);
        editor.commands.setTextAlign('justify');
        expect(getColumnAlign(editor.state)).toBeUndefined();
    });

    it('reads a column whose cells differ as undefined', () => {
        editor = createEditor({ content: '<table><tbody><tr><th style="text-align: right"><p>H</p></th></tr><tr><td><p>x</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('x') + 1);
        expect(getColumnAlign(editor.state)).toBeUndefined();
    });

    it('does nothing outside a table, and says so', () => {
        editor = createEditor({ content: '<p>plain</p>' + TABLE });
        editor.commands.setTextSelection(2);
        const before = editor.getHTML();
        expect(editor.can().setColumnAlign('right')).toBe(false);
        expect(editor.commands.setColumnAlign('right')).toBe(false);
        expect(setColumnAlign(editor, 'right')).toBe(false);
        expect(editor.getHTML()).toBe(before);
        expect(getColumnAlign(editor.state)).toBeUndefined();
    });

    it('leaves a merged cell reaching into another column alone, and aligns it with both its columns', () => {
        editor = createEditor({ content: TABLE });
        editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cellPos('b1'), cellPos('b2'))));
        editor.commands.mergeCells();
        // Aligning the second column alone: the merged cell spans the first one too, so it is not its.
        editor.commands.setTextSelection(textPos('H2') + 1);
        editor.commands.setColumnAlign('right');
        editor.state.doc.check();
        expect(aligns().map(row => row[1] ?? row[0])).toEqual(['right', 'right', null]);
        // The column reads as its own cells: the merged one belongs to neither column.
        expect(getColumnAlign(editor.state)).toBe('right');
        // Selecting both columns takes the merged cell in.
        editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cellPos('H1'), cellPos('a2'))));
        editor.commands.setColumnAlign('center');
        expect(aligns()[2][0]).toBe('center');
        editor.state.doc.check();
    });

    it('a merged header over two columns does not change when one of them is aligned', () => {
        editor = createEditor({ content: '<table><tbody><tr><th colspan="2"><p style="text-align: center">Both</p></th></tr><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('a') + 1);
        editor.commands.setColumnAlign('right');
        expect(editor.getHTML()).toContain('<th colspan="2"><p style="text-align: center;">Both</p></th>');
        // The column reads as its own cells, as written: the merged header is neither column's.
        expect(getColumnAlign(editor.state)).toBe('right');
        editor.commands.setTextSelection(textPos('b') + 1);
        expect(getColumnAlign(editor.state)).toBe(null);
    });

    it('toggling the header row, merging cells or typing gives no cell a new alignment', () => {
        editor = createEditor({ content: '<table><tbody><tr><td><p>top</p></td></tr><tr><td style="text-align: right"><p>a</p></td></tr><tr><td style="text-align: right"><p>b</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('top') + 1);
        editor.commands.toggleHeaderRow();
        expect(aligns()[0][0]).toBe(null);
        editor.commands.insertContent('typed ');
        expect(aligns()[0][0]).toBe(null);
        const cells = [];
        editor.state.doc.descendants((node, pos) => { if (node.type.spec.tableRole?.endsWith('cell')) cells.push(pos); });
        editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cells[0], cells[1])));
        editor.commands.mergeCells();
        editor.state.doc.check();
        expect(aligns()[0][0]).toBe(null);
    });

    it('undo puts a deleted row back as it was, not aligned to the column', () => {
        editor = createEditor({ content: '<table><tbody><tr><th style="text-align: right"><p>H</p></th></tr><tr><td style="text-align: right"><p>a</p></td></tr><tr><td><p>b</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('b') + 1);
        editor.commands.deleteRow();
        editor.commands.undo();
        expect(aligns()).toEqual([['right'], ['right'], [null]]);
        editor.commands.redo();
        editor.commands.undo();
        expect(aligns()).toEqual([['right'], ['right'], [null]]);
    });

    it('content set without history (a load, a sync) is left as it is', () => {
        editor = createEditor({ content: '<p>x</p>' });
        const rows = '<tr><th style="text-align: right"><p>H</p></th></tr><tr><td style="text-align: right"><p>a</p></td></tr>';
        editor.commands.setContent(`<table><tbody>${rows}</tbody></table>`);
        // A sync adds an unaligned row, outside the history: it stays unaligned.
        editor.chain().setMeta('addToHistory', false).setContent(`<table><tbody>${rows}<tr><td><p>b</p></td></tr></tbody></table>`).run();
        expect(aligns()).toEqual([['right'], ['right'], [null]]);
    });

    it('a headerless column with one paragraph set to left gives new rows nothing', () => {
        editor = createEditor({ content: '<table><tbody><tr><td><p style="text-align: left">a</p></td></tr><tr><td><p>b</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('b') + 1);
        expect(getColumnAlign(editor.state)).toBe(null);
        editor.commands.addRowAfter();
        expect(aligns()).toEqual([[null], [null], [null]]);
    });

    it('a row another plugin appends after a load or an undo is left as it is', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('b2') + 1);
        editor.commands.setColumnAlign('right');
        // States without plugins, so only this step (called below) acts on the transactions.
        const start = EditorState.create({ doc: editor.state.doc, selection: editor.state.selection });
        // The root: a change kept out of the history (a load, a sync). Then a plugin's own transaction,
        // appended to it, adds a row: in its round this step sees only that appended transaction.
        const root = start.tr.setMeta('addToHistory', false).insertText('!', 4);
        const afterRoot = start.apply(root);
        let appended = null;
        addRowAfter(afterRoot, tr => { appended = tr; });
        appended.setMeta('appendedTransaction', root);
        expect(alignNewTableCells([appended], afterRoot, afterRoot.apply(appended))).toBeNull();
        // The same row from the reader (no such root) is aligned.
        let own = null;
        addRowAfter(afterRoot, tr => { own = tr; });
        expect(alignNewTableCells([own], afterRoot, afterRoot.apply(own))).not.toBeNull();
    });

    it('a pasted row that comes with content keeps its own alignment', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('b2') + 1);
        editor.commands.setColumnAlign('right');
        const { state } = editor;
        const { schema } = state;
        const cell = text => schema.nodes.tableCell.create(null, schema.nodes.paragraph.create(null, schema.text(text)));
        const row = schema.nodes.tableRow.create(null, [cell('p1'), cell('p2'), cell('p3')]);
        const tableEnd = state.doc.firstChild.nodeSize - 1;
        editor.view.dispatch(state.tr.insert(tableEnd, row));
        expect(aligns().at(-1)).toEqual([null, null, null]);
    });

    it('typing in a table leaves the alignment step alone', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('b2') + 1);
        const before = editor.state;
        const typed = before.tr.insertText('x');
        expect(alignNewTableCells([typed], before, before.apply(typed))).toBeNull();
    });

    it('an alignment of start reads as left in Markdown, and a paragraph set back to start as none', () => {
        // TipTap keeps only left, center and right on a cell, so start comes from HTML written elsewhere.
        const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
        td.use(gfm);
        applyInscriptEditorTurndownRules(td);
        expect(td.turndown('<table><tbody><tr><th style="text-align: start"><p>H</p></th></tr><tr><td style="text-align: left"><p>x</p></td></tr></tbody></table>'))
            .toBe('| H |\n| :--- |\n| x |');
        expect(td.turndown('<table><tbody><tr><th><p>H</p></th></tr><tr><td><p style="text-align: start">x</p></td></tr></tbody></table>'))
            .toBe('| H |\n| --- |\n| x |');
    });


    it.each([
        ['Add Row Below', e => e.commands.addRowAfter()],
        ['Add Row Above', e => e.commands.addRowBefore()],
    ])('a row added with %s keeps the column aligned', (_, add) => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('b2') + 1);
        editor.commands.setColumnAlign('right');
        editor.commands.setTextSelection(textPos('a2') + 1);
        add(editor);
        expect(aligns()).toHaveLength(4);
        expect(aligns().map(row => row[1])).toEqual(['right', 'right', 'right', 'right']);
        expect(aligns().map(row => row[0])).toEqual([null, null, null, null]);
        expect(getColumnAlign(editor.state)).toBe('right');
    });

    it('a row added by Tab in the last cell keeps the column aligned, and Markdown keeps the column', () => {
        editor = createEditor({ content: TABLE });
        // The fixture's second column holds one centred paragraph: clear it, so the table is a GFM one.
        editor.commands.setTextSelection(textPos('a2') + 1);
        editor.commands.setColumnAlign(null);
        editor.commands.setTextSelection(textPos('b3') + 1);
        editor.commands.setColumnAlign('center');
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Tab' })));
        expect(aligns()).toHaveLength(4);
        expect(aligns().map(row => row[2])).toEqual(['center', 'center', 'center', 'center']);
        expect(markdown()).toContain('| --- | --- | :---: |');
    });

    it('a row added below the header row takes the column\'s alignment', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('H1') + 1);
        editor.commands.setColumnAlign('right');
        editor.commands.setTextSelection(textPos('H1') + 1);
        editor.commands.addRowAfter();
        expect(aligns().map(row => row[0])).toEqual(['right', 'right', 'right', 'right']);
        editor.state.doc.check();
    });

    it('a row added next to a centred header alone stays unaligned: only a column\'s alignment carries', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p style="text-align: center">H</p></th></tr><tr><td><p>a</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('H') + 1);
        editor.commands.addRowAfter();
        expect(aligns().map(row => row[0])).toEqual([null, null, null]);
    });

    it('a header aligned on its own, in a table of only a header row, does not spread into new rows', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p style="text-align: center">H</p></th></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('H') + 1);
        editor.commands.addRowAfter();
        expect(aligns()).toEqual([[null], [null]]);
    });

    it('a header column\'s alignment carries into new rows (only a header row\'s does not)', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p>H</p></th><th><p>K</p></th></tr><tr><th><p>side</p></th><td><p>x</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('side') + 1);
        editor.commands.setColumnAlign('right');
        editor.commands.setTextSelection(textPos('side') + 1);
        editor.commands.addRowAfter();
        expect(aligns().map(row => row[0])).toEqual(['right', 'right', 'right']);
    });

    it('a header-only table aligned with the column tool passes it to new rows', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p>H</p></th></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('H') + 1);
        editor.commands.setColumnAlign('right');
        editor.commands.addRowAfter();
        expect(aligns()).toEqual([['right'], ['right']]);
    });

    it('a transaction a plugin appends without history does not stop the reader\'s new row', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('b2') + 1);
        editor.commands.setColumnAlign('right');
        // A plugin that runs first and answers every change with a history-less one of its own (a
        // sync marker, say), so the table step sees [the reader's change, this one].
        editor.registerPlugin(new Plugin({
            appendTransaction: (transactions, oldState, newState) => {
                if (transactions.some(tr => tr.getMeta('marker')) || !transactions.some(tr => tr.docChanged)) return null;
                return newState.tr.setMeta('marker', true).setMeta('addToHistory', false).insertText('!', 4); // 4: the start of the first cell's text
            },
        }), (plugin, plugins) => [plugin, ...plugins]);
        editor.commands.addRowAfter();
        expect(aligns().map(row => row[1])).toEqual(['right', 'right', 'right', 'right']);
    });


    it('adding a row and its alignment is one undo step', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('b2') + 1);
        editor.commands.setColumnAlign('right');
        const before = editor.getHTML();
        editor.commands.addRowAfter();
        expect(editor.getHTML()).not.toBe(before);
        editor.commands.undo();
        expect(editor.getHTML()).toBe(before);
    });

    it('Tab replayed through TipTap\'s keyboardShortcut adds an aligned row without throwing', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('b3') + 1);
        editor.commands.setColumnAlign('right');
        expect(() => editor.commands.keyboardShortcut('Tab')).not.toThrow();
        expect(aligns()).toHaveLength(4);
        expect(aligns().map(row => row[2])).toEqual(['right', 'right', 'right', 'right']);
    });

    it('a paragraph set back to left in an unaligned body cell counts as no alignment', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p>H</p></th></tr><tr><td><p style="text-align: left">x</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('x') + 1);
        expect(getColumnAlign(editor.state)).toBe(null);
        expect(markdown()).toBe('| H |\n| --- |\n| x |');
    });

    it('a header set to left makes a left column, its body cells unaligned or left alike', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p style="text-align: left">H</p></th></tr><tr><td><p>x</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('x') + 1);
        expect(getColumnAlign(editor.state)).toBe('left');
        expect(markdown()).toBe('| H |\n| :--- |\n| x |');
        // Its new rows need no alignment of their own: the body cells have none.
        editor.commands.addRowAfter();
        expect(aligns().map(row => row[0])).toEqual([null, null, null]);
    });

    it('after aligning a column past a merged cell, its button shows what it did', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td colspan="2"><p>wide</p></td></tr><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('a') + 1);
        editor.commands.setColumnAlign('center');
        // The merged row, neither column's, is left alone; the column reads as the cells it set.
        expect(getColumnAlign(editor.state)).toBe('center');
        expect(editor.getHTML()).toContain('<td colspan="2"><p>wide</p></td>');
    });

    it('a table left-aligned from the toolbar, cell by cell, is a table of left columns', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.selectAll();
        editor.commands.setTextAlign('left');
        editor.commands.setTextSelection(textPos('b1') + 1);
        expect(getColumnAlign(editor.state)).toBe('left');
        expect(markdown().split('\n')[1]).toBe('| :--- | :--- | :--- |');
    });

    it('an unaligned header over body cells set to left keeps the header\'s default', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p>H</p></th></tr><tr><td><p style="text-align: left">x</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('x') + 1);
        expect(getColumnAlign(editor.state)).toBe(null);
        expect(markdown()).toBe('| H |\n| --- |\n| x |');
    });


    it('leaves a table nested in a cell alone', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p>H</p></th></tr><tr><td><p>outer</p><table><tbody><tr><th><p style="text-align: center">inner</p></th></tr></tbody></table></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('H') + 1);
        expect(getColumnAlign(editor.state)).toBe(null);
        editor.commands.setColumnAlign('right');
        expect(editor.getHTML()).toContain('<p style="text-align: center;">inner</p>');
    });

    it('COLUMN_ALIGNMENTS cannot be changed by a host', () => {
        expect(Object.isFrozen(COLUMN_ALIGNMENTS)).toBe(true);
        expect(() => COLUMN_ALIGNMENTS.push('justify')).toThrow();
    });

    it('a row added to a column aligned paragraph by paragraph keeps it aligned, and Markdown too', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p style="text-align: right">H</p></th></tr><tr><td><p style="text-align: right">a</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('a') + 1);
        expect(getColumnAlign(editor.state)).toBe('right');
        editor.commands.addRowAfter();
        expect(getColumnAlign(editor.state)).toBe('right');
        expect(markdown()).toBe('| H |\n| ---: |\n| a |\n|  |');
    });

    it('a refused call changes nothing and leaves focus where it is', () => {
        const element = document.createElement('div');
        document.body.appendChild(element);
        const input = document.createElement('input');
        document.body.appendChild(input);
        editor = createEditor({ element, content: TABLE });
        editor.commands.setTextSelection(textPos('b2') + 1);
        input.focus();
        let dispatched = 0;
        editor.on('transaction', () => { dispatched++; });
        expect(setColumnAlign(editor, 'justify')).toBe(false);
        expect(dispatched).toBe(0);
        expect(document.activeElement).toBe(input);
        input.remove();
        element.remove();
    });

    it('the helper refuses cells that cannot keep an alignment', async () => {
        const { TableCell } = await import('@tiptap/extension-table');
        const { buildExtensions } = await import('../extensions/index.js');
        const { Editor } = await import('@tiptap/core');
        // A host's own cell type without the align attribute, in place of TipTap's.
        const PlainCell = TableCell.extend({ addAttributes() { const { align, ...rest } = this.parent?.() ?? {}; return rest; } });
        const extensions = buildExtensions().map(ext => (ext.name === 'tableCell' ? PlainCell : ext));
        const plain = new Editor({ extensions, content: '<table><tbody><tr><td><p style="text-align: center">x</p></td></tr></tbody></table>' });
        try {
            const before = plain.getHTML();
            expect(setColumnAlign(plain, 'right')).toBe(false);
            expect(plain.getHTML()).toBe(before);
        } finally { plain.destroy(); }
    });

    it('the helper returns false on an editor without the table extension', () => {
        const fake = { commands: {}, chain: () => { throw new Error('should not run'); } };
        expect(setColumnAlign(fake, 'left')).toBe(false);
        expect(setColumnAlign(null, 'left')).toBe(false);
    });

    it('is one undo step', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('b2') + 1);
        const before = editor.getHTML();
        editor.commands.setColumnAlign('right');
        editor.commands.undo();
        expect(editor.getHTML()).toBe(before);
    });
});

describe('an aligned column in Markdown', () => {
    it('is written with the matching separator', () => {
        editor = createEditor({ content: TABLE });
        editor.commands.setTextSelection(textPos('b2') + 1);
        editor.commands.setColumnAlign('right');
        editor.commands.setTextSelection(textPos('b1') + 1);
        editor.commands.setColumnAlign('center');
        expect(markdown()).toBe('| H1 | H2 | H3 |\n| :---: | ---: | --- |\n| a1 | a2 | a3 |\n| b1 | b2 | b3 |');
    });

    it('is the same column when its paragraphs, not its cells, carry the alignment', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p style="text-align: right">H</p></th><th><p>K</p></th></tr><tr><td><p style="text-align: right">x</p></td><td><p>y</p></td></tr></tbody></table>' });
        // A GFM table whose separator carries the alignment: no HTML in the cells.
        expect(markdown()).toBe('| H | K |\n| ---: | --- |\n| x | y |');
    });

    it('stays an HTML table when a paragraph\'s alignment cannot be a column\'s (justify)', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p style="text-align: justify">H</p></th></tr><tr><td><p style="text-align: justify">x</p></td></tr></tbody></table>' });
        expect(markdown()).toMatch(/^<table>/);
    });

    it('stays an HTML table when the cells of a column are aligned differently', () => {
        editor = createEditor({ content: '<table><tbody><tr><th><p style="text-align: right">H</p></th></tr><tr><td><p>x</p></td></tr></tbody></table>' });
        expect(markdown()).toMatch(/^<table>/);
    });
});
