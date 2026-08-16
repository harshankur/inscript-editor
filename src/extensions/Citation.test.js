import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('Citation extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor({}, { citation: true });
    });

    afterEach(() => {
        editor.destroy();
    });

    it('parses citation span correctly', () => {
        const html = '<p>Some text <span class="citation" data-key="key1" data-label="Author, 2026" title="Bibliography text">[@key1]</span></p>';
        editor.commands.setContent(html);
        const json = editor.getJSON();
        const citationNode = json.content[0].content[1];

        expect(citationNode.type).toBe('citation');
        expect(citationNode.attrs.key).toBe('key1');
        expect(citationNode.attrs.label).toBe('Author, 2026');
        expect(citationNode.attrs.title).toBe('Bibliography text');
    });

    it('renders HTML correctly', () => {
        const html = '<p>Some text <span class="citation" data-key="key1" data-label="Author, 2026" title="Bibliography text">[@key1]</span></p>';
        editor.commands.setContent(html);
        expect(editor.getHTML()).toContain('data-key="key1"');
        expect(editor.getHTML()).toContain('data-label="Author, 2026"');
        expect(editor.getHTML()).toContain('title="Bibliography text"');
    });

    it('inserts citation correctly using commands', () => {
        editor.commands.setContent('<p>Hello </p>');
        editor.commands.focus();
        editor.commands.insertCitation({ key: 'ref', label: 'Ref, 2026', title: 'Full Info' });

        const json = editor.getJSON();
        const citation = json.content[0].content[1];
        expect(citation.type).toBe('citation');
        expect(citation.attrs.key).toBe('ref');
    });

    // --- officeParser 7.6.0 contract alignment ---

    it('parses officeParser default cite[data-citation-key] and defaults label to the key', () => {
        editor.commands.setContent('<p><cite data-citation-key="smith2020"></cite></p>');
        const node = editor.getJSON().content[0].content[0];
        expect(node.type).toBe('citation');
        expect(node.attrs.key).toBe('smith2020');
        expect(node.attrs.label).toBe('smith2020');
    });

    it('omits empty title and label attributes on render', () => {
        editor.commands.setContent('<p>x</p>');
        editor.commands.focus('end');
        editor.commands.insertCitation({ key: 'k' });
        const html = editor.getHTML();
        expect(html).toContain('data-key="k"');
        expect(html).not.toContain('title=""');
        expect(html).not.toContain('data-label=""');
    });
});
