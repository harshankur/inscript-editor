import { beforeEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { getTableNode, setTableLayout } from '../utils/tableHelpers.js';
import { resolveTableAlign, tableAlignMargins } from './CustomTable.js';
import { TABLE_ALIGN, DEFAULT_TABLE_ALIGN, TABLE_ALIGN_ATTRIBUTE } from '../constants.js';

const PLAIN_TABLE = '<table><tbody><tr><th>a</th></tr><tr><td>1</td></tr></tbody></table>';
const tableTag = html => html.match(/<table[^>]*>/)[0];

describe('CustomTable extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
    });

    it('defaults align to center', () => {
        editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
        expect(getTableNode(editor.state).node.attrs.align).toBe('center');
        expect(DEFAULT_TABLE_ALIGN).toBe(TABLE_ALIGN.CENTER);
    });

    describe('serialization', () => {
        it('writes no placement markup for a table nobody placed', () => {
            editor.commands.setContent(PLAIN_TABLE);
            const tag = tableTag(editor.getHTML());
            expect(tag).not.toContain(TABLE_ALIGN_ATTRIBUTE);
            expect(tag).not.toContain('margin');
        });

        it('adds no attribute at all to an unplaced table, resized or not', () => {
            editor.commands.setContent(PLAIN_TABLE);
            expect(tableTag(editor.getHTML())).toBe('<table>');
            // Column widths travel on the cells and the colgroup, not as a style on the table.
            editor.commands.setContent('<table><tbody><tr><th colwidth="120">a</th><th colwidth="120">b</th></tr></tbody></table>');
            expect(tableTag(editor.getHTML())).toBe('<table>');
            expect(editor.getHTML()).toContain('<col style="width: 120px;">');
        });

        it('drops a default placement it is handed (older saved documents carry it on every table)', () => {
            editor.commands.setContent('<table data-align="center" style="margin-left: auto; margin-right: auto;"><tbody><tr><th>a</th></tr></tbody></table>');
            expect(getTableNode(editor.state).node.attrs.align).toBe('center');
            expect(tableTag(editor.getHTML())).not.toContain(TABLE_ALIGN_ATTRIBUTE);
        });

        it.each([
            ['left', 'margin-left: 0px; margin-right: auto;'],
            ['right', 'margin-left: auto; margin-right: 0px;'],
        ])('writes a chosen %s placement, with its margins', (align, style) => {
            editor.commands.setContent(PLAIN_TABLE);
            editor.commands.setTextSelection(4);
            setTableLayout(editor, { align });
            expect(tableTag(editor.getHTML())).toBe(`<table data-align="${align}" style="${style}">`);
        });

        it('going back to the default removes the markup again', () => {
            editor.commands.setContent('<table data-align="right"><tbody><tr><th>a</th></tr></tbody></table>');
            editor.commands.setTextSelection(4);
            setTableLayout(editor, { align: TABLE_ALIGN.CENTER });
            expect(tableTag(editor.getHTML())).not.toContain(TABLE_ALIGN_ATTRIBUTE);
        });
    });

    describe('parsing', () => {
        it.each([
            ['left', 'left'],
            ['right', 'right'],
            ['center', 'center'],
        ])('reads data-align="%s"', (value, expected) => {
            editor.commands.setContent(`<table data-align="${value}"><tbody><tr><th>a</th></tr></tbody></table>`);
            expect(getTableNode(editor.state).node.attrs.align).toBe(expected);
        });

        it('treats an absent or unknown placement as the default', () => {
            editor.commands.setContent(PLAIN_TABLE);
            expect(getTableNode(editor.state).node.attrs.align).toBe('center');
            editor.commands.setContent('<table data-align="javascript:alert(1)"><tbody><tr><th>a</th></tr></tbody></table>');
            expect(getTableNode(editor.state).node.attrs.align).toBe('center');
            expect(editor.getHTML()).not.toContain('javascript');
        });
    });

    describe('resolveTableAlign / tableAlignMargins', () => {
        it('keeps a known placement and defaults everything else', () => {
            expect(resolveTableAlign('left')).toBe('left');
            expect(resolveTableAlign('center')).toBe('center');
            expect(resolveTableAlign('right')).toBe('right');
            for (const value of [undefined, null, '', 'justify', 'LEFT', 0, {}]) {
                expect(resolveTableAlign(value)).toBe('center');
            }
        });

        it('is flush on the side the table sits against, auto elsewhere', () => {
            expect(tableAlignMargins('left')).toEqual({ left: '0', right: 'auto' });
            expect(tableAlignMargins('center')).toEqual({ left: 'auto', right: 'auto' });
            expect(tableAlignMargins('right')).toEqual({ left: 'auto', right: '0' });
            expect(tableAlignMargins('nonsense')).toEqual({ left: 'auto', right: 'auto' });
        });
    });

    // The margins go on the <table>, not on TipTap's full-width .tableWrapper around it: on the
    // wrapper they did nothing, so a narrow table sat at the left whatever its placement.
    describe('placement in the mounted editor', () => {
        const mount = (options = {}) => {
            const el = document.createElement('div');
            document.body.appendChild(el);
            const live = createEditor({ element: el, ...options });
            return { el, live, done: () => { live.destroy(); el.remove(); } };
        };

        it('applies a chosen placement to the table element on doc change', () => {
            const { el, live, done } = mount();
            live.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
            setTableLayout(live, { align: 'right' });

            const table = el.querySelector('table');
            expect(table.style.marginLeft).toBe('auto');
            expect(table.style.marginRight).toBe('0px');
            expect(el.querySelector('.tableWrapper').style.marginLeft).toBe('');

            setTableLayout(live, { align: 'left' });
            expect(table.style.marginLeft).toBe('0px');
            expect(table.style.marginRight).toBe('auto');
            done();
        });

        it('centres an unplaced table', () => {
            const { el, live, done } = mount();
            live.commands.setContent(PLAIN_TABLE);
            const table = el.querySelector('table');
            expect(table.style.marginLeft).toBe('auto');
            expect(table.style.marginRight).toBe('auto');
            done();
        });

        it('places the tables of the document the editor was created with', () => {
            const { el, done } = mount({ content: '<table data-align="right"><tbody><tr><th>a</th></tr></tbody></table>' });
            const table = el.querySelector('table');
            expect(table.style.marginLeft).toBe('auto');
            expect(table.style.marginRight).toBe('0px');
            done();
        });

        it('keeps the placement when the columns are re-measured', () => {
            const { el, live, done } = mount({ content: '<table data-align="left"><tbody><tr><th>a</th><th>b</th></tr></tbody></table>' });
            live.commands.setTextSelection(4);
            live.commands.addColumnAfter();
            const table = el.querySelector('table');
            expect(table.style.marginLeft).toBe('0px');
            expect(table.style.marginRight).toBe('auto');
            done();
        });
    });
});
