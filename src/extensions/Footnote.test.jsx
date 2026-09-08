import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('Footnote extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor({}, { footnote: true });
    });

    afterEach(() => {
        editor.destroy();
    });

    it('parses footnote references correctly', () => {
        editor.commands.setContent('<p>Reference<sup data-footnote-ref="fn-123"></sup></p>');
        const json = editor.getJSON();
        const supNode = json.content[0].content[1];

        expect(supNode.type).toBe('footnoteReference');
        expect(supNode.attrs.id).toBe('fn-123');
    });

    it('parses footnote definitions correctly', () => {
        editor.commands.setContent('<section data-footnotes="true"><div data-footnote-id="fn-123"><p>Definition text</p></div></section>');
        const json = editor.getJSON();
        const sectionNode = json.content[0];
        const defNode = sectionNode.content[0];

        expect(sectionNode.type).toBe('footnotesSection');
        expect(defNode.type).toBe('footnoteDefinition');
        expect(defNode.attrs.id).toBe('fn-123');
        expect(defNode.content[0].content[0].text).toBe('Definition text');
    });

    // Counts sections in the doc and definitions that are DIRECT children of a section.
    const structure = (ed) => {
        let sections = 0, definitions = 0;
        ed.state.doc.descendants((n) => {
            if (n.type.name === 'footnotesSection') {
                sections++;
                n.forEach((c) => { if (c.type.name === 'footnoteDefinition') definitions++; });
                return false;
            }
            return true;
        });
        return { sections, definitions };
    };

    it('first insertFootnote appends one definition to a single section (no stray paragraph)', () => {
        editor.commands.setContent('<p>Hello world</p>');
        editor.commands.setTextSelection(6);
        editor.commands.insertFootnote();

        expect(structure(editor)).toEqual({ sections: 1, definitions: 1 });
        expect((editor.getHTML().match(/data-footnote-ref/g) || []).length).toBe(1);
        // Caret lands in inline content (the new definition's paragraph), not a node boundary.
        expect(editor.state.selection.$head.parent.isTextblock).toBe(true);
        // The section is a clean top-level sibling: original paragraph, the section, and the
        // trailing paragraph tiptap adds after any end-of-doc block (so you can type past it).
        // The old off-by-one instead split the paragraph the reference lived in.
        const kinds = [];
        editor.state.doc.forEach((n) => kinds.push(n.type.name));
        expect(kinds).toEqual(['paragraph', 'footnotesSection', 'paragraph']);
    });

    it('second insertFootnote adds a sibling definition, not one nested in the first', () => {
        editor.commands.setContent('<p>Hello world</p>');
        editor.commands.setTextSelection(6);
        editor.commands.insertFootnote();
        editor.commands.setTextSelection(3);
        expect(() => editor.commands.insertFootnote()).not.toThrow();

        // Both definitions are direct children of one section (the bug nested the 2nd inside the 1st).
        expect(structure(editor)).toEqual({ sections: 1, definitions: 2 });
        expect((editor.getHTML().match(/data-footnote-ref/g) || []).length).toBe(2);
        expect(editor.state.selection.$head.parent.isTextblock).toBe(true);
        // Still exactly one section and one trailing paragraph — neither accumulates.
        const kinds = [];
        editor.state.doc.forEach((n) => kinds.push(n.type.name));
        expect(kinds).toEqual(['paragraph', 'footnotesSection', 'paragraph']);
    });
});
