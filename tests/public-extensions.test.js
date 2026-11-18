// A host tests its round trip through exactly the editor's schema and parsing: the nodes and the
// whole extension list are exported for a headless editor.
import { afterEach, describe, expect, it } from 'vitest';
import { Editor, getSchema } from '@tiptap/core';
import { buildExtensions, KeyboardInput, Details, DetailsSummary, MathInline, MathBlock } from '../src/index.js';

let editor;
afterEach(() => { editor?.destroy(); editor = null; });

describe('exported extensions', () => {
    it('give the editor\'s whole schema, headless', () => {
        const schema = getSchema(buildExtensions());
        for (const name of ['keyboardInput', 'details', 'detailsSummary', 'mathInline', 'mathBlock', 'table', 'image']) {
            expect(schema.nodes[name], name).toBeDefined();
        }
    });

    it('are the nodes the editor itself uses', () => {
        const list = buildExtensions();
        for (const node of [KeyboardInput, Details, DetailsSummary, MathInline, MathBlock]) expect(list).toContain(node);
    });

    it('follow the options given (a feature turned off leaves its node out)', () => {
        const schema = getSchema(buildExtensions({ keyboardInput: false, details: false, math: false }));
        expect(schema.nodes.keyboardInput).toBeUndefined();
        expect(schema.nodes.details).toBeUndefined();
        expect(schema.nodes.mathInline).toBeUndefined();
    });

    it('round-trip keys, disclosures and formulas through a headless editor', () => {
        editor = new Editor({
            extensions: buildExtensions(),
            content: '<p><kbd>Ctrl</kbd>+<kbd>S</kbd> and <span class="math-inline" data-math="x^2"></span></p><details><summary>More</summary><p>body</p></details>',
        });
        const html = editor.getHTML();
        expect(html).toContain('<kbd>Ctrl</kbd>');
        expect(html).toContain('<summary>More</summary>');
        // The formula's own source, written back.
        expect(html).toMatch(/class="math-inline"[^>]*data-math="x\^2"|data-math="x\^2"[^>]*class="math-inline"/);
        expect(editor.getJSON().content[0].content.filter(node => node.type === 'keyboardInput')).toHaveLength(2);
    });
});
