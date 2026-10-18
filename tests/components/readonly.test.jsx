// Read-only mode: nothing reachable from the UI may change the document.
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHost, flush, stubClientWidth } from './harness.jsx';

vi.mock('@tiptap/react/menus', () => ({ BubbleMenu: () => null, FloatingMenu: () => null }));
afterEach(() => { vi.restoreAllMocks(); });

const nodePos = (editor, name) => {
    let pos = null;
    editor.state.doc.descendants((n, p) => { if (pos === null && n.type.name === name) pos = p; });
    return pos;
};

describe('read-only editor', () => {
    // A click on an atom selects it even when the view is not editable (ProseMirror's mousedown
    // is not an edit handler; selectClickedLeaf has no editable check). The selection is set
    // directly here because jsdom has no layout for posAtCoords.
    it.each([
        ['mathBlock', '<div class="math-block" data-math="x^2"></div>', 'input'],
        ['mermaid', '<div class="mermaid" data-mermaid="graph TD;A-->B"></div>', 'textarea'],
    ])('a selected %s offers no source editor and cannot be changed', async (name, html, field) => {
        const { container, api } = renderHost({ initialContent: html, isReadonly: true }, { isReadonly: true });
        await flush();
        const editor = api.current.editor;
        expect(editor.isEditable).toBe(false);
        const before = editor.getHTML();
        await act(async () => { editor.commands.setNodeSelection(nodePos(editor, name)); });
        await flush();
        const input = container.querySelector(`.ProseMirror ${field}`);
        if (input) fireEvent.change(input, { target: { value: 'HACKED' } });
        expect(editor.getHTML()).toBe(before);
    });

    it('a task checkbox cannot be toggled', async () => {
        const { container, api } = renderHost({ initialContent: '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>t</p></li></ul>', isReadonly: true }, { isReadonly: true });
        await flush();
        const before = api.current.editor.getHTML();
        const box = container.querySelector('.ProseMirror input[type=checkbox]');
        fireEvent.click(box);
        expect(api.current.editor.getHTML()).toBe(before);
    });

    it('spreading a read-only hook result into <InscriptEditor> gives no editing toolbar', async () => {
        const restore = stubClientWidth(100000);
        const { api } = renderHost({ initialContent: '<p>hello</p>', isReadonly: true });
        await flush();
        const editor = api.current.editor;
        const before = editor.getHTML();
        act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }); });
        const bold = screen.queryByTitle('Bold');
        if (bold) await act(async () => { fireEvent.click(bold); });
        restore();
        expect(editor.getHTML()).toBe(before);
    });

    it('the YouTube consent button and the embed Load button still work (viewing, not editing)', async () => {
        const { container } = renderHost({
            initialContent: '<div data-youtube-video="dQw4w9WgXcQ"></div><div data-embed-src="https://e.com/x" data-embed-gated="true"></div>',
            isReadonly: true,
            editorOptions: { youtube: { facade: 'local' } },
        }, { isReadonly: true });
        await flush();
        fireEvent.click(container.querySelector('[data-youtube-consent] button'));
        const load = [...container.querySelectorAll('.ProseMirror button')].find(b => /Load embedded/.test(b.textContent));
        await act(async () => { fireEvent.click(load); });
        expect([...container.querySelectorAll('iframe')].map(f => f.getAttribute('src'))).toEqual(['https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://e.com/x']);
    });

    it('focus mode hides the toolbar and applies the focus classes; theme tokens reach the scope', async () => {
        const { container } = renderHost({ initialContent: '<p>x</p>' }, { focusMode: true, theme: { accent: 'rgb(1, 2, 3)', maxWidth: '10rem', focusMaxWidth: '20rem' } });
        await flush();
        expect(screen.queryByTitle('Bold')).toBeNull();
        const scope = container.querySelector('.inscript-editor');
        expect(scope.getAttribute('style')).toContain('rgb(1, 2, 3)');
        const inner = container.querySelector('.inscript-editor-container');
        expect(inner.className).toContain('focus-mode');
        expect(inner.getAttribute('style')).toContain('20rem');
    });
});
