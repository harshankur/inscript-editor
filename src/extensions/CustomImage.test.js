import { beforeEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('CustomImage extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
    });

    it('defaults width to 100% and align to center', () => {
        editor.commands.setImage({ src: 'https://example.com/a.png' });
        const node = editor.state.doc.firstChild;
        expect(node.attrs.width).toBe('100%');
        expect(node.attrs.align).toBe('center');
    });

    it('round-trips a custom width/align through render/parse', () => {
        editor.commands.setImage({ src: 'https://example.com/a.png' });
        editor.chain().selectAll().updateAttributes('image', { width: '50%', align: 'left' }).run();
        const html = editor.getHTML();
        expect(html).toContain('data-width="50%"');
        expect(html).toContain('data-align="left"');

        editor.commands.setContent(html);
        const node = editor.state.doc.firstChild;
        expect(node.attrs.width).toBe('50%');
        expect(node.attrs.align).toBe('left');
    });

    it('renders left/right alignment with the correct margin auto side', () => {
        editor.commands.setImage({ src: 'https://example.com/a.png' });
        editor.chain().selectAll().updateAttributes('image', { align: 'right' }).run();
        expect(editor.getHTML()).toContain('margin-left: auto');
        expect(editor.getHTML()).toContain('margin-right: 0');
    });
});
