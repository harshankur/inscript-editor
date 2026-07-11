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


});
