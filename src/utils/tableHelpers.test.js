import { beforeEach, describe, expect, it } from 'vitest';
import { TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { getTableNode, isHeaderColumnActive, isHeaderRowActive, setTableLayout } from './tableHelpers.js';

function firstCellPos(editor, typeName = 'tableCell') {
    let pos;
    editor.state.doc.descendants((node, nodePos) => {
        if (pos === undefined && node.type.name === typeName) pos = nodePos;
    });
    return pos;
}

function selectCell(editor, pos) {
    const sel = CellSelection.create(editor.state.doc, pos);
    editor.view.dispatch(editor.state.tr.setSelection(sel));
}

function placeCursorInCell(editor, cellPos) {
    // +2 lands inside the cell's default paragraph child
    const sel = TextSelection.near(editor.state.doc.resolve(cellPos + 2));
    editor.view.dispatch(editor.state.tr.setSelection(sel));
}

describe('tableHelpers', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
    });

    describe('getTableNode', () => {
        it('returns null with no table in the document', () => {
            editor.commands.setContent('<p>no table here</p>');
            expect(getTableNode(editor.state)).toBeNull();
        });

        it('returns null when the cursor is outside any table', () => {
            editor.commands.setContent('<p>outside</p><table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>');
            editor.commands.setTextSelection(1);
            expect(getTableNode(editor.state)).toBeNull();
        });

        it('returns the table node when the cursor is inside a cell', () => {
            editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
            const cellPos = firstCellPos(editor);
            placeCursorInCell(editor, cellPos);
            const info = getTableNode(editor.state);
            expect(info).not.toBeNull();
            expect(info.node.type.name).toBe('table');
        });

        it('returns the table node via a CellSelection ($anchorCell)', () => {
            editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
            const cellPos = firstCellPos(editor);
            selectCell(editor, cellPos);
            expect('$anchorCell' in editor.state.selection).toBe(true);
            const info = getTableNode(editor.state);
            expect(info).not.toBeNull();
            expect(info.node.type.name).toBe('table');
        });

        it('returns null when state is falsy', () => {
            expect(getTableNode(null)).toBeNull();
        });
    });

    describe('isHeaderRowActive', () => {
        it('is false without a header row', () => {
            editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
            const cellPos = firstCellPos(editor, 'tableCell');
            placeCursorInCell(editor, cellPos);
            expect(isHeaderRowActive(editor)).toBe(false);
        });

        it('is true with a header row', () => {
            editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
            const cellPos = firstCellPos(editor, 'tableHeader');
            placeCursorInCell(editor, cellPos);
            expect(isHeaderRowActive(editor)).toBe(true);
        });

        it('returns false without an editor', () => {
            expect(isHeaderRowActive(null)).toBe(false);
        });
    });

    describe('isHeaderColumnActive', () => {
        it('is false without a header column', () => {
            editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
            const cellPos = firstCellPos(editor, 'tableHeader');
            placeCursorInCell(editor, cellPos);
            expect(isHeaderColumnActive(editor)).toBe(false);
        });

        it('is true when every row starts with a <th> (toggleHeaderColumn)', () => {
            editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
            const cellPos = firstCellPos(editor, 'tableHeader');
            placeCursorInCell(editor, cellPos);
            editor.commands.toggleHeaderColumn();
            expect(isHeaderColumnActive(editor)).toBe(true);
        });
    });

    describe('setTableLayout', () => {
        it('merges attrs onto the table node', () => {
            editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
            const cellPos = firstCellPos(editor, 'tableHeader');
            placeCursorInCell(editor, cellPos);
            setTableLayout(editor, { align: 'right' });
            expect(getTableNode(editor.state).node.attrs.align).toBe('right');
        });

        it('is a no-op outside a table', () => {
            editor.commands.setContent('<p>no table</p>');
            expect(() => setTableLayout(editor, { align: 'right' })).not.toThrow();
        });
    });
});
