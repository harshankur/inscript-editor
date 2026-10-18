import { afterEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

let editor;
afterEach(() => editor?.destroy());

const validCursor = () => {
    const { $from, $to } = editor.state.selection;
    return $from.parent.inlineContent && $to.parent.inlineContent;
};

describe('insertDivider', () => {
    it('inserts a rule at the cursor in a paragraph', () => {
        editor = createEditor({ content: '<p>one</p>' });
        editor.commands.setTextSelection(4);
        editor.commands.insertDivider();
        expect(editor.getHTML()).toContain('<hr>');
        expect(validCursor()).toBe(true);
    });

    it('puts the rule after a definition list, with the cursor in a paragraph after it', () => {
        editor = createEditor({ content: '<dl><dt></dt><dd><p></p></dd></dl><blockquote><p>q</p></blockquote>' });
        editor.commands.setTextSelection(2);
        editor.commands.insertDivider();
        expect(editor.getHTML()).toBe('<dl><dt></dt><dd><p></p></dd></dl><hr><p></p><blockquote><p>q</p></blockquote><p></p>');
        expect(validCursor()).toBe(true);
        expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
    });

    it('reuses the paragraph after the list when there is one', () => {
        editor = createEditor({ content: '<dl><dt>Term</dt><dd><p>Desc</p></dd></dl><p>after</p>' });
        editor.commands.setTextSelection(3);
        editor.commands.insertDivider();
        expect(editor.getHTML()).toBe('<dl><dt>Term</dt><dd><p>Desc</p></dd></dl><hr><p>after</p>');
        expect(validCursor()).toBe(true);
        expect(editor.state.selection.$from.parent.textContent).toBe('after');
    });
});
