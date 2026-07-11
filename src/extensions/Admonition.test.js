import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('Admonition extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor({}, { admonition: true });
    });

    afterEach(() => {
        editor.destroy();
    });

    it('parses admonition HTML correctly', () => {
        const html = '<div class="admonition admonition-tip" data-type="tip"><p>Be careful</p></div>';
        editor.commands.setContent(html);
        
        const json = editor.getJSON();
        const admonitionNode = json.content[0];

        expect(admonitionNode.type).toBe('admonition');
        expect(admonitionNode.attrs.admonitionType).toBe('tip');
        expect(admonitionNode.content[0].type).toBe('paragraph');
        expect(admonitionNode.content[0].content[0].text).toBe('Be careful');
    });

    it('renders HTML correctly with correct class and data attribute', () => {
        editor.commands.setContent('<p>Hello</p>');
        editor.commands.selectAll();
        editor.commands.setAdmonition('warning');

        const html = editor.getHTML();
        expect(html).toContain('data-type="warning"');
        expect(html).toContain('class="admonition admonition-warning"');
        expect(html).toContain('Hello');
    });

    it('removes admonition when content is cleared or toggled out', () => {
        editor.commands.setContent('<p>Test content</p>');
        editor.commands.selectAll();
        editor.commands.setAdmonition('important');
        expect(editor.getJSON().content[0].type).toBe('admonition');
    });
});
