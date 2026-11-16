import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

let editor;
let element;
afterEach(() => { editor?.destroy(); element?.remove(); editor = null; element = null; });

/** An editor with a view in the document, for the node view and its toggle. */
const mount = (content, options) => {
    element = document.createElement('div');
    document.body.appendChild(element);
    editor = createEditor({ element, content, ...options });
    return editor;
};
const textPos = text => {
    let pos = null;
    editor.state.doc.descendants((node, p) => { if (pos === null && node.isText && node.text.includes(text)) pos = p + node.text.indexOf(text); });
    return pos;
};
/** The document as written, without the empty paragraph the editor keeps after a closing block. */
const html = () => editor.getHTML().replace(/<p><\/p>$/, '');
const BODY = '<details><summary>Why</summary><p>One.</p><p>Two.</p><ul><li><p>a</p></li><li><p>b</p></li></ul></details>';

describe('Details: parsing and writing', () => {
    it('reads and writes <details><summary>…</summary>…</details> as it is', () => {
        editor = createEditor({ content: BODY });
        expect(editor.getHTML()).toBe(BODY);
        const details = editor.state.doc.firstChild;
        expect(details.type.name).toBe('details');
        expect(details.firstChild.type.name).toBe('detailsSummary');
        expect(details.childCount).toBe(4);
    });

    it('keeps the open state', () => {
        editor = createEditor({ content: '<details open><summary>S</summary><p>x</p></details>' });
        expect(editor.state.doc.firstChild.attrs.open).toBe(true);
        expect(editor.getHTML()).toBe('<details open=""><summary>S</summary><p>x</p></details>');
    });

    it('gives a disclosure with no summary an empty one, and puts a later summary first', () => {
        editor = createEditor({ content: '<details><p>body</p></details>' });
        expect(editor.getHTML()).toBe('<details><summary></summary><p>body</p></details>');
        editor.commands.setContent('<details><p>body</p><summary>Late</summary></details>');
        expect(html()).toBe('<details><summary>Late</summary><p>body</p></details>');
    });

    it('can be turned off: the summary and body are then plain blocks', () => {
        editor = createEditor({ content: '<details><summary>S</summary><p>x</p></details>' }, { details: false });
        expect(editor.schema.nodes.details).toBeUndefined();
        expect(editor.getHTML()).not.toContain('<details');
        expect(editor.getHTML()).toContain('x');
        // A list item opening with one gets no blank first line for it.
        editor.commands.setContent('<ul><li><details><summary>S</summary><p>b</p></details></li></ul>');
        expect(editor.getHTML()).toContain('<ul><li><p>S</p><p>b</p></li></ul>');
    });

    it('media in a summary open the body, in order, the summary\'s text kept whole', () => {
        editor = createEditor({ content: '<details><summary><img src="https://x.com/i.png"> Title <img src="https://x.com/j.png"> end</summary><p>body</p></details>' });
        const details = editor.state.doc.firstChild;
        expect(details.firstChild.textContent).toBe('Title end');
        expect([1, 2, 3].map(index => details.child(index).type.name)).toEqual(['image', 'image', 'paragraph']);
        expect(details.child(1).attrs.src).toBe('https://x.com/i.png');
    });

    it('a disclosure opening a list item stays in that item (as Markdown renderers write it), comments on or off', () => {
        for (const options of [{}, { htmlComment: false }]) {
            editor = createEditor({ content: '<ul><li><details><summary>S</summary><p>b</p></details></li></ul>' }, options);
            expect(editor.getHTML()).toBe('<ul><li><p></p><details><summary>S</summary><p>b</p></details></li></ul>');
            editor.destroy();
        }
        editor = null;
    });
});

