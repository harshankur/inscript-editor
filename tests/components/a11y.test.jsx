// What a screen reader is told about the toolbar's and the selection menus' buttons: each has a
// name, a toggle says whether it is on (aria-pressed), and a button that opens a popover says
// whether it is open (aria-expanded) rather than claiming to be pressed.
import { act, fireEvent, screen, within } from '@testing-library/react';
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
const name = button => (button.getAttribute('aria-label') || button.textContent || '').trim();
const drawnActive = button => /shadow-inner|bg-\[var\(--inscript-color-active\)\]/.test(button.className);

describe('toolbar and selection menu buttons, for assistive technology', () => {
    it('every button has a name', async () => {
        const { container } = await setup();
        const unnamed = [...container.querySelectorAll('button')].filter(b => !name(b)).map(b => b.outerHTML.slice(0, 120));
        expect(unnamed).toEqual([]);
    });

    it('every icon-only button is named by the same text as its tooltip', async () => {
        const { container } = await setup();
        const mismatched = [...container.querySelectorAll('button[title]')]
            .filter(b => !b.textContent.trim() && b.getAttribute('aria-label') !== b.getAttribute('title'))
            .map(b => b.getAttribute('title'));
        expect(mismatched).toEqual([]);
    });

    it('every button drawn as on says so: pressed, or open for a popover', async () => {
        const { container, editor } = await setup();
        act(() => { editor.chain().toggleBold().setTextAlign('center').run(); });
        const silent = [...container.querySelectorAll('button')]
            .filter(b => drawnActive(b) && b.getAttribute('aria-pressed') !== 'true' && !b.hasAttribute('aria-haspopup'))
            .map(b => b.getAttribute('title') || name(b));
        expect(silent).toEqual([]);
    });

    it('Bold reports its state in the toolbar and in the selection menu', async () => {
        const { editor } = await setup();
        const bolds = () => screen.getAllByTitle('Bold');
        expect(bolds().length).toBe(2);
        expect(bolds().map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
        await act(async () => { fireEvent.click(bolds()[0]); });
        expect(editor.isActive('bold')).toBe(true);
        expect(bolds().map(b => b.getAttribute('aria-pressed'))).toEqual(['true', 'true']);
    });

    it('lists and the alignment control report their state', async () => {
        const { editor } = await setup();
        expect(screen.getByTitle('Bullet List').getAttribute('aria-pressed')).toBe('false');
        act(() => { editor.chain().toggleBulletList().setTextAlign('right').run(); });
        expect(screen.getByTitle('Bullet List').getAttribute('aria-pressed')).toBe('true');
        const primary = screen.getByTitle('Text Alignment').previousElementSibling.previousElementSibling;
        expect(primary.getAttribute('aria-label')).toBe('Align Right');
        expect(primary.getAttribute('aria-pressed')).toBe('true');
    });

    it('a button that opens a popover reports open or closed, not pressed', async () => {
        await setup();
        for (const title of ['Insert Link', 'Font Size', 'Text Color', 'Text Alignment', 'More tools']) {
            const trigger = screen.queryAllByTitle(title)[0];
            if (!trigger) continue; // More tools only shows when something overflows
            expect(trigger.hasAttribute('aria-pressed')).toBe(false);
            // A disclosure: open or closed, and no claim of a menu or dialog it does not have.
            expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
            expect(trigger.getAttribute('aria-expanded')).toBe('false');
            await act(async () => { fireEvent.click(trigger); });
            expect(screen.getAllByTitle(title)[0].getAttribute('aria-expanded')).toBe('true');
            expect(screen.queryByRole('dialog')).toBeNull();
            await act(async () => { fireEvent.click(screen.getAllByTitle(title)[0]); });
        }
    });

    it('a button that only does something is not a toggle, even when lit by the cursor', async () => {
        const { editor } = await setup();
        act(() => { editor.chain().insertContent({ type: 'mathBlock', attrs: { code: 'x' } }).run(); });
        let mathPos = null;
        editor.state.doc.descendants((node, pos) => { if (mathPos === null && node.type.name === 'mathBlock') mathPos = pos; });
        act(() => { editor.commands.setNodeSelection(mathPos); });
        expect(screen.getByTitle('Math Block').className).toMatch(/shadow-inner/);
        for (const title of ['Insert Table', 'Insert Image', 'Undo', 'Clear Formatting', 'Math Block', 'Mermaid Diagram']) {
            for (const button of screen.getAllByTitle(title)) expect(button.hasAttribute('aria-pressed')).toBe(false);
        }
    });

    it('the tags button opens the host\'s dialog: open or closed, not pressed', async () => {
        const { rerenderWith } = await setup();
        const tags = () => screen.getByTitle('Manage Tags & Categories');
        expect(tags().getAttribute('aria-haspopup')).toBe('dialog');
        expect(tags().getAttribute('aria-expanded')).toBe('false');
        expect(tags().hasAttribute('aria-pressed')).toBe(false);
        rerenderWith({ showMetadataActive: true });
        expect(tags().getAttribute('aria-expanded')).toBe('true');
    });

    it('the customize button opens a named dialog and says so', async () => {
        await setup();
        const gear = screen.getByTitle('Customize toolbar');
        expect(gear.getAttribute('aria-haspopup')).toBe('dialog');
        expect(gear.getAttribute('aria-expanded')).toBe('false');
        await act(async () => { fireEvent.click(gear); });
        const dialog = screen.getByRole('dialog', { name: 'Customize Layout' });
        expect(screen.getByTitle('Customize toolbar').getAttribute('aria-expanded')).toBe('true');
        // It takes focus, and gives it back to the button when it closes.
        expect(dialog.contains(document.activeElement)).toBe(true);
        vi.useFakeTimers();
        try {
            act(() => { fireEvent.click(within(dialog).getByTitle('Close')); });
            act(() => { vi.advanceTimersByTime(400); });
        } finally { vi.useRealTimers(); }
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(screen.getByTitle('Customize toolbar'));
    });

    it('Tab stays inside the customizer drawer', async () => {
        await setup();
        await act(async () => { fireEvent.click(screen.getByTitle('Customize toolbar')); });
        const dialog = screen.getByRole('dialog', { name: 'Customize Layout' });
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        const buttons = [...dialog.querySelectorAll('button')].filter(b => !b.disabled);
        buttons.at(-1).focus();
        fireEvent.keyDown(buttons.at(-1), { key: 'Tab' });
        expect(document.activeElement).toBe(buttons[0]);
        fireEvent.keyDown(buttons[0], { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(buttons.at(-1));
    });

    it('the drawer\'s Tab cycle skips a button taken out of the tab order', async () => {
        await setup();
        await act(async () => { fireEvent.click(screen.getByTitle('Customize toolbar')); });
        const dialog = screen.getByRole('dialog', { name: 'Customize Layout' });
        const buttons = [...dialog.querySelectorAll('button')].filter(b => !b.disabled);
        const skipped = document.createElement('button');
        skipped.tabIndex = -1;
        dialog.appendChild(skipped);
        buttons.at(-1).focus();
        fireEvent.keyDown(buttons.at(-1), { key: 'Tab' });
        expect(document.activeElement).toBe(buttons[0]);
        skipped.remove();
    });

    it('Tab from outside the open drawer goes into it', async () => {
        await setup();
        await act(async () => { fireEvent.click(screen.getByTitle('Customize toolbar')); });
        const dialog = screen.getByRole('dialog', { name: 'Customize Layout' });
        document.body.focus();
        screen.getByTitle('Bullet List').focus();
        fireEvent.keyDown(document.activeElement, { key: 'Tab' });
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('closing the drawer leaves focus where the reader moved it', async () => {
        const { editor } = await setup();
        await act(async () => { fireEvent.click(screen.getByTitle('Customize toolbar')); });
        const dialog = screen.getByRole('dialog', { name: 'Customize Layout' });
        vi.useFakeTimers();
        try {
            act(() => { fireEvent.click(within(dialog).getByTitle('Close')); });
            // The reader clicks into the document before the drawer has finished closing.
            act(() => { editor.view.dom.focus(); });
            act(() => { vi.advanceTimersByTime(400); });
        } finally { vi.useRealTimers(); }
        expect(document.activeElement).toBe(editor.view.dom);
    });

    it('in a code block, on an image or on a mixed selection no alignment is current', async () => {
        const { editor } = await setup();
        const primary = () => screen.getByTitle('Text Alignment').previousElementSibling.previousElementSibling;
        act(() => { editor.chain().setTextSelection(3).toggleCodeBlock().run(); });
        expect(primary().getAttribute('aria-pressed')).toBe('false');
        act(() => { editor.chain().toggleCodeBlock().insertContentAt(0, '<p style="text-align: center">mid</p>').run(); });
        act(() => { editor.commands.setTextSelection({ from: 2, to: 9 }); });
        expect(editor.state.doc.child(0).attrs.textAlign).toBe('center');
        expect(primary().getAttribute('aria-pressed')).toBe('false');
        let image = null;
        editor.state.doc.descendants((node, pos) => { if (image === null && node.type.name === 'image') image = pos; });
        act(() => { editor.commands.setNodeSelection(image); });
        expect(primary().getAttribute('aria-pressed')).toBe('false');
    });

    it('a drawer scoped to a host container leaves the rest of the page usable', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        await setup({ customizerContainer: host });
        await act(async () => { fireEvent.click(screen.getByTitle('Customize toolbar')); });
        const dialog = screen.getByRole('dialog', { name: 'Customize Layout' });
        expect(dialog.hasAttribute('aria-modal')).toBe(false);
        const outside = screen.getByTitle('Bullet List');
        outside.focus();
        expect(fireEvent.keyDown(outside, { key: 'Tab' })).toBe(true); // not cancelled: Tab goes on
        expect(document.activeElement).toBe(outside);
        host.remove();
    });

    it('without returnFocusRef, focus goes back to where it was when the drawer opened', async () => {
        const { ToolbarCustomizer } = await import('../../src/components/ToolbarCustomizer.jsx');
        const { render } = await import('@testing-library/react');
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        try {
            render(<ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={() => {}} />);
            expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
            fireEvent.keyDown(window, { key: 'Escape' });
            expect(document.activeElement).toBe(opener);
        } finally { opener.remove(); }
    });

    it('with nowhere to return focus, closing releases it rather than hiding it', async () => {
        const { ToolbarCustomizer } = await import('../../src/components/ToolbarCustomizer.jsx');
        const { render } = await import('@testing-library/react');
        document.body.focus();
        render(<ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={() => {}} />);
        const dialog = screen.getByRole('dialog');
        expect(dialog.contains(document.activeElement)).toBe(true);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(dialog.contains(document.activeElement)).toBe(false);
    });

    it('closing the drawer twice closes it once', async () => {
        const onClose = vi.fn();
        const { ToolbarCustomizer } = await import('../../src/components/ToolbarCustomizer.jsx');
        const { render } = await import('@testing-library/react');
        vi.useFakeTimers();
        try {
            render(<ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={onClose} />);
            fireEvent.keyDown(window, { key: 'Escape' });
            fireEvent.keyDown(window, { key: 'Escape' });
            act(() => { vi.advanceTimersByTime(400); });
        } finally { vi.useRealTimers(); }
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closing gives focus back before the drawer hides, and one unmounted while closing closes once', async () => {
        const { ToolbarCustomizer } = await import('../../src/components/ToolbarCustomizer.jsx');
        const { render } = await import('@testing-library/react');
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        const returnFocusRef = { current: opener };
        vi.useFakeTimers();
        try {
            const kept = render(<ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={() => {}} returnFocusRef={returnFocusRef} />);
            const dialog = screen.getByRole('dialog');
            expect(dialog.contains(document.activeElement)).toBe(true);
            fireEvent.keyDown(window, { key: 'Escape' });
            // Back on the opener at once: no focused element is ever inside the hidden drawer.
            expect(document.activeElement).toBe(opener);
            act(() => { vi.advanceTimersByTime(400); });
            kept.unmount();
            expect(document.activeElement).toBe(opener);

            const onClose = vi.fn();
            const closing = render(<ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={onClose} />);
            fireEvent.keyDown(window, { key: 'Escape' });
            closing.unmount();
            act(() => { vi.advanceTimersByTime(400); });
            expect(onClose).not.toHaveBeenCalled();
        } finally { vi.useRealTimers(); opener.remove(); }
    });

    it('a host closing the drawer after an async save sees one close, and no slide back', async () => {
        const { ToolbarCustomizer } = await import('../../src/components/ToolbarCustomizer.jsx');
        const { render } = await import('@testing-library/react');
        let finishSave;
        const onClose = vi.fn(() => new Promise(resolve => { finishSave = resolve; }));
        vi.useFakeTimers();
        try {
            render(<ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={onClose} />);
            const panel = screen.getByRole('dialog');
            fireEvent.keyDown(window, { key: 'Escape' });
            act(() => { vi.advanceTimersByTime(400); });
            // Still saving: the drawer stays out, and a second Escape does not close again.
            expect(panel.className).toMatch(/translate-x-full/);
            fireEvent.keyDown(window, { key: 'Escape' });
            act(() => { vi.advanceTimersByTime(400); });
            expect(onClose).toHaveBeenCalledTimes(1);
        } finally { vi.useRealTimers(); }
        await act(async () => { finishSave(); });
    });

    it('a drawer sliding out no longer holds Tab', async () => {
        const { ToolbarCustomizer } = await import('../../src/components/ToolbarCustomizer.jsx');
        const { render } = await import('@testing-library/react');
        const outside = document.createElement('button');
        document.body.appendChild(outside);
        vi.useFakeTimers();
        try {
            render(<ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={() => {}} />);
            fireEvent.keyDown(window, { key: 'Escape' });
            outside.focus();
            expect(fireEvent.keyDown(outside, { key: 'Tab' })).toBe(true); // not pulled back in
            expect(document.activeElement).toBe(outside);
        } finally { vi.useRealTimers(); outside.remove(); }
    });

    it('a drawer that has slid out lets clicks through, and a host dialog over it keeps its keys', async () => {
        const { ToolbarCustomizer } = await import('../../src/components/ToolbarCustomizer.jsx');
        const { render } = await import('@testing-library/react');
        const onClose = vi.fn();
        const { container } = render(<ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={onClose} />);
        // A host's own modal dialog, open over the drawer: Escape and Tab there are its own.
        const hostDialog = document.createElement('div');
        hostDialog.setAttribute('aria-modal', 'true');
        const hostButton = document.createElement('button');
        hostDialog.appendChild(hostButton);
        document.body.appendChild(hostDialog);
        hostButton.focus();
        expect(fireEvent.keyDown(hostButton, { key: 'Tab' })).toBe(true);
        expect(document.activeElement).toBe(hostButton);
        vi.useFakeTimers();
        try {
            fireEvent.keyDown(hostButton, { key: 'Escape' });
            act(() => { vi.advanceTimersByTime(400); });
            expect(onClose).not.toHaveBeenCalled();
            hostDialog.remove();
            fireEvent.keyDown(window, { key: 'Escape' });
            act(() => { vi.advanceTimersByTime(400); });
        } finally { vi.useRealTimers(); }
        expect(onClose).toHaveBeenCalledTimes(1);
        const backdrop = container.ownerDocument.querySelector('.inset-0.z-\\[80\\]');
        expect(backdrop.className).toMatch(/pointer-events-none/);
        expect(backdrop.getAttribute('aria-hidden')).toBe('true');
    });

    it('onClose runs once however often the drawer is closed, and it stays out', async () => {
        const onClose = vi.fn();
        const { ToolbarCustomizer } = await import('../../src/components/ToolbarCustomizer.jsx');
        const { render } = await import('@testing-library/react');
        vi.useFakeTimers();
        try {
            render(<ToolbarCustomizer currentConfig={['bold']} onSave={() => {}} onClose={onClose} />);
            const panel = screen.getByRole('dialog');
            fireEvent.keyDown(window, { key: 'Escape' });
            act(() => { vi.advanceTimersByTime(400); });
            fireEvent.keyDown(window, { key: 'Escape' });
            act(() => { vi.advanceTimersByTime(400); });
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(panel.className).toMatch(/translate-x-full/);
        } finally { vi.useRealTimers(); }
    });


    it('the alignment control reads a table column\'s alignment, and only the selected cells', async () => {
        const { editor } = await setup();
        const { CellSelection } = await import('@tiptap/pm/tables');
        const primary = () => screen.getByTitle('Text Alignment').previousElementSibling.previousElementSibling;
        act(() => { editor.commands.setContent('<table><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>'); });
        const cells = [];
        editor.state.doc.descendants((node, pos) => { if (node.type.spec.tableRole?.endsWith('cell')) cells.push(pos); });
        // Centre the first column from the table's command: the cells carry it, not the paragraphs.
        act(() => { editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cells[0], cells[2]))); });
        act(() => { editor.commands.setColumnAlign('center'); });
        act(() => { editor.commands.setTextSelection(cells[2] + 2); });
        expect(primary().getAttribute('aria-label')).toBe('Align Center');
        expect(primary().getAttribute('aria-pressed')).toBe('true');
        // Text in a list inside an aligned cell takes the cell's alignment too.
        act(() => { editor.commands.setContent('<table><tbody><tr><th style="text-align: right"><ul><li><p>item</p></li></ul></th></tr><tr><td><p>x</p></td></tr></tbody></table>'); });
        act(() => { editor.commands.setTextSelection(5); });
        expect(editor.state.selection.$from.parent.textContent).toBe('item');
        expect(primary().getAttribute('aria-label')).toBe('Align Right');
        act(() => { editor.commands.setContent('<table><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>'); });
        cells.length = 0;
        editor.state.doc.descendants((node, pos) => { if (node.type.spec.tableRole?.endsWith('cell')) cells.push(pos); });
        act(() => { editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cells[0], cells[2]))); });
        act(() => { editor.commands.setColumnAlign('center'); });
        // Selecting that column's cells reads them alone, not the second column's cell in between.
        act(() => { editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cells[0], cells[2]))); });
        expect(primary().getAttribute('aria-label')).toBe('Align Center');
    });

    it('a link or colour applied is in the popover button\'s name', async () => {
        const { editor } = await setup();
        expect(screen.getAllByTitle('Insert Link')[0].getAttribute('aria-label')).toBe('Insert Link');
        act(() => { editor.chain().setTextSelection({ from: 1, to: 6 }).setLink({ href: 'https://example.com' }).setColor('#dc2626').run(); });
        expect(screen.getAllByTitle('Edit Link')[0].getAttribute('aria-label')).toBe('Edit Link');
        expect(screen.queryAllByTitle('Insert Link')).toHaveLength(0);
        expect(screen.getAllByTitle('Text Color')[0].getAttribute('aria-label')).toBe('Text Color: #dc2626');
        // The popover it opens says the same.
        await act(async () => { fireEvent.click(screen.getAllByTitle('Edit Link')[0]); });
        expect(screen.getAllByText('Edit Link').length).toBeGreaterThan(0);
        expect(screen.queryByText('Insert Link')).toBeNull();
    });

    it('in a dropdown\'s list the current choice is aria-current; its main button shows it pressed', async () => {
        const { editor } = await setup();
        act(() => { editor.chain().setTextSelection(3).setAdmonition('note').run(); });
        const primary = screen.getByTitle('Admonitions').previousElementSibling.previousElementSibling;
        expect(primary.getAttribute('aria-label')).toBe('Note');
        expect(primary.getAttribute('aria-pressed')).toBe('true');
        await act(async () => { fireEvent.click(screen.getByTitle('Admonitions')); });
        const choices = within(screen.getByRole('group', { name: 'Admonitions' }));
        const note = choices.getByRole('button', { name: 'Note' });
        expect(note.hasAttribute('aria-pressed')).toBe(false);
        expect(note.getAttribute('aria-current')).toBe('true');
        expect(choices.getByRole('button', { name: 'Tip' }).hasAttribute('aria-current')).toBe(false);
    });

    it('a selected citation reads the alignment of its paragraph, and a selection touching the next one does not count it', async () => {
        const { editor } = await setup();
        const primary = () => screen.getByTitle('Text Alignment').previousElementSibling.previousElementSibling;
        act(() => { editor.commands.setContent('<p style="text-align: center">See <span class="citation" data-key="k" data-label="K">[K]</span> here</p><p>next</p>'); });
        let citation = null;
        editor.state.doc.descendants((node, pos) => { if (citation === null && node.type.name === 'citation') citation = pos; });
        act(() => { editor.commands.setNodeSelection(citation); });
        expect(primary().getAttribute('aria-label')).toBe('Align Center');
        expect(primary().getAttribute('aria-pressed')).toBe('true');
        // From inside the first paragraph to the very start of the second: only the first is selected.
        const secondStart = editor.state.doc.child(0).nodeSize + 1;
        act(() => { editor.commands.setTextSelection({ from: 2, to: secondStart }); });
        expect(primary().getAttribute('aria-label')).toBe('Align Center');
    });

    it('a selected quote reads the alignment of the paragraphs in it', async () => {
        const { editor } = await setup();
        const { NodeSelection } = await import('@tiptap/pm/state');
        act(() => { editor.commands.setContent('<blockquote><p style="text-align: center">a</p><p style="text-align: center">b</p></blockquote>'); });
        act(() => { editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0))); });
        const primary = screen.getByTitle('Text Alignment').previousElementSibling.previousElementSibling;
        expect(primary.getAttribute('aria-label')).toBe('Align Center');
        expect(primary.getAttribute('aria-pressed')).toBe('true');
    });

    it('a ToolbarButton showing text is named by that text, its title a description', async () => {
        const { ToolbarButton } = await import('../../src/components/ToolbarButton.jsx');
        const { render } = await import('@testing-library/react');
        render(<><ToolbarButton title="Insert a reusable snippet">Snippets</ToolbarButton><ToolbarButton title="Bold" active={false}><svg /></ToolbarButton></>);
        expect(screen.getByRole('button', { name: 'Snippets' }).hasAttribute('aria-label')).toBe(false);
        expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-label')).toBe('Bold');
    });

    it('a selection holding an image as well reports no alignment', async () => {
        const { editor } = await setup();
        act(() => { editor.commands.setContent('<p style="text-align: center">mid</p><img src="https://example.com/a.png"><p>after</p>'); });
        act(() => { editor.commands.setTextSelection({ from: 2, to: editor.state.doc.content.size - 2 }); });
        const primary = screen.getByTitle('Text Alignment').previousElementSibling.previousElementSibling;
        expect(primary.getAttribute('aria-pressed')).toBe('false');
    });

    it('text with no alignment of its own shows Align Left as the current choice', async () => {
        await setup();
        const primary = screen.getByTitle('Text Alignment').previousElementSibling.previousElementSibling;
        expect(primary.getAttribute('aria-label')).toBe('Align Left');
        expect(primary.getAttribute('aria-pressed')).toBe('true');
    });

    it('with the host\'s abbreviation handler, Abbreviation is no toggle', async () => {
        const { editor } = await setup({ onAddAbbreviation: () => {} });
        act(() => { editor.chain().setTextSelection({ from: 1, to: 6 }).setAbbreviation('x').run(); });
        for (const button of screen.getAllByTitle('Abbreviation')) {
            expect(button.className).toMatch(/inscript-color-active/);
            expect(button.hasAttribute('aria-pressed')).toBe(false);
        }
    });

    it('the font size button\'s name includes the size it shows', async () => {
        const { editor } = await setup();
        act(() => { editor.chain().setFontSize('24px').run(); });
        const button = screen.getAllByTitle('Font Size')[0];
        expect(button.textContent).toContain('24');
        expect(button.getAttribute('aria-label')).toContain(button.textContent.trim());
    });
});
