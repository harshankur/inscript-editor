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
});
