import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { cssFontSize, normalizeFontSize } from './FontSize.js';

describe('FontSize extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
        editor.commands.setContent('<p>hello world</p>');
        editor.commands.selectAll();
    });

    afterEach(() => {
        if (editor) {
            editor.destroy();
        }
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

    it.each([['11pt', '11pt'], ['1.5em', '1.5em'], ['120%', '120%'], ['large', 'large'], ['18px', '18px'], ['2rem', '2rem']])('keeps a pasted font-size of %s on save', (pasted, saved) => {
        editor.commands.setContent(`<p><span style="font-size: ${pasted}">text</span></p>`);
        expect(editor.getHTML()).toContain(`font-size: ${saved}`);
    });

    it('stores a pixel size as a bare number, like the toolbar does', () => {
        editor.commands.setContent('<p><span style="font-size: 18px">text</span></p>');
        editor.commands.setTextSelection({ from: 1, to: 5 });
        expect(editor.getAttributes('textStyle').fontSize).toBe('18');
    });

    it('reads and writes only real font sizes', () => {
        expect(normalizeFontSize('11PT')).toBe('11pt');
        expect(normalizeFontSize('calc(1px + 2px)')).toBeNull();
        expect(normalizeFontSize('12px; color: red')).toBeNull();
        expect(normalizeFontSize('')).toBeNull();
        expect(cssFontSize('16')).toBe('16px');
        expect(cssFontSize('11pt')).toBe('11pt');
        expect(cssFontSize('x-large')).toBe('x-large');
        expect(cssFontSize('12px; position: fixed')).toBeNull();
    });
});
