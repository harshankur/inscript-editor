// The table, image and video menus in the full editor: placement buttons named for what they
// place, and the table menu's column alignment.
import { act, fireEvent, screen, within } from '@testing-library/react';
import { CellSelection } from '@tiptap/pm/tables';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupFullEditor, stubClientWidth } from './harness.jsx';

// Every selection menu renders (TipTap would show one at a time): all their buttons are checked.
vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children, pluginKey }) => <div data-testid={`menu-${pluginKey}`}>{children}</div>,
    FloatingMenu: ({ children }) => <div>{children}</div>,
}));

let restoreWidth;
beforeEach(() => { restoreWidth = stubClientWidth(100000); });
afterEach(() => { restoreWidth(); vi.restoreAllMocks(); });

const setup = setupFullEditor;

describe('placement buttons say what they place', () => {
    it('the table, image and video menus place their object, and leave the text alignment names alone', async () => {
        await setup();
        const menus = {
            tableBubbleMenu: ['Place table left', 'Center table on the page', 'Place table right'],
            imageBubbleMenu: ['Place image left', 'Center image', 'Place image right'],
            youtubeBubbleMenu: ['Place video left', 'Center video', 'Place video right'],
        };
        for (const [key, titles] of Object.entries(menus)) {
            const menu = within(screen.getByTestId(`menu-${key}`));
            for (const title of titles) expect(menu.getByTitle(title).getAttribute('aria-label')).toBe(title);
            for (const textAlign of ['Align Left', 'Align Center', 'Align Right']) expect(menu.queryByTitle(textAlign)).toBeNull();
        }
    });

    it('the table menu aligns the column and shows the column\'s alignment as pressed', async () => {
        const { editor } = await setup();
        let pos = null;
        editor.state.doc.descendants((node, p) => { if (pos === null && node.isText && node.text === 'x') pos = p; });
        // The table menu shows for a cell selection: select the body cell.
        const cellPos = editor.state.doc.resolve(pos).before(-1);
        act(() => { editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cellPos))); });
        const menu = within(screen.getByTestId('menu-tableBubbleMenu'));
        expect(menu.getByTitle('Align column right').getAttribute('aria-pressed')).toBe('false');
        await act(async () => { fireEvent.click(menu.getByTitle('Align column right')); });
        expect(editor.getHTML()).toContain('<th style="text-align: right;">');
        expect(editor.getHTML()).toContain('<td style="text-align: right;">');
        expect(menu.getByTitle('Align column right').getAttribute('aria-pressed')).toBe('true');
        expect(menu.getByTitle('Place table right').getAttribute('aria-pressed')).toBe('false');
        await act(async () => { fireEvent.click(menu.getByTitle('Clear column alignment')); });
        expect(editor.getHTML()).not.toContain('text-align');
        expect(menu.getByTitle('Clear column alignment').hasAttribute('aria-pressed')).toBe(false);
    });

    it('the column buttons are off on an editor without this library\'s table extension', async () => {
        const { render } = await import('@testing-library/react');
        const { TableBubbleMenu } = await import('../../src/components/bubble-menus/TableBubbleMenu.jsx');
        const { Editor } = await import('@tiptap/core');
        const { default: StarterKit } = await import('@tiptap/starter-kit');
        const { Table, TableRow, TableCell, TableHeader } = await import('@tiptap/extension-table');
        const element = document.createElement('div');
        document.body.appendChild(element);
        const plain = new Editor({ element, extensions: [StarterKit, Table, TableRow, TableCell, TableHeader], content: '<table><tbody><tr><td><p>x</p></td></tr></tbody></table>' });
        try {
            const { container } = render(<TableBubbleMenu editor={plain} />);
            const menu = within(container);
            for (const title of ['Align column left', 'Center column', 'Align column right', 'Clear column alignment']) {
                expect(menu.getByTitle(title).disabled).toBe(true);
            }
        } finally { plain.destroy(); element.remove(); }
    });

    it('a placement written in another case still marks its button', async () => {
        const { render } = await import('@testing-library/react');
        const { PlacementButtons } = await import('../../src/components/bubble-menus/PlacementButtons.jsx');
        const { container } = render(<PlacementButtons value=" Left" onPlace={() => {}} titles={{ left: 'L', center: 'C', right: 'R' }} />);
        expect(within(container).getByTitle('L').getAttribute('aria-pressed')).toBe('true');
        expect(within(container).getByTitle('C').getAttribute('aria-pressed')).toBe('false');
    });
});
