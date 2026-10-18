import { describe, it, expect, afterEach } from 'vitest';
import { render, waitFor, cleanup, act } from '@testing-library/react';
import { EditorContent } from '@tiptap/react';
import { createEditor } from '../../tests/helpers/createEditor.js';

// An inert probe: if it shows up as an element, the formula's source was parsed as HTML.
const PROBE = '<b data-probe="math">probe</b>';
const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Deep enough that KaTeX throws a RangeError, which `throwOnError: false` does not catch.
const DEEP_NESTING = 1500;

let editor;
afterEach(() => { cleanup(); editor?.destroy(); editor = null; });

function mount(html, options) {
    editor = createEditor({ content: html, ...options });
    return render(<EditorContent editor={editor} />).container;
}

const nodePos = (name) => {
    let pos = null;
    editor.state.doc.descendants((n, p) => { if (pos === null && n.type.name === name) pos = p; });
    return pos;
};

describe('Math node view', () => {
    it('shows the source as text when KaTeX throws while rendering a block', async () => {
        const code = '\\sqrt{'.repeat(DEEP_NESTING) + PROBE + '}'.repeat(DEEP_NESTING);
        const container = mount(`<div class="math-block">${escapeHtml(code)}</div>`);
        await waitFor(() => {
            expect(container.querySelector('.math-render').className).toContain('text-red-500');
        }, { timeout: 20000 });
        expect(container.querySelector('[data-probe]')).toBeNull();
        expect(container.querySelector('.math-render').textContent).toBe(code);
    });

    it('shows the source as text when KaTeX throws while rendering an inline formula', async () => {
        const code = '\\sqrt{'.repeat(DEEP_NESTING) + PROBE + '}'.repeat(DEEP_NESTING);
        const container = mount(`<p>x <span class="math-inline">${escapeHtml(code)}</span></p>`);
        await waitFor(() => {
            expect(container.querySelector('.math-render').className).toContain('text-red-500');
        }, { timeout: 20000 });
        expect(container.querySelector('[data-probe]')).toBeNull();
    });

    it('renders an ordinary formula with KaTeX', async () => {
        const container = mount('<div class="math-block" data-math="x^2"></div>');
        await waitFor(() => expect(container.querySelector('.math-render .katex')).not.toBeNull(), { timeout: 20000 });
    });

    it('offers the source editor for a selected formula in an editable editor', async () => {
        const container = mount('<div class="math-block" data-math="x^2"></div>');
        await act(async () => { editor.commands.setNodeSelection(nodePos('mathBlock')); });
        expect(container.querySelector('.math-node-wrapper input')).not.toBeNull();
    });

    it('offers no source editor in a read-only editor, even when the formula is selected', async () => {
        const container = mount('<div class="math-block" data-math="x^2"></div>', { editable: false });
        await act(async () => { editor.commands.setNodeSelection(nodePos('mathBlock')); });
        expect(container.querySelector('.math-node-wrapper input')).toBeNull();
    });
});

describe('Math parse', () => {
    it('prefers data-math over the text content, keeping line breaks and backslashes', () => {
        // What a Markdown round trip hands back: the text content collapsed and unescaped,
        // the attribute exact.
        editor = createEditor({ content: '<div class="math-block" data-math="a + b % note&#10;+ c">a + b % note + c</div>' });
        expect(editor.state.doc.firstChild.attrs.code).toBe('a + b % note\n+ c');
        editor.commands.setContent('<p><span class="math-inline" data-math="\\{x \\mid x > 0\\}">{x \\mid x &gt; 0}</span></p>');
        expect(editor.state.doc.firstChild.firstChild.attrs.code).toBe('\\{x \\mid x > 0\\}');
    });

    it('falls back to the text content when data-math is absent or empty', () => {
        editor = createEditor({ content: '<div class="math-block">$$x^2$$</div>' });
        expect(editor.state.doc.firstChild.attrs.code).toBe('x^2');
        editor.commands.setContent('<p><span class="math-inline" data-math="">$y$</span></p>');
        expect(editor.state.doc.firstChild.firstChild.attrs.code).toBe('y');
    });
});
