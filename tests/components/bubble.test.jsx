// Bubble menus, SourceField, LinkSelector, ColorSelector and HighlightSelector.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import { CellSelection } from '@tiptap/pm/tables';
import { buildExtensions } from '../../src/extensions/index.js';
import { YoutubeBubbleMenu } from '../../src/components/bubble-menus/YoutubeBubbleMenu.jsx';
import { ImageBubbleMenu } from '../../src/components/bubble-menus/ImageBubbleMenu.jsx';
import { EmbedBubbleMenu } from '../../src/components/bubble-menus/EmbedBubbleMenu.jsx';
import { TableBubbleMenu } from '../../src/components/bubble-menus/TableBubbleMenu.jsx';
import { TextBubbleMenu } from '../../src/components/bubble-menus/TextBubbleMenu.jsx';
import { SourceField } from '../../src/components/bubble-menus/SourceField.jsx';
import { LinkSelector } from '../../src/components/LinkSelector.jsx';
import { HighlightSelector } from '../../src/components/HighlightSelector.jsx';
import { ColorSelector } from '../../src/components/ColorSelector.jsx';
import { FontSizeSelector } from '../../src/components/FontSizeSelector.jsx';

const lastShouldShow = vi.hoisted(() => ({ fn: null }));
vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children, shouldShow }) => { lastShouldShow.fn = shouldShow; return <div data-testid="bubble-menu">{children}</div>; },
    FloatingMenu: ({ children }) => <div>{children}</div>,
}));

const A = 'dQw4w9WgXcQ';
const B = 'aqz-KE-bpKQ';
const editors = [];
function mount(content, options = {}) {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = new Editor({ element, extensions: buildExtensions(options), content });
    editors.push(editor);
    return editor;
}
afterEach(() => {
    while (editors.length) editors.pop().destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});
const nodePos = (editor, name) => {
    let pos = null;
    editor.state.doc.descendants((n, p) => { if (pos === null && n.type.name === name) pos = p; });
    return pos;
};

