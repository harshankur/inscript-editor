import { beforeEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { getTableNode, setTableLayout } from '../utils/tableHelpers.js';

describe('CustomTable extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
    });

    it('defaults align to center', () => {
        editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
        expect(getTableNode(editor.state).node.attrs.align).toBe('center');
    });

    it('the margin plugin applies inline margins to the mounted table wrapper on doc change', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const liveEditor = createEditor({ element: el });
        liveEditor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
        setTableLayout(liveEditor, { align: 'right' });

        // The plugin sets margins on whatever nodeDOM(pos) returns for the table node —
        // with resizable:true that's the tableWrapper div TipTap's TableView renders, not <table> itself.
        const wrapper = el.querySelector('.tableWrapper') || el.querySelector('table');
        expect(wrapper.style.marginLeft).toBe('auto');
        expect(wrapper.style.marginRight).toBe('0px');

        liveEditor.destroy();
        el.remove();
    });
});
