import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { EditorContent } from '@tiptap/react';
import { createEditor } from '../../tests/helpers/createEditor.js';

// `katex` is an optional peer dependency: simulate a host that has not installed it.
vi.mock('katex', () => { throw new Error('Cannot find package katex'); });

let editor;
afterEach(() => { cleanup(); editor?.destroy(); editor = null; });

describe('Math without the optional katex package', () => {
    it('shows the formula source as text, never as markup', async () => {
        editor = createEditor({ content: '<p><span class="math-inline">&lt;b data-probe="x"&gt;probe&lt;/b&gt;</span></p>' });
        const { container } = render(<EditorContent editor={editor} />);
        await waitFor(() => {
            expect(container.querySelector('.math-render').className).toContain('text-red-500');
        }, { timeout: 10000 });
        const rendered = container.querySelector('.math-render');
        expect(container.querySelector('[data-probe]')).toBeNull();
        expect(rendered.textContent).toBe('<b data-probe="x">probe</b>');
        expect(rendered.getAttribute('title')).toBe('Math rendering requires the optional "katex" package to be installed.');
    });
});
