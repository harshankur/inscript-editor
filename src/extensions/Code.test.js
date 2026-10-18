import { afterEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

let editor;
afterEach(() => editor?.destroy());

describe('Code block', () => {
    it('drops the one trailing newline a Markdown renderer adds', () => {
        editor = createEditor({ content: '<pre><code class="language-js">const x = 1;\n</code></pre>' });
        expect(editor.getJSON().content[0]).toMatchObject({ type: 'codeBlock', attrs: { language: 'js' }, content: [{ text: 'const x = 1;' }] });
    });

    it('keeps inner line breaks and an empty block', () => {
        editor = createEditor({ content: '<pre><code>a\n\nb</code></pre><pre><code>\n</code></pre>' });
        const [first, second] = editor.getJSON().content;
        expect(first.content[0].text).toBe('a\n\nb');
        expect(second.content).toBeUndefined();
    });
});

describe('Inline code', () => {
    it('keeps a link around it', () => {
        editor = createEditor({ content: '<p><a href="https://www.npmjs.com/"><code>npm</code></a></p>' });
        expect(editor.getHTML()).toContain('href="https://www.npmjs.com/"');
        expect(editor.getHTML()).toContain('<code>npm</code>');
    });

    it('keeps bold around it', () => {
        editor = createEditor({ content: '<p><strong><code>x</code></strong></p>' });
        expect(editor.getHTML()).toBe('<p><strong><code>x</code></strong></p>');
    });

    it('still toggles with its command and shortcut name', () => {
        editor = createEditor({ content: '<p>abc</p>' });
        editor.chain().setTextSelection({ from: 1, to: 4 }).toggleCode().run();
        expect(editor.getHTML()).toBe('<p><code>abc</code></p>');
    });
});
