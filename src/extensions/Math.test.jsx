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

    it('insertMathInline puts math within a line of text, and refuses code and the gaps between blocks', () => {
        editor.commands.setContent('<h2>Title</h2><pre><code>let a;</code></pre><p>x</p>');
        editor.commands.setTextSelection(3);
        expect(editor.commands.insertMathInline()).toBe(true);
        expect(editor.state.doc.firstChild.child(1).type.name).toBe('mathInline');
        const codeAt = editor.state.doc.firstChild.nodeSize + 2;
        editor.commands.setTextSelection(codeAt);
        expect(editor.can().insertMathInline()).toBe(false);
        expect(editor.state.doc.child(1).textContent).toBe('let a;');
        editor.commands.setNodeSelection(codeAt - 1);
        expect(editor.can().insertMathInline()).toBe(false);
    });

    it('insertMathInline puts a new formula after a selected one, and refuses text selected across blocks', () => {
        editor.commands.setContent('<p>a <span class="math-inline" data-math="x"></span> b</p><pre><code>c</code></pre>');
        editor.commands.setNodeSelection(3);
        expect(editor.commands.insertMathInline()).toBe(true);
        const formulas = [];
        editor.state.doc.firstChild.forEach(node => { if (node.type.name === 'mathInline') formulas.push(node.attrs.code); });
        expect(formulas).toEqual(['x', 'E=mc^2']);
        const before = editor.getHTML();
        editor.commands.setTextSelection({ from: 2, to: editor.state.doc.firstChild.nodeSize + 2 });
        expect(editor.commands.insertMathInline()).toBe(false);
        expect(editor.getHTML()).toBe(before);
    });

    it('insertMathInline makes text selected within a line the formula\'s source', () => {
        editor.commands.setContent('<p>so x^2 + y^2 holds</p>');
        editor.commands.setTextSelection({ from: 4, to: 13 });
        expect(editor.commands.insertMathInline()).toBe(true);
        const paragraph = editor.state.doc.firstChild;
        expect(paragraph.child(1).type.name).toBe('mathInline');
        expect(paragraph.child(1).attrs.code).toBe('x^2 + y^2');
        expect(paragraph.textContent).toBe('so  holds');
    });

    it('insertMathInline refuses text holding an inline node that is not text (a citation), which it would delete', () => {
        editor.commands.setContent('<p>see <span class="citation" data-key="k">K</span> here</p>');
        editor.commands.setTextSelection({ from: 1, to: editor.state.doc.firstChild.nodeSize - 1 });
        const before = editor.getHTML();
        expect(editor.commands.insertMathInline()).toBe(false);
        expect(editor.getHTML()).toBe(before);
    });

    it('insertMathInline leaves the spaces at the selection\'s edges round the formula', () => {
        editor.commands.setContent('<p>so x^2 holds</p>');
        editor.commands.setTextSelection({ from: 3, to: 8 });
        expect(editor.commands.insertMathInline()).toBe(true);
        const paragraph = editor.state.doc.firstChild;
        expect(paragraph.child(1).attrs.code).toBe('x^2');
        expect(paragraph.textContent).toBe('so  holds');
        expect(paragraph.child(0).text).toBe('so ');
        expect(paragraph.child(2).text).toBe(' holds');
    });

    it('insertMathInline over only spaces keeps them, the formula after them', () => {
        editor.commands.setContent('<p>so holds</p>');
        editor.commands.setTextSelection({ from: 3, to: 4 });
        expect(editor.commands.insertMathInline()).toBe(true);
        const paragraph = editor.state.doc.firstChild;
        expect(paragraph.child(0).text).toBe('so ');
        expect(paragraph.child(1).type.name).toBe('mathInline');
        expect(paragraph.child(2).text).toBe('holds');
    });

    it('insertMathInline refuses inline code, which it would split', () => {
        editor.commands.setContent('<p>x <code>abc</code> y</p>');
        editor.commands.setTextSelection({ from: 4, to: 5 });
        expect(editor.can().insertMathInline()).toBe(false);
        editor.commands.setTextSelection(5);
        expect(editor.can().insertMathInline()).toBe(false);
        editor.commands.setTextSelection({ from: 1, to: 9 });
        expect(editor.can().insertMathInline()).toBe(false);
        editor.commands.setTextSelection(2);
        expect(editor.can().insertMathInline()).toBe(true);
        // Plain text right after inline code is not code, nor is a cursor at its end.
        editor.commands.setContent('<p><code>a</code>xy z</p>');
        editor.commands.setTextSelection({ from: 2, to: 4 });
        expect(editor.can().insertMathInline()).toBe(true);
        editor.commands.setContent('<p>run <code>npm i</code></p>');
        editor.commands.setTextSelection(editor.state.doc.firstChild.nodeSize - 1);
        expect(editor.can().insertMathInline()).toBe(true);
        editor.commands.insertMathInline();
        expect(editor.state.doc.firstChild.lastChild.type.name).toBe('mathInline');
        expect(editor.state.doc.firstChild.lastChild.marks).toHaveLength(0);
    });

    it('insertMathInline keeps the formatting all of the selected text shares', () => {
        editor.commands.setContent('<p>see <a href="https://example.com"><strong>x^2</strong></a> now</p>');
        editor.commands.setTextSelection({ from: 5, to: 8 });
        expect(editor.commands.insertMathInline()).toBe(true);
        const formula = editor.state.doc.firstChild.child(1);
        expect(formula.type.name).toBe('mathInline');
        expect(formula.marks.map(mark => mark.type.name).sort()).toEqual(['bold', 'link']);
    });

    it('insertMathInline at a cursor takes the formatting turned on there', () => {
        editor.commands.setContent('<p>ab</p>');
        editor.commands.setTextSelection(3);
        editor.commands.toggleBold();
        expect(editor.commands.insertMathInline()).toBe(true);
        expect(editor.state.doc.firstChild.lastChild.marks.map(mark => mark.type.name)).toEqual(['bold']);
    });

    it('insertMathInline after a selected key in code, or over spaces before bold text, takes no code and the formatting where it goes', () => {
        editor.commands.setContent('<p>a <code><kbd>K</kbd></code> b</p>');
        let keyPos = null;
        editor.state.doc.descendants((n, p) => { if (keyPos === null && n.type.name === 'keyboardInput') keyPos = p; });
        editor.commands.setNodeSelection(keyPos);
        expect(editor.commands.insertMathInline()).toBe(true);
        let formula = null;
        editor.state.doc.descendants(n => { if (!formula && n.type.name === 'mathInline') formula = n; });
        expect(formula.marks.some(mark => mark.type.spec.code)).toBe(false);

        editor.commands.setContent('<p>x <strong>bold</strong></p>');
        editor.commands.setTextSelection({ from: 2, to: 3 });
        expect(editor.commands.insertMathInline()).toBe(true);
        const placed = editor.state.doc.firstChild.child(1);
        expect(placed.type.name).toBe('mathInline');
        expect(placed.marks.map(mark => mark.type.name)).toEqual([]);
    });

    it('insertMathInline reads a line break in the selected text as a space, and a key as its text', () => {
        editor.commands.setContent('<p>a + b<br>= <kbd>c</kbd></p>');
        editor.commands.setTextSelection({ from: 1, to: editor.state.doc.firstChild.nodeSize - 1 });
        expect(editor.commands.insertMathInline()).toBe(true);
        expect(editor.state.doc.firstChild.firstChild.attrs.code).toBe('a + b = c');
    });

    it('inserts block math via insertMathBlock', () => {
        editor.commands.insertContent({ type: 'mathBlock', attrs: { code: '\\sum i' } });
        const json = editor.getJSON();

        expect(json.content[0].type).toBe('mathBlock');
        expect(json.content[0].attrs.code).toBe('\\sum i');
    });

    // --- officeParser 7.6.0 contract alignment ---

    it('strips $…$ delimiters on parse (officeParser default emission)', () => {
        editor.commands.setContent('<p><span data-math>$E=mc^2$</span></p>');
        const node = editor.getJSON().content[0].content[0];
        expect(node.type).toBe('mathInline');
        expect(node.attrs.code).toBe('E=mc^2');
    });

    it('strips $$…$$ delimiters on a block', () => {
        editor.commands.setContent('<div data-math>$$\\int x dx$$</div>');
        const node = editor.getJSON().content[0];
        expect(node.type).toBe('mathBlock');
        expect(node.attrs.code).toBe('\\int x dx');
    });

    it('does not emit a stray raw code attribute', () => {
        editor.commands.setContent('<p><span class="math-inline" data-math="E=mc^2"></span></p>');
        const html = editor.getHTML();
        expect(html).not.toMatch(/\scode=/);
        expect(html).toContain('data-math="E=mc^2"');
    });
});
