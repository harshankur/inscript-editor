import { afterEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

let editor;
afterEach(() => editor?.destroy());

describe('InscriptLink autolink', () => {
    it('does not link a plain-text URL in content set as a whole', () => {
        editor = createEditor();
        const html = '<p>see http://example.com</p><p>next</p>';
        editor.commands.setContent(html, { emitUpdate: false });
        expect(editor.getHTML()).toBe(html);
    });

    it('does not bring back a removed link when a version is set again', () => {
        editor = createEditor();
        editor.commands.setContent('<h4>Docs: <a href="http://e.com/a_b">http://e.com/a_b</a></h4><p>body</p>', { emitUpdate: false });
        editor.chain().selectAll().unsetLink().run();
        const version = editor.getHTML();
        editor.commands.setContent('<h4>Doc: http://e.com/a_b</h4><p>body text</p>', { emitUpdate: false });
        editor.commands.setContent(version, { emitUpdate: false });
        expect(editor.getHTML()).toBe(version);
    });

    it('still links a URL the writer types', () => {
        editor = createEditor({ content: '<p>see</p>' });
        editor.commands.setTextSelection(4);
        editor.commands.insertContent(' https://example.com');
        editor.commands.insertContent(' ');
        expect(editor.getHTML()).toContain('href="https://example.com"');
    });
});