describe('Details: commands and keys', () => {
    it('setDetails wraps the selected blocks, its summary selected for typing', () => {
        editor = createEditor({ content: '<p>One</p><p>Two</p>' });
        editor.commands.setTextSelection({ from: 2, to: 8 });
        expect(editor.commands.setDetails()).toBe(true);
        expect(html()).toBe('<details open=""><summary>Details</summary><p>One</p><p>Two</p></details>');
        const { from, to } = editor.state.selection;
        expect(editor.state.doc.textBetween(from, to)).toBe('Details');
    });

    it('setDetails with a summary translated to nothing starts with an empty summary', async () => {
        const { createInstance } = await import('i18next');
        const { setEditorI18n } = await import('./HostBridge.js');
        const blank = createInstance();
        await blank.init({ lng: 'en', resources: { en: { 'inscript-editor': { detailsSummaryDefault: '' } } } });
        editor = createEditor({ content: '<p>Body</p>' });
        setEditorI18n(editor, blank);
        editor.commands.setTextSelection(2);
        expect(() => editor.commands.setDetails()).not.toThrow();
        expect(html()).toBe('<details open=""><summary></summary><p>Body</p></details>');
    });

    it('unsetDetails unwraps: the summary becomes a paragraph, the body stays', () => {
        editor = createEditor({ content: BODY });
        editor.commands.setTextSelection(textPos('Two') + 1);
        expect(editor.commands.unsetDetails()).toBe(true);
        expect(html()).toBe('<p>Why</p><p>One.</p><p>Two.</p><ul><li><p>a</p></li><li><p>b</p></li></ul>');
        expect(editor.state.selection.$from.parent.textContent).toBe('Two.');
    });

    it('toggleDetails wraps, then unwraps', () => {
        editor = createEditor({ content: '<p>Body</p>' });
        editor.commands.setTextSelection(2);
        editor.commands.toggleDetails();
        expect(editor.isActive('details')).toBe(true);
        editor.commands.toggleDetails();
        expect(html()).toBe('<p>Details</p><p>Body</p>');
    });

    it('a selected disclosure is the one toggled, opened or unwrapped', () => {
        editor = createEditor({ content: '<p>a</p><details><summary>S</summary><p>b</p></details>' });
        editor.commands.setNodeSelection(3);
        expect(editor.isActive('details')).toBe(true);
        editor.commands.setDetailsOpen(true);
        expect(editor.state.doc.child(1).attrs.open).toBe(true);
        editor.commands.setNodeSelection(3);
        editor.commands.toggleDetails();
        expect(html()).toBe('<p>a</p><p>S</p><p>b</p>');
    });

    it('toggleDetails with text of one body line selected unwraps, as it does where a disclosure cannot nest', () => {
        editor = createEditor({ content: '<details open><summary>S</summary><p>one two</p></details>' });
        editor.commands.setTextSelection({ from: textPos('two'), to: textPos('two') + 3 });
        editor.commands.toggleDetails();
        expect(html()).toBe('<p>S</p><p>one two</p>');
        editor.commands.setContent('<details open><summary>S</summary><ul><li><p>a b</p></li></ul></details>');
        editor.commands.setTextSelection({ from: textPos('a'), to: textPos('a') + 1 });
        expect(editor.can().toggleDetails()).toBe(true);
        editor.commands.toggleDetails();
        expect(html()).toBe('<p>S</p><ul><li><p>a b</p></li></ul>');
    });

    it('a selection from the body to past the disclosure is not in it: toggleDetails wraps what it covers', () => {
        editor = createEditor({ content: '<details open><summary>S</summary><p>Body</p></details><p>after</p>' });
        editor.commands.setTextSelection({ from: textPos('Body') + 1, to: textPos('after') + 2 });
        editor.commands.toggleDetails();
        expect(html()).toBe('<details open=""><summary>Details</summary><details open=""><summary>S</summary><p>Body</p></details><p>after</p></details>');
    });

    it('setDetails across list items wraps the list (a list holds only its items)', () => {
        editor = createEditor({ content: '<ul><li><p>one</p></li><li><p>two</p></li></ul><p>after</p>' });
        editor.commands.setTextSelection({ from: textPos('one'), to: textPos('two') + 3 });
        expect(editor.can().toggleDetails()).toBe(true);
        editor.commands.toggleDetails();
        expect(html()).toBe('<details open=""><summary>Details</summary><ul><li><p>one</p></li><li><p>two</p></li></ul></details><p>after</p>');
    });

    it('toggleDetails with body blocks selected nests a disclosure around them', () => {
        editor = createEditor({ content: '<details open><summary>S</summary><p>one</p><p>two</p></details>' });
        editor.commands.setTextSelection({ from: textPos('one'), to: textPos('two') + 3 });
        editor.commands.toggleDetails();
        expect(html()).toBe('<details open=""><summary>S</summary><details open=""><summary>Details</summary><p>one</p><p>two</p></details></details>');
    });

    it('Backspace in an empty code block after a closed disclosure leaves both alone', () => {
        mount('<details><summary>S</summary><p>b</p></details><pre><code></code></pre>');
        editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 1);
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
        let disclosures = 0;
        editor.state.doc.descendants(node => { if (node.type.name === 'details') disclosures++; });
        expect(disclosures).toBe(1);
        expect(editor.state.doc.firstChild.childCount).toBe(2);
    });

    it('setDetailsOpen(false) on a closed disclosure shown for the cursor in its body hides it', () => {
        mount('<details><summary>S</summary><p>body</p></details>');
        editor.commands.setTextSelection(textPos('body') + 1);
        expect(editor.view.dom.querySelector('.inscript-details').hasAttribute('data-reveal')).toBe(true);
        editor.commands.setDetailsOpen(false);
        expect(editor.state.selection.$from.parent.type.name).toBe('detailsSummary');
        expect(editor.view.dom.querySelector('.inscript-details').hasAttribute('data-reveal')).toBe(false);
    });

    it('setDetailsOpen opens and closes the disclosure around the cursor', () => {
        editor = createEditor({ content: '<details><summary>S</summary><p>x</p></details>' });
        editor.commands.setTextSelection(textPos('x'));
        editor.commands.setDetailsOpen(true);
        expect(editor.state.doc.firstChild.attrs.open).toBe(true);
        editor.commands.setDetailsOpen(false);
        expect(editor.state.doc.firstChild.attrs.open).toBe(false);
        editor.commands.setContent('<p>outside</p>');
        expect(editor.commands.setDetailsOpen(true)).toBe(false);
    });

    it('Enter in the summary opens the disclosure and starts the body with what follows the cursor', () => {
        mount('<details><summary>Question answer</summary><p>x</p></details>');
        editor.commands.setTextSelection(textPos('answer'));
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Enter' })));
        expect(html()).toBe('<details open=""><summary>Question </summary><p>answer</p><p>x</p></details>');
        expect(editor.state.selection.$from.parent.textContent).toBe('answer');
        expect(editor.state.selection.$from.parentOffset).toBe(0);
    });

    it('Enter over a selected word in a closed summary opens it, the rest starting the body', () => {
        mount('<details><summary>Question answer here</summary><p>x</p></details>');
        const at = textPos('answer');
        editor.commands.setTextSelection({ from: at, to: at + 'answer'.length });
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Enter' })));
        expect(html()).toBe('<details open=""><summary>Question </summary><p> here</p><p>x</p></details>');
    });

    it('unwrapping keeps a selection across the body', () => {
        editor = createEditor({ content: '<details><summary>S</summary><p>one</p><p>two</p></details>' });
        editor.commands.setTextSelection({ from: textPos('one'), to: textPos('two') + 3 });
        editor.commands.unsetDetails();
        const { from, to } = editor.state.selection;
        expect(editor.state.doc.textBetween(from, to, '|')).toBe('one|two');
    });

    it('reads a summary holding blocks as its text, and text before the summary as body', () => {
        editor = createEditor({ content: '<details><summary><h3>Title</h3><p>More</p></summary><p>x</p></details>' });
        expect(html()).toBe('<details><summary>Title More</summary><p>x</p></details>');
        editor.commands.setContent('<details>lead<summary>S</summary><p>x</p></details>');
        expect(html()).toBe('<details><summary>S</summary><p>lead</p><p>x</p></details>');
    });

    it('reads a summary holding a list as its text', () => {
        editor = createEditor({ content: '<details><summary><ul><li>Title</li></ul></summary><p>b</p></details>' });
        expect(html()).toBe('<details><summary>Title</summary><p>b</p></details>');
    });

    it('a second summary is body text, and a summary outside a disclosure is a paragraph', () => {
        editor = createEditor({ content: '<details><summary>A</summary><p>x</p><summary>B</summary><p>y</p></details>' });
        expect(html()).toBe('<details><summary>A</summary><p>x</p><p>B</p><p>y</p></details>');
        editor.commands.setContent('<summary>A</summary><p>x</p>');
        expect(html()).toBe('<p>A</p><p>x</p>');
    });

    it('a summary in a wrapper in the body is text, not a second disclosure', () => {
        editor = createEditor({ content: '<details><summary>A</summary><div><summary>B</summary><p>x</p></div></details>' });
        expect(editor.state.doc.firstChild.type.name).toBe('details');
        expect(editor.state.doc.childCount).toBe(editor.getHTML().endsWith('<p></p>') ? 2 : 1);
        let disclosures = 0;
        editor.state.doc.descendants(node => { if (node.type.name === 'details') disclosures++; });
        expect(disclosures).toBe(1);
        expect(editor.getText()).toContain('B');
    });

    it('Backspace at the start of the body moves up to the summary, never merging into it', () => {
        mount('<details open><summary>Sum</summary><p>Body</p></details>');
        editor.commands.setTextSelection(textPos('Body'));
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
        expect(html()).toBe('<details open=""><summary>Sum</summary><p>Body</p></details>');
        expect(editor.state.selection.$from.parent.type.name).toBe('detailsSummary');
    });

    it('Backspace in an empty code block opening the body turns it into a line, as anywhere else', () => {
        mount('<details open><summary>S</summary><pre><code></code></pre><p>x</p></details>');
        editor.commands.setTextSelection(textPos('S') + 3);
        expect(editor.state.selection.$from.parent.type.name).toBe('codeBlock');
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
        expect(html()).toBe('<details open=""><summary>S</summary><p></p><p>x</p></details>');
    });

    it('Backspace in an empty first body block with more after it removes that block', () => {
        mount('<details open><summary>Sum</summary><p></p><p>Body</p></details>');
        editor.commands.setTextSelection(textPos('Sum') + 5);
        expect(editor.state.selection.$from.parent.content.size).toBe(0);
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
        expect(html()).toBe('<details open=""><summary>Sum</summary><p>Body</p></details>');
    });

    it('Backspace at the start of a block after a closed disclosure opens it, so nothing joins it unseen', () => {
        mount('<details><summary>Sum</summary><p>b</p></details><p>c</p>');
        editor.commands.setTextSelection(textPos('c'));
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
        expect(editor.state.doc.firstChild.attrs.open).toBe(true);
        expect(html()).toBe('<details open=""><summary>Sum</summary><p>b</p><p>c</p></details>');
        // Opened and joined in one step: one undo puts both back.
        editor.commands.undo();
        expect(html()).toBe('<details><summary>Sum</summary><p>b</p></details><p>c</p>');
    });

    it('Backspace joining a quote into a closed body opens the disclosure, in one undoable step', () => {
        mount('<details><summary>S</summary><p>x</p></details><blockquote><p>quote</p></blockquote>');
        editor.commands.setTextSelection(textPos('quote'));
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
        expect(html()).toBe('<details open=""><summary>S</summary><p>x</p><blockquote><p>quote</p></blockquote></details>');
        editor.commands.undo();
        expect(html()).toBe('<details><summary>S</summary><p>x</p></details><blockquote><p>quote</p></blockquote>');
    });

    it('Backspace at the start of a list after a closed disclosure lifts the item, as it does after an open one', () => {
        for (const open of ['', ' open']) {
            mount(`<details${open}><summary>S</summary><p>body</p></details><ul><li><p>item</p></li></ul>`);
            editor.commands.setTextSelection(textPos('item'));
            editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
            expect(html()).toBe(`<details${open ? ' open=""' : ''}><summary>S</summary><p>body</p></details><p>item</p>`);
            editor.destroy();
            element.remove();
        }
        editor = null;
        element = null;
    });

    it('editing the first block of a closed body shown for the cursor leaves the disclosure closed', () => {
        editor = createEditor({ content: '<details><summary>Sum</summary><p>body</p><p>two</p></details>' });
        editor.commands.setTextSelection(textPos('body') + 1);
        editor.commands.setHeading({ level: 2 });
        editor.commands.toggleBulletList();
        editor.commands.setTextAlign?.('center');
        editor.commands.insertContent('x');
        expect(editor.state.doc.firstChild.attrs.open).toBe(false);
        editor.commands.setTextSelection({ from: textPos('two'), to: textPos('two') + 3 });
        editor.commands.setTextSelection({ from: textPos('xody') ?? textPos('body'), to: textPos('two') + 3 });
        editor.commands.toggleDetails();
        expect(editor.state.doc.firstChild.attrs.open).toBe(false);
    });

    it('Backspace joining two lines inside a closed body shown for the cursor leaves it closed', () => {
        mount('<details><summary>S</summary><p>a</p><p>b</p></details>');
        editor.commands.setTextSelection(textPos('b'));
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
        expect(html()).toBe('<details><summary>S</summary><p>ab</p></details>');
    });

    it('Ctrl+H is a Backspace only on a Mac: elsewhere it is left to the browser', () => {
        mount('<details open><summary>S</summary><p>body</p></details>');
        editor.commands.setTextSelection(textPos('S'));
        const handled = editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'h', ctrlKey: true })));
        expect(!!handled).toBe(false);
        expect(html()).toBe('<details open=""><summary>S</summary><p>body</p></details>');
    });

    it('Backspace on an empty heading after a closed disclosure removes it too (nothing joins the body unseen)', () => {
        mount('<details><summary>S</summary><p>body</p></details><h2></h2><p>end</p>');
        editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 1);
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
        expect(html()).toBe('<details><summary>S</summary><p>body</p></details><p>end</p>');
    });

    it('Backspace on an empty line after a closed disclosure removes the line and selects the disclosure', () => {
        mount('<details><summary>S</summary><p>body</p></details><p></p><p>end</p>');
        editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 1);
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
        expect(html()).toBe('<details><summary>S</summary><p>body</p></details><p>end</p>');
        expect(editor.state.selection.node?.type.name).toBe('details');
    });

    it('a range from the summary into the body, deleted or typed over, keeps the rest of that line in the body', () => {
        const start = '<details open><summary>Sum</summary><h2>body</h2><p>two</p></details>';
        mount(start);
        const range = () => ({ from: textPos('Sum') + 1, to: textPos('body') + 2 });
        editor.commands.setTextSelection(range());
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
        expect(html()).toBe('<details open=""><summary>S</summary><h2>dy</h2><p>two</p></details>');
        editor.commands.setContent(start);
        editor.commands.setTextSelection(range());
        editor.view.dispatch(editor.state.tr.insertText('x'));
        expect(html()).toBe('<details open=""><summary>Sx</summary><h2>dy</h2><p>two</p></details>');
        // Through to the end of the line: that line goes, and nothing joins the summary.
        editor.commands.setContent(start);
        editor.commands.setTextSelection({ from: textPos('Sum') + 1, to: textPos('body') + 4 });
        editor.commands.deleteSelection();
        expect(html()).toBe('<details open=""><summary>S</summary><p>two</p></details>');
    });

    it('a range from the summary into a one-line body or a quote, deleted, typed or pasted over, keeps the body as it was', () => {
        globalThis.ClipboardEvent ??= class extends Event { constructor(type, init) { super(type, init); this.clipboardData = init?.clipboardData ?? null; } };
        const cases = [
            ['<details open><summary>Sum</summary><p>para line</p></details>', 'para ', '<details open=""><summary>Su</summary><p>line</p></details>'],
            ['<details open><summary>Sum</summary><blockquote><p>quote text</p></blockquote><p>after</p></details>', 'quo', '<details open=""><summary>Su</summary><blockquote><p>te text</p></blockquote><p>after</p></details>'],
        ];
        for (const [start, upTo, deleted] of cases) {
            mount(start);
            const range = () => ({ from: textPos('Sum') + 2, to: textPos(upTo) + upTo.length });
            const cursor = range().from;
            editor.commands.setTextSelection(range());
            editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
            expect(html()).toBe(deleted);
            expect(editor.state.selection.from).toBe(cursor);
            editor.commands.setContent(start);
            editor.commands.setTextSelection(range());
            editor.commands.deleteSelection();
            expect(html()).toBe(deleted);
            editor.commands.setContent(start);
            editor.commands.setTextSelection(range());
            const { from, to } = editor.state.selection;
            editor.view.someProp('handleTextInput', f => f(editor.view, from, to, 'x'));
            expect(html()).toBe(deleted.replace('<summary>Su</summary>', '<summary>Sux</summary>'));
            editor.commands.setContent(start);
            editor.commands.setTextSelection(range());
            editor.view.pasteHTML('<span>y</span>');
            expect(html()).toBe(deleted.replace('<summary>Su</summary>', '<summary>Suy</summary>'));
            editor.destroy();
            element.remove();
        }
        editor = null;
        element = null;
    });

    it('Enter with a range from the summary into the body keeps both parts, the cursor starting the body', () => {
        mount('<details open><summary>Sum</summary><p>body</p></details>');
        editor.commands.setTextSelection({ from: textPos('Sum') + 1, to: textPos('body') + 2 });
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Enter' })));
        expect(html()).toBe('<details open=""><summary>S</summary><p>dy</p></details>');
        expect(editor.state.selection.$from.parent.textContent).toBe('dy');
        expect(editor.state.selection.$from.parentOffset).toBe(0);
    });

    it('a selection across two disclosures is in neither: toggleDetails wraps, and setDetailsOpen does nothing', () => {
        editor = createEditor({ content: '<details open><summary>A</summary><p>a1</p></details><details open><summary>B</summary><p>b1</p></details>' });
        editor.commands.setTextSelection({ from: textPos('a1') + 1, to: textPos('b1') + 1 });
        expect(editor.commands.setDetailsOpen(false)).toBe(false);
        editor.commands.toggleDetails();
        let disclosures = 0;
        editor.state.doc.descendants(node => { if (node.type.name === 'details') disclosures++; });
        expect(disclosures).toBe(3);
        expect(editor.state.doc.childCount).toBeLessThanOrEqual(2);
    });

    it('Enter in a summary works through the editor\'s keyboardShortcut command too', () => {
        mount('<details><summary>ab cd</summary><p>x</p></details>');
        editor.commands.setTextSelection(textPos('ab') + 2);
        editor.commands.keyboardShortcut('Enter');
        expect(html()).toBe('<details open=""><summary>ab</summary><p> cd</p><p>x</p></details>');
    });

    it('Enter with a key selected in a summary keeps the key, the line breaking before it', () => {
        mount('<details open><summary>a <kbd>K</kbd> b</summary><p>x</p></details>');
        let key = null;
        editor.state.doc.descendants((node, pos) => { if (key === null && node.type.name === 'keyboardInput') key = pos; });
        editor.commands.setNodeSelection(key);
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Enter' })));
        expect(html()).toBe('<details open=""><summary>a </summary><p><kbd>K</kbd> b</p><p>x</p></details>');
    });

    it('Enter at the end of a summary over an empty body uses that paragraph', () => {
        mount('<details><summary>Sum</summary><p></p></details>');
        editor.commands.setTextSelection(textPos('Sum') + 3);
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Enter' })));
        expect(html()).toBe('<details open=""><summary>Sum</summary><p></p></details>');
        expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
    });

    it.each(['Shift-Backspace', 'Mod-Backspace'])('%s at the start of the body never merges it into the summary', (combo) => {
        mount('<details open><summary>Sum</summary><p>Body</p></details>');
        editor.commands.setTextSelection(textPos('Body'));
        const [mod, key] = combo.split('-');
        const event = new KeyboardEvent('keydown', { key, shiftKey: mod === 'Shift', metaKey: mod === 'Mod', ctrlKey: false });
        editor.view.someProp('handleKeyDown', f => f(editor.view, event));
        expect(html()).toBe('<details open=""><summary>Sum</summary><p>Body</p></details>');
    });

    it('toggleDetails with an image in the body selected nests a disclosure around it', () => {
        editor = createEditor({ content: '<details open><summary>S</summary><p>a</p><img src="https://e.com/a.png"></details>' });
        let image = null;
        editor.state.doc.descendants((node, pos) => { if (image === null && node.type.name === 'image') image = pos; });
        editor.commands.setNodeSelection(image);
        editor.commands.toggleDetails();
        let disclosures = 0;
        editor.state.doc.descendants(node => { if (node.type.name === 'details') disclosures++; });
        expect(disclosures).toBe(2);
    });

    it('Delete at the end of the summary removes an empty first body line, if another follows', () => {
        mount('<details open><summary>Sum</summary><p></p><p>Body</p></details>');
        editor.commands.setTextSelection(textPos('Sum') + 3);
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Delete' })));
        expect(html()).toBe('<details open=""><summary>Sum</summary><p>Body</p></details>');
        expect(editor.state.selection.$from.parent.type.name).toBe('detailsSummary');
        editor.commands.setContent('<details open><summary>Sum</summary><p></p></details>');
        editor.commands.setTextSelection(textPos('Sum') + 3);
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Delete' })));
        expect(html()).toBe('<details open=""><summary>Sum</summary><p></p></details>');
    });

    it('Delete at the end of a closed summary leaves its hidden body alone, an empty first line too', () => {
        mount('<details><summary>S</summary><p></p><p>x</p></details>');
        editor.commands.setTextSelection(textPos('S') + 1);
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Delete' })));
        expect(html()).toBe('<details><summary>S</summary><p></p><p>x</p></details>');
    });

    it('Delete at the end of a closed body\'s last line, pulling the next block in, opens the disclosure', () => {
        mount('<details><summary>A</summary><p>abody</p></details><p>after</p>');
        editor.commands.setTextSelection(textPos('abody') + 5);
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Delete' })));
        expect(editor.state.doc.firstChild.attrs.open).toBe(true);
        expect(html()).toContain('after');
        // Delete within the body (two of its lines joined) leaves it closed.
        editor.commands.setContent('<details><summary>A</summary><p>one</p><p>two</p></details>');
        editor.commands.setTextSelection(textPos('one') + 3);
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Delete' })));
        expect(html()).toBe('<details><summary>A</summary><p>onetwo</p></details>');
    });

    it('setDetails in a summary does nothing (a summary is one line: no blocks to wrap)', () => {
        editor = createEditor({ content: '<details open><summary>Hello</summary><p>b</p></details>' });
        editor.commands.setTextSelection(textPos('Hello') + 2);
        const before = editor.getHTML();
        expect(editor.commands.setDetails()).toBe(false);
        expect(editor.getHTML()).toBe(before);
    });

    it('Delete at the end of the summary leaves the body alone', () => {
        mount('<details open><summary>Sum</summary><p>Body</p></details>');
        editor.commands.setTextSelection(textPos('Sum') + 3);
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Delete' })));
        expect(html()).toBe('<details open=""><summary>Sum</summary><p>Body</p></details>');
    });

    it('Backspace at the start of the summary unwraps the disclosure', () => {
        mount('<details><summary>S</summary><p>x</p></details>');
        editor.commands.setTextSelection(textPos('S'));
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'Backspace' })));
        expect(html()).toBe('<p>S</p><p>x</p>');
    });

    it('wraps in a table cell; in a list item, which must start with a paragraph, wraps the list', () => {
        editor = createEditor({ content: '<ul><li><p>item</p></li></ul><table><tbody><tr><td><p>cell</p></td></tr></tbody></table>' });
        editor.commands.setTextSelection(textPos('cell') + 1);
        expect(editor.commands.setDetails()).toBe(true);
        editor.state.doc.check();
        editor.commands.unsetDetails();
        editor.state.doc.check();
        editor.commands.setTextSelection(textPos('item') + 1);
        expect(editor.commands.setDetails()).toBe(true);
        expect(editor.getHTML()).toContain('<details open=""><summary>Details</summary><ul><li><p>item</p></li></ul></details>');
    });

    it('a block put in the summary, by any command, goes to the start of the body, the disclosure kept whole', () => {
        const start = '<details><summary>Title here</summary><p>body</p></details><p>after</p>';
        editor = createEditor({ content: start });
        const at = () => textPos('here');
        const cases = [
            [() => editor.commands.insertContent({ type: 'horizontalRule' }), '<hr>'],
            [() => editor.commands.setHorizontalRule(), '<hr>'],
            [() => editor.commands.insertContent('<p>blk</p>'), '<p>blk</p>'],
            [() => editor.commands.insertTable({ rows: 1, cols: 1, withHeaderRow: false }), '<table>'],
        ];
        for (const [insert, expected] of cases) {
            editor.commands.setContent(start);
            editor.commands.setTextSelection(at());
            insert();
            const out = html();
            expect(out.startsWith(`<details open=""><summary>Title here</summary>${expected}`)).toBe(true);
            expect(out.endsWith('<p>body</p></details><p>after</p>')).toBe(true);
        }
        // Text still goes where the cursor is.
        editor.commands.setContent(start);
        editor.commands.setTextSelection(at());
        editor.commands.insertContent('x');
        expect(html()).toBe('<details><summary>Title xhere</summary><p>body</p></details><p>after</p>');
        // One undo takes the block back out, the disclosure as it was.
        editor.destroy();
        editor = createEditor({ content: start });
        editor.commands.setTextSelection(at());
        editor.commands.insertContent({ type: 'horizontalRule' });
        editor.commands.undo();
        expect(html()).toBe(start);
    });

    it('a block put in the summary after other changes in the same chain still keeps it whole', () => {
        editor = createEditor({ content: '<details><summary>Title here</summary><p>body</p></details>' });
        editor.commands.setTextSelection(textPos('here'));
        editor.chain()
            .command(({ tr }) => { tr.insert(0, editor.schema.nodes.paragraph.create(null, editor.schema.text('New'))); return true; })
            .insertContent('<p>blk</p>')
            .run();
        expect(html()).toBe('<p>New</p><details open=""><summary>Title here</summary><p>blk</p><p>body</p></details>');
    });

    it('a block put in an empty summary of a closed disclosure opens it', () => {
        globalThis.ClipboardEvent ??= class extends Event { constructor(type, init) { super(type, init); this.clipboardData = init?.clipboardData ?? null; } };
        mount('<details><summary></summary><p>x</p></details><p>after</p>');
        editor.commands.setTextSelection(2);
        editor.commands.insertContent('<p>one</p>');
        expect(html()).toBe('<details open=""><summary></summary><p>one</p><p>x</p></details><p>after</p>');
        editor.commands.setContent('<details><summary></summary><p>x</p></details><p>after</p>');
        editor.commands.setTextSelection(2);
        editor.view.pasteHTML('<hr>');
        expect(editor.state.doc.firstChild.attrs.open).toBe(true);
        // Typing in a summary changes no body: a closed disclosure stays closed.
        editor.commands.setContent('<details><summary></summary><p>x</p></details>');
        editor.commands.setTextSelection(2);
        editor.commands.insertContent('Title');
        expect(html()).toBe('<details><summary>Title</summary><p>x</p></details>');
    });

    it('a selection from the summary to past the disclosure is replaced in place', () => {
        editor = createEditor({ content: '<details><summary>Title here</summary><p>body</p></details><p>after</p>' });
        editor.commands.setTextSelection({ from: textPos('here'), to: textPos('after') + 2 });
        editor.commands.insertContent('<p>blk</p>');
        expect(html()).toBe('<details><summary>Title </summary><p>blk</p></details><p>ter</p>');
    });

    it('a block pasted in the summary goes to the start of the body; lines and text paste in place', () => {
        // The test environment has no ClipboardEvent, which pasteHTML builds its event with.
        globalThis.ClipboardEvent ??= class extends Event { constructor(type, init) { super(type, init); this.clipboardData = init?.clipboardData ?? null; } };
        const start = '<details><summary>Sum</summary><p>Body</p></details>';
        mount(start);
        editor.commands.setTextSelection({ from: 2, to: 3 });
        editor.view.pasteHTML('<hr>');
        expect(html()).toBe('<details open=""><summary>um</summary><hr><p>Body</p></details>');
        editor.commands.setContent(start);
        editor.commands.setTextSelection(2);
        editor.view.pasteHTML('<h2>Head</h2>');
        expect(html()).toBe('<details><summary>HeadSum</summary><p>Body</p></details>');
    });
});