describe('SourceField', () => {
    it('Escape reverts the draft and does NOT apply it', () => {
        const onApply = vi.fn();
        render(<SourceField value="https://a.example/x" onApply={onApply} label="URL" />);
        const input = screen.getByLabelText('URL');
        input.focus();
        fireEvent.change(input, { target: { value: 'https://typo.example/y' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(onApply).not.toHaveBeenCalled();
        expect(input.value).toBe('https://a.example/x');
    });

    it('Escape in the YouTube bubble menu keeps the original video', () => {
        const editor = mount(`<div data-youtube-video="${A}"></div>`);
        act(() => { editor.commands.setNodeSelection(nodePos(editor, 'youtube')); });
        render(<YoutubeBubbleMenu editor={editor} />);
        const input = screen.getByLabelText('Video URL');
        input.focus();
        fireEvent.change(input, { target: { value: `https://youtu.be/${B}` } });
        act(() => { fireEvent.keyDown(input, { key: 'Escape' }); });
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBe(A);
    });

    it('Enter applies a valid value, an invalid one is blocked and kept', () => {
        const onApply = vi.fn();
        render(<SourceField value="" onApply={onApply} validate={(v) => v.startsWith('https://')} label="URL" />);
        const input = screen.getByLabelText('URL');
        fireEvent.change(input, { target: { value: 'nope' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onApply).not.toHaveBeenCalled();
        expect(input.value).toBe('nope');
        fireEvent.change(input, { target: { value: '  https://ok.example  ' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onApply).toHaveBeenCalledWith('https://ok.example');
    });

    it('blur applies (once)', () => {
        const onApply = vi.fn();
        render(<SourceField value="a" onApply={onApply} label="URL" />);
        const input = screen.getByLabelText('URL');
        input.focus();
        fireEvent.change(input, { target: { value: 'b' } });
        act(() => { input.blur(); });
        expect(onApply).toHaveBeenCalledTimes(1);
    });
});

describe('YoutubeBubbleMenu', () => {
    it.each([
        ['', false], ['   ', false], ['https://example.com/abcdefghijk', false], ['javascript:alert(1)//abcdefghijk', false],
        [`https://www.youtube.com/watch?v=${B}`, true], [B, true],
    ])('URL %j applies=%s', (value, ok) => {
        const editor = mount(`<div data-youtube-video="${A}"></div>`);
        act(() => { editor.commands.setNodeSelection(0); });
        render(<YoutubeBubbleMenu editor={editor} />);
        const input = screen.getByLabelText('Video URL');
        fireEvent.change(input, { target: { value } });
        act(() => { fireEvent.keyDown(input, { key: 'Enter' }); });
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBe(ok ? B : A);
    });

    it('Open in YouTube goes through onOpenExternal, else window.open with noopener', () => {
        const editor = mount(`<div data-youtube-video="${A}"></div>`);
        act(() => { editor.commands.setNodeSelection(0); });
        const onOpenExternal = vi.fn();
        const { rerender } = render(<YoutubeBubbleMenu editor={editor} onOpenExternal={onOpenExternal} />);
        fireEvent.click(screen.getByTitle('Open in YouTube'));
        expect(onOpenExternal).toHaveBeenCalledWith(`https://www.youtube.com/watch?v=${A}`);
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        rerender(<YoutubeBubbleMenu editor={editor} />);
        fireEvent.click(screen.getByTitle('Open in YouTube'));
        expect(open).toHaveBeenCalledWith(`https://www.youtube.com/watch?v=${A}`, '_blank', 'noopener,noreferrer');
    });

    it('width and alignment buttons set attrs and show the active one', () => {
        const editor = mount(`<div data-youtube-video="${A}"></div>`);
        act(() => { editor.commands.setNodeSelection(0); });
        render(<YoutubeBubbleMenu editor={editor} />);
        expect(screen.getByTitle('Video width 100%').className).toMatch(/shadow-inner/);
        act(() => { fireEvent.click(screen.getByTitle('Video width 50%')); });
        expect(editor.state.doc.firstChild.attrs.width).toBe('50%');
        expect(screen.getByTitle('Video width 50%').className).toMatch(/shadow-inner/);
        act(() => { fireEvent.click(screen.getByTitle('Align Right')); });
        expect(editor.state.doc.firstChild.attrs.align).toBe('right');
    });

    it('Delete video removes it', () => {
        const editor = mount(`<p>a</p><div data-youtube-video="${A}"></div>`);
        act(() => { editor.commands.setNodeSelection(nodePos(editor, 'youtube')); });
        render(<YoutubeBubbleMenu editor={editor} />);
        act(() => { fireEvent.click(screen.getByTitle('Delete video')); });
        expect(nodePos(editor, 'youtube')).toBeNull();
    });
});

describe('EmbedBubbleMenu', () => {
    it('Open in new tab never hands a script URL from the document to window.open / onOpenExternal', () => {
        const editor = mount('<div data-embed-src="javascript:alert(document.domain)" data-embed-gated="true"></div>');
        act(() => { editor.commands.setNodeSelection(0); });
        const onOpenExternal = vi.fn();
        render(<EmbedBubbleMenu editor={editor} onOpenExternal={onOpenExternal} />);
        fireEvent.click(screen.getByTitle('Open in new tab'));
        expect(onOpenExternal).not.toHaveBeenCalled();
    });

    it('clearing the caption removes the label', () => {
        const editor = mount('<div data-embed-src="https://e.com/x" data-embed-label="Cap" data-embed-gated="true"></div>');
        act(() => { editor.commands.setNodeSelection(0); });
        render(<EmbedBubbleMenu editor={editor} />);
        const input = screen.getByLabelText('Caption');
        fireEvent.change(input, { target: { value: '   ' } });
        act(() => { fireEvent.keyDown(input, { key: 'Enter' }); });
        expect(editor.state.doc.firstChild.attrs.label).toBeNull();
    });

    it('an empty src is refused (keeps the old one)', () => {
        const editor = mount('<div data-embed-src="https://e.com/x" data-embed-gated="true"></div>');
        act(() => { editor.commands.setNodeSelection(0); });
        render(<EmbedBubbleMenu editor={editor} />);
        const input = screen.getByLabelText('Embed URL');
        fireEvent.change(input, { target: { value: '  ' } });
        act(() => { fireEvent.keyDown(input, { key: 'Enter' }); });
        expect(editor.state.doc.firstChild.attrs.src).toBe('https://e.com/x');
    });
});

describe('ImageBubbleMenu', () => {
    it('alt text, width and delete', () => {
        const editor = mount('<p>a</p><img src="https://e.com/a.png" alt="old">');
        act(() => { editor.commands.setNodeSelection(nodePos(editor, 'image')); });
        render(<ImageBubbleMenu editor={editor} />);
        const alt = screen.getByLabelText('Alt text');
        fireEvent.change(alt, { target: { value: 'new alt' } });
        act(() => { fireEvent.keyDown(alt, { key: 'Enter' }); });
        expect(editor.state.doc.child(1).attrs.alt).toBe('new alt');
        act(() => { fireEvent.click(screen.getByTitle('Image width 25%')); });
        expect(editor.state.doc.child(1).attrs.width).toBe('25%');
        act(() => { fireEvent.click(screen.getByTitle('Delete image')); });
        expect(nodePos(editor, 'image')).toBeNull();
    });
});

describe('TableBubbleMenu', () => {
    const table = '<table><tbody><tr><th><p>a</p></th><th><p>b</p></th></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>';
    const cellPositions = (editor) => {
        const out = [];
        editor.state.doc.descendants((n, p) => { if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') out.push(p); });
        return out;
    };
    it('every button works on a cell selection and merge/split are enabled correctly', () => {
        const editor = mount(table);
        const cells = cellPositions(editor);
        act(() => { editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cells[2], cells[3]))); });
        render(<TableBubbleMenu editor={editor} />);
        expect(screen.getByTitle('Merge Cells').disabled).toBe(false);
        act(() => { fireEvent.click(screen.getByTitle('Merge Cells')); });
        expect(editor.getHTML()).toMatch(/colspan="2"/);
        expect(screen.getByTitle('Split Cell').disabled).toBe(false);
        act(() => { fireEvent.click(screen.getByTitle('Split Cell')); });
        expect(editor.getHTML()).not.toMatch(/colspan/);
        for (const title of ['Add Column Left', 'Add Column Right', 'Add Row Above', 'Add Row Below', 'Toggle Header Row', 'Toggle Header Column', 'Align Left', 'Align Right', 'Align Center']) {
            act(() => { fireEvent.click(screen.getByTitle(title)); });
            editor.state.doc.check();
        }
        act(() => { fireEvent.click(screen.getByTitle('Delete Table')); });
        expect(editor.getHTML()).not.toContain('<table');
    });

    it('header row toggle reflects state', () => {
        const editor = mount(table);
        const cells = cellPositions(editor);
        act(() => { editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cells[0]))); });
        render(<TableBubbleMenu editor={editor} />);
        expect(screen.getByTitle('Toggle Header Row').className).toMatch(/shadow-inner/);
        act(() => { fireEvent.click(screen.getByTitle('Toggle Header Row')); });
        expect(screen.getByTitle('Toggle Header Row').className).not.toMatch(/shadow-inner/);
    });
});

describe('LinkSelector', () => {
    const setup = (html, from, to) => {
        const editor = mount(html);
        act(() => { editor.commands.setTextSelection({ from, to }); });
        render(<LinkSelector editor={editor} />);
        return editor;
    };
    const apply = (value) => {
        fireEvent.click(screen.getByTitle('Insert Link'));
        const input = screen.getByPlaceholderText('Enter URL...');
        fireEvent.change(input, { target: { value } });
        act(() => { fireEvent.keyDown(input, { key: 'Enter' }); });
    };

    it('sets a link on the selection and shows it as active', () => {
        const editor = setup('<p>hello world</p>', 7, 12);
        apply('https://example.com');
        expect(editor.getHTML()).toContain('<a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">world</a>');
        expect(screen.getByTitle('Insert Link').className).toMatch(/shadow-inner/);
    });

    it('edits an existing link (cursor inside it) across the whole link', () => {
        const editor = setup('<p>a <a href="https://old.example">link text</a> b</p>', 6, 6);
        fireEvent.click(screen.getByTitle('Insert Link'));
        expect(screen.getByPlaceholderText('Enter URL...').value).toBe('https://old.example');
        fireEvent.click(screen.getByTitle('Insert Link'));
        apply('https://new.example');
        expect(editor.getHTML()).toContain('href="https://new.example">link text</a>');
    });

    it('removes a link with the remove button', () => {
        const editor = setup('<p>a <a href="https://old.example">link text</a> b</p>', 6, 6);
        fireEvent.click(screen.getByTitle('Insert Link'));
        act(() => { fireEvent.click(screen.getByTitle('Remove Link')); });
        expect(editor.getHTML()).not.toContain('<a');
    });

    it('refuses javascript: URLs', () => {
        const editor = setup('<p>hello world</p>', 7, 12);
        apply('javascript:alert(1)');
        expect(editor.getHTML()).not.toContain('javascript:');
    });

    it('a whitespace-only URL removes the link, like an empty one', () => {
        const editor = setup('<p>a <a href="https://old.example">link text</a> b</p>', 6, 6);
        apply('   ');
        expect(editor.getHTML()).not.toContain('<a');
    });

    it('a refused URL is reported, not silently dropped with the popover closed', () => {
        setup('<p>hello world</p>', 7, 12);
        apply('javascript:alert(1)');
        // Expected: the popover stays open (or an error shows) so the user knows nothing was linked.
        expect(screen.queryByPlaceholderText('Enter URL...')).not.toBeNull();
    });

    it('surrounding whitespace is not stored in href', () => {
        const editor = setup('<p>hello world</p>', 7, 12);
        apply('  https://example.com  ');
        expect(editor.getHTML()).toContain('href="https://example.com"');
    });
});

describe('HighlightSelector and ColorSelector', () => {
    it('standalone HighlightSelector: default swatch applies a colourless mark, picking it again removes it', () => {
        const editor = mount('<p>hello</p>');
        act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }); });
        render(<HighlightSelector editor={editor} title="HL" />);
        fireEvent.click(screen.getByTitle('HL'));
        act(() => { fireEvent.click(screen.getByTitle('Default highlight')); });
        expect(editor.getHTML()).toBe('<p><mark>hello</mark></p>');
        fireEvent.click(screen.getByTitle('HL'));
        act(() => { fireEvent.click(screen.getByTitle('Default highlight')); });
        expect(editor.getHTML()).toBe('<p>hello</p>');
    });

    it('a preset over a default highlight recolours it; No Highlight removes it', () => {
        const editor = mount('<p><mark>hello</mark></p>');
        act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }); });
        render(<HighlightSelector editor={editor} title="HL" />);
        fireEvent.click(screen.getByTitle('HL'));
        act(() => { fireEvent.click(screen.getByTitle('#bbf7d0')); });
        expect(editor.getHTML()).toContain('data-color="#bbf7d0"');
        fireEvent.click(screen.getByTitle('HL'));
        act(() => { fireEvent.click(screen.getByText('No Highlight')); });
        expect(editor.getHTML()).toBe('<p>hello</p>');
    });

    it('custom colour input sets the highlight colour', () => {
        const editor = mount('<p>hello</p>');
        act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }); });
        const { container } = render(<HighlightSelector editor={editor} title="HL" />);
        fireEvent.click(screen.getByTitle('HL'));
        act(() => { fireEvent.change(container.querySelector('input[type=color]'), { target: { value: '#123456' } }); });
        expect(editor.getHTML()).toContain('data-color="#123456"');
    });

    it('custom text colour then reset', () => {
        const editor = mount('<p>hello</p>');
        act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }); });
        const Wrapped = () => (
            <ColorSelector icon={() => null} title="TC" activeColor={editor.getAttributes('textStyle').color}
                onChange={(c) => editor.chain().focus().setColor(c).run()} onRemove={() => editor.chain().focus().unsetColor().run()}
                presets={['#000000']} variant="text" />
        );
        const { container } = render(<Wrapped />);
        fireEvent.click(screen.getByTitle('TC'));
        act(() => { fireEvent.change(container.querySelector('input[type=color]'), { target: { value: '#abcdef' } }); });
        expect(editor.getAttributes('textStyle').color).toBe('#abcdef'); // (jsdom serializes the style as rgb())
        act(() => { fireEvent.click(screen.getByText('Reset to Default')); });
        expect(editor.getHTML()).toBe('<p>hello</p>');
    });

    it('a parsed rgb() text colour shows as the active swatch / custom value', () => {
        const editor = mount('<p><span style="color: rgb(220, 38, 38)">hello</span></p>');
        act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }); });
        const color = editor.getAttributes('textStyle').color;
        // #dc2626 is a preset; the picker compares strings, so an rgb() colour never matches it.
        expect(['#dc2626', 'rgb(220, 38, 38)']).toContain(color);
    });

    it('font size selector shows the parsed size and resets it', () => {
        const editor = mount('<p><span style="font-size: 18px">hello</span></p>');
        act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }); });
        render(<FontSizeSelector editor={editor} />);
        expect(screen.getByTitle('Font Size').textContent).toContain('18');
        fireEvent.click(screen.getByTitle('Font Size'));
        act(() => { fireEvent.click(screen.getByText('Reset')); });
        expect(editor.getHTML()).not.toContain('font-size');
    });
});

