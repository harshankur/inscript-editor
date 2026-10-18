import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('DefinitionList extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor({}, { definitionList: true });
    });

    afterEach(() => {
        editor.destroy();
    });

    it('parses <dl>, <dt>, and <dd> correctly', () => {
        const html = '<dl><dt>Apple</dt><dd>A fruit</dd></dl>';
        editor.commands.setContent(html);
        const json = editor.getJSON();
        const dl = json.content[0];

        expect(dl.type).toBe('definitionList');
        expect(dl.content[0].type).toBe('definitionTerm');
        expect(dl.content[0].content[0].text).toBe('Apple');
        expect(dl.content[1].type).toBe('definitionDescription');
        // inside definitionDescription there is a block, usually paragraph
        expect(dl.content[1].content[0].type).toBe('paragraph');
        expect(dl.content[1].content[0].content[0].text).toBe('A fruit');
    });

    it('renders HTML correctly', () => {
        const html = '<dl><dt>Apple</dt><dd><p>A fruit</p></dd></dl>';
        editor.commands.setContent(html);
        expect(editor.getHTML()).toContain('<dl><dt>Apple</dt><dd><p>A fruit</p></dd></dl>');
    });

    it('toggles definition list correctly', () => {
        editor.commands.setContent('<p>Apple</p>');
        editor.commands.selectAll();
        editor.commands.toggleDefinitionList();
        expect(editor.getHTML()).toContain('<dl><dt>Apple</dt>');
    });

    it('wraps then unwraps a definition list without crashing or a dangling selection', () => {
        editor.commands.setContent('<p>Apple</p>');
        editor.commands.setTextSelection(2);
        editor.commands.toggleDefinitionList(); // wrap
        expect(editor.getHTML()).toContain('<dl>');
        // The wrap must leave the caret inside inline content (the term), not at a node boundary -
        // a boundary selection is what ProseMirror rejects and what corrupted the doc on re-toggle.
        expect(editor.state.selection.$head.parent.isTextblock).toBe(true);
        // Toggling again from that same caret must unwrap cleanly, not throw.
        expect(() => editor.commands.toggleDefinitionList()).not.toThrow();
        expect(editor.getHTML()).not.toContain('<dl>');
        expect(editor.getHTML()).toContain('Apple');
        expect(editor.state.selection.$head.parent.isTextblock).toBe(true);
    });

    it('does nothing in a list item, where a definition list cannot replace the first paragraph', () => {
        editor.commands.setContent('<ul><li><p>item one</p></li></ul>');
        const before = editor.getHTML();
        editor.commands.setTextSelection(4);
        expect(editor.commands.toggleDefinitionList()).toBe(false);
        expect(editor.getHTML()).toBe(before);
        expect(editor.state.selection.$head.parent.isTextblock).toBe(true);
    });

    it('does nothing with an image selected', () => {
        editor.commands.setContent('<img src="https://e.com/a.png"><p>after</p>');
        editor.commands.setNodeSelection(0);
        const before = editor.getHTML();
        expect(editor.commands.toggleDefinitionList()).toBe(false);
        expect(editor.getHTML()).toBe(before);
    });
});