describe('Details: the toggle', () => {
    const toggle = () => element.querySelector('.inscript-details-toggle');
    const view = () => element.querySelector('.inscript-details');

    it('in an editable editor, opens and closes the disclosure in the document', () => {
        mount('<details><summary>S</summary><p>x</p></details>');
        expect(view().hasAttribute('data-open')).toBe(false);
        expect(toggle().getAttribute('aria-expanded')).toBe('false');
        expect(toggle().getAttribute('aria-label')).toBe('Show content');
        toggle().click();
        expect(editor.state.doc.firstChild.attrs.open).toBe(true);
        expect(view().hasAttribute('data-open')).toBe(true);
        expect(toggle().getAttribute('aria-expanded')).toBe('true');
        expect(toggle().getAttribute('aria-label')).toBe('Hide content');
    });

    it('in a read-only editor, opens it for the reader only', () => {
        mount('<details><summary>S</summary><p>x</p></details>', { editable: false });
        const before = editor.getHTML();
        toggle().click();
        expect(view().hasAttribute('data-open')).toBe(true);
        expect(editor.getHTML()).toBe(before);
        // Editable again, the document decides once more.
        editor.setEditable(true);
        expect(view().hasAttribute('data-open')).toBe(false);
    });

    it('a selection starting in a closed body and ending after it shows the body', () => {
        mount('<details><summary>S</summary><p>Body</p></details><p>After</p>');
        editor.commands.setTextSelection({ from: textPos('Body') + 1, to: textPos('After') + 2 });
        expect(view().hasAttribute('data-reveal')).toBe(true);
    });

    it('closing it keeps the part of a selection outside it, and hides the body for a reversed one', () => {
        mount('<p>before</p><details open><summary>Sum</summary><p>Body</p></details>');
        const body = textPos('Body') + 2;
        editor.commands.setTextSelection({ from: 2, to: body });
        toggle().click();
        expect(editor.state.selection.from).toBe(2);
        expect(view().hasAttribute('data-reveal')).toBe(false);
        toggle().click();
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, body, 2)));
        toggle().click();
        expect(view().hasAttribute('data-reveal')).toBe(false);
    });

    it('closing it with a selection from its body to past it keeps the part after it, either way round', () => {
        mount('<details open><summary>Sum</summary><p>Body</p></details><p>After</p>');
        const body = textPos('Body') + 2;
        const after = textPos('After');
        editor.commands.setTextSelection({ from: body, to: after + 3 });
        toggle().click();
        expect(editor.state.selection.from).toBe(after);
        expect(editor.state.selection.to).toBe(after + 3);
        expect(view().hasAttribute('data-reveal')).toBe(false);
        toggle().click();
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, after + 3, body)));
        toggle().click();
        expect(editor.state.selection.anchor).toBe(after + 3);
        expect(editor.state.selection.head).toBe(after);
        expect(view().hasAttribute('data-reveal')).toBe(false);
    });

    it('read-only, the selection taken into a closed body (the outline\'s link) opens it for the reader', () => {
        mount('<p>top</p><details><summary>S</summary><h2>Deep</h2></details>', { editable: false });
        expect(view().hasAttribute('data-open')).toBe(false);
        editor.commands.setTextSelection(textPos('Deep') + 1);
        expect(view().hasAttribute('data-open')).toBe(true);
        expect(editor.state.doc.child(1).attrs.open).toBe(false);
        // The reader can close it again, the selection still there: the body hides (the
        // editor's stylesheet, which tests do not load otherwise).
        const style = document.createElement('style');
        style.textContent = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8');
        document.head.appendChild(style);
        try {
            toggle().click();
            expect(view().hasAttribute('data-open')).toBe(false);
            expect(getComputedStyle(editor.view.dom.querySelector('h2')).display).toBe('none');
        } finally { style.remove(); }
    });

    it('the --- rule typed in an empty summary goes to the start of the body, the disclosure kept whole', () => {
        mount('<details><summary></summary><p>body</p></details>');
        editor.commands.setTextSelection(2);
        for (const ch of '---') {
            const { from, to } = editor.state.selection;
            if (!editor.view.someProp('handleTextInput', f => f(editor.view, from, to, ch))) editor.view.dispatch(editor.state.tr.insertText(ch));
        }
        let disclosures = 0;
        editor.state.doc.descendants(node => { if (node.type.name === 'details') disclosures++; });
        expect(disclosures).toBe(1);
        expect(html()).toContain('<hr><p>body</p></details>');
    });

    it('a reader\'s own open state is not carried over to a different disclosure loaded in its place', () => {
        mount('<details><summary>S</summary><p>x</p></details>', { editable: false });
        toggle().click();
        expect(view().hasAttribute('data-open')).toBe(true);
        editor.commands.setContent('<details><summary>T</summary><p>y</p></details>');
        expect(view().hasAttribute('data-open')).toBe(false);
        expect(toggle().getAttribute('aria-expanded')).toBe('false');
    });

    it('a reader\'s own open state is cleared when the editor becomes editable without an update event', () => {
        mount('<details><summary>S</summary><p>x</p></details>', { editable: false });
        toggle().click();
        expect(view().hasAttribute('data-open')).toBe(true);
        editor.setEditable(true, false);
        expect(view().hasAttribute('data-open')).toBe(false);
    });

    it('a reader\'s own open state is cleared on becoming editable in an editor built without the host bridge too', async () => {
        const { Editor } = await import('@tiptap/core');
        const { buildExtensions } = await import('./index.js');
        element = document.createElement('div');
        document.body.appendChild(element);
        editor = new Editor({ element, extensions: buildExtensions().filter(e => e.name !== 'hostBridge'), content: '<details><summary>S</summary><p>x</p></details>', editable: false });
        toggle().click();
        expect(view().hasAttribute('data-open')).toBe(true);
        editor.setEditable(true);
        expect(view().hasAttribute('data-open')).toBe(false);
    });

    it('on a closed body the cursor shows, the toggle says Hide and hides it', () => {
        mount('<details><summary>S</summary><p>body</p></details>');
        editor.commands.setTextSelection(textPos('body') + 1);
        expect(toggle().getAttribute('aria-expanded')).toBe('true');
        expect(toggle().getAttribute('aria-label')).toBe('Hide content');
        toggle().click();
        expect(editor.state.doc.firstChild.attrs.open).toBe(false);
        expect(view().hasAttribute('data-reveal')).toBe(false);
        expect(toggle().getAttribute('aria-expanded')).toBe('false');
    });

    it('closing with a selection covering the whole disclosure (select-all) hides it', () => {
        mount('<p>a</p><details open><summary>S</summary><p>body</p></details><p>z</p>');
        editor.commands.selectAll();
        toggle().click();
        expect(editor.state.doc.child(1).attrs.open).toBe(false);
        expect(view().hasAttribute('data-reveal')).toBe(false);
    });

    it('a disclosure selected as a whole is not opened by being selected', () => {
        mount('<p>a</p><details><summary>S</summary><p>body</p></details>');
        editor.commands.setNodeSelection(3);
        expect(view().hasAttribute('data-reveal')).toBe(false);
    });

    it('setDetailsOpen(false) with the cursor in the body hides it', () => {
        mount('<details open><summary>S</summary><p>body</p></details>');
        editor.commands.setTextSelection(textPos('body') + 1);
        editor.commands.setDetailsOpen(false);
        expect(view().hasAttribute('data-reveal')).toBe(false);
    });

    it('a selection holding a whole closed disclosure (a drag over it) leaves it closed; part of its body shows it', () => {
        mount('<p>above</p><details><summary>S</summary><p>hidden</p></details><p>below</p>');
        editor.commands.setTextSelection({ from: 2, to: textPos('below') + 2 });
        expect(view().hasAttribute('data-reveal')).toBe(false);
        expect(view().hasAttribute('data-open')).toBe(false);
        // From the summary on past it: part of the disclosure, all of its body, shown.
        editor.commands.setTextSelection({ from: textPos('S') + 1, to: textPos('below') + 2 });
        expect(view().hasAttribute('data-open')).toBe(true);
    });

    it('closing with a selection holding the whole disclosure keeps that selection', () => {
        mount('<p>above</p><details open><summary>S</summary><p>body</p></details><p>below</p>');
        editor.commands.setTextSelection({ from: 2, to: textPos('below') + 2 });
        const { from, to } = editor.state.selection;
        toggle().click();
        expect(editor.state.doc.child(1).attrs.open).toBe(false);
        expect([editor.state.selection.from, editor.state.selection.to]).toEqual([from, to]);
        expect(view().hasAttribute('data-open')).toBe(false);
    });

    it('read-only, a drag selection over a closed disclosure does not open it for the reader', () => {
        mount('<p>above</p><details><summary>S</summary><p>hidden</p></details><p>below</p>', { editable: false });
        editor.commands.setTextSelection({ from: textPos('S') + 1, to: textPos('below') + 2 });
        editor.commands.setTextSelection(2);
        expect(view().hasAttribute('data-open')).toBe(false);
    });

    it('setDetails refuses a selection of table cells (one disclosure cannot hold them)', () => {
        editor = createEditor({ content: '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>' });
        const cells = [];
        editor.state.doc.descendants((node, pos) => { if (node.type.name === 'tableCell') cells.push(pos); });
        editor.commands.setCellSelection({ anchorCell: cells[0], headCell: cells[1] });
        expect(editor.can().toggleDetails()).toBe(false);
        expect(editor.commands.setDetails()).toBe(false);
    });

    it('closing it with a selection reaching into its body hides the body too', () => {
        mount('<p>above</p><details open><summary>S</summary><p>body</p></details>');
        editor.commands.setTextSelection({ from: 2, to: textPos('body') + 2 });
        toggle().click();
        expect(view().hasAttribute('data-reveal')).toBe(false);
    });

    it('closing it with the cursor in its body moves the cursor to the summary, and the body hides', () => {
        mount('<details open><summary>S</summary><p>body</p></details>');
        editor.commands.setTextSelection(textPos('body') + 2);
        toggle().click();
        expect(editor.state.doc.firstChild.attrs.open).toBe(false);
        expect(editor.state.selection.$from.parent.type.name).toBe('detailsSummary');
        expect(view().hasAttribute('data-reveal')).toBe(false);
    });

    it('a closed disclosure shows its body while the cursor is in it, not while it is in the summary', () => {
        mount('<details><summary>S</summary><p>x</p></details><p>after</p>');
        editor.commands.setTextSelection(textPos('S') + 1);
        expect(view().hasAttribute('data-reveal')).toBe(false);
        editor.commands.setTextSelection(textPos('x') + 1);
        expect(view().hasAttribute('data-reveal')).toBe(true);
        editor.commands.setTextSelection(textPos('after') + 1);
        expect(view().hasAttribute('data-reveal')).toBe(false);
    });
});