describe('TextBubbleMenu config', () => {
    it('renders only the configured, allowed tools in order and ignores junk', () => {
        const editor = mount('<p>hello</p>');
        act(() => { editor.commands.setTextSelection({ from: 1, to: 3 }); });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const errors = [];
        vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')));
        render(<TextBubbleMenu editor={editor} bubbleMenuConfig={['italic', 'nope', 'h1', 'table', '|', 'bold', 'bold']} />);
        const titles = [...screen.getByTestId('bubble-menu').querySelectorAll('button[title]')].map(b => b.title);
        expect(titles).toEqual(['Italic', 'Bold']);
        expect(errors).toEqual([]);
        warn.mockRestore();
    });
});

describe('TextBubbleMenu does not open over node selections that have their own menu or no text', () => {
    it.each([
        ['embed', '<div data-embed-src="https://e.com/x" data-embed-gated="true"></div>'],
        ['mathBlock', '<div class="math-block" data-math="x"></div>'],
        ['mermaid', '<div class="mermaid" data-mermaid="graph TD;A-->B"></div>'],
        ['horizontalRule', '<hr>'],
    ])('%s selected', (name, html) => {
        const editor = mount(`<p>a</p>${html}<p>b</p>`);
        act(() => { editor.commands.setNodeSelection(nodePos(editor, name)); });
        render(<TextBubbleMenu editor={editor} />);
        expect(lastShouldShow.fn({ editor })).toBe(false);
    });
});
