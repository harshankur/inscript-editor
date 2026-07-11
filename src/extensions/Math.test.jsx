import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('Math extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor({}, { math: true });
    });

    afterEach(() => {
        if (editor) {
            editor.destroy();
        }
    });

    it('parses inline math correctly', () => {
        editor.commands.setContent('<p>Equation <span class="math-inline" data-math="E=mc^2"></span></p>');
        const json = editor.getJSON();
        const paragraph = json.content[0];
        const mathInline = paragraph.content[1];

        expect(mathInline.type).toBe('mathInline');
        expect(mathInline.attrs.code).toBe('E=mc^2');
    });

    it('parses block math correctly', () => {
        editor.commands.setContent('<div class="math-block" data-math="\\int x dx"></div>');
        const json = editor.getJSON();
        const mathBlock = json.content[0];

        expect(mathBlock.type).toBe('mathBlock');
        expect(mathBlock.attrs.code).toBe('\\int x dx');
    });

    it('renders inline HTML correctly', () => {
        editor.commands.setContent('<p><span class="math-inline" data-math="a+b=c"></span></p>');
        const html = editor.getHTML();

        expect(html).toContain('class="math-inline"');
        expect(html).toContain('data-math="a+b=c"');
        expect(html).toContain('a+b=c');
    });

    it('renders block HTML correctly', () => {
        editor.commands.setContent('<div class="math-block" data-math="\\frac{1}{2}"></div>');
        const html = editor.getHTML();

        expect(html).toContain('class="math-block"');
        expect(html).toContain('data-math="\\frac{1}{2}"');
        expect(html).toContain('\\frac{1}{2}');
    });

    it('inserts inline math via insertMathInline', () => {
        editor.commands.insertContent({ type: 'mathInline', attrs: { code: 'y=mx+b' } });
        const json = editor.getJSON();

        expect(json.content[0].type).toBe('paragraph');
        expect(json.content[0].content[0].type).toBe('mathInline');
        expect(json.content[0].content[0].attrs.code).toBe('y=mx+b');
    });

    it('inserts block math via insertMathBlock', () => {
        editor.commands.insertContent({ type: 'mathBlock', attrs: { code: '\\sum i' } });
        const json = editor.getJSON();

        expect(json.content[0].type).toBe('mathBlock');
        expect(json.content[0].attrs.code).toBe('\\sum i');
    });
});
