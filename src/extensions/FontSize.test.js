import { beforeEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('FontSize extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
        editor.commands.setContent('<p>hello world</p>');
        editor.commands.selectAll();
    });

    it('setFontSize applies a fontSize attr on the textStyle mark', () => {
        editor.commands.setFontSize(24);
        expect(editor.getAttributes('textStyle').fontSize).toBe(24);
        expect(editor.getHTML()).toContain('font-size: 24px');
    });

    it('unsetFontSize clears the attr and removes the now-empty textStyle mark', () => {
        editor.commands.setFontSize(24);
        editor.commands.unsetFontSize();
        expect(editor.getAttributes('textStyle').fontSize).toBeFalsy();
        expect(editor.getHTML()).not.toContain('font-size');
    });

    it('round-trips through render/parse', () => {
        editor.commands.setFontSize(18);
        const html = editor.getHTML();
        editor.commands.setContent(html);
        expect(editor.getAttributes('textStyle').fontSize).toBe('18');
    });

    it('preserves other textStyle marks (color) when setting font size', () => {
        editor.commands.setColor('#ff0000');
        editor.commands.setFontSize(24);
        expect(editor.getAttributes('textStyle').color).toBe('#ff0000');
        expect(editor.getAttributes('textStyle').fontSize).toBe(24);
    });
});
