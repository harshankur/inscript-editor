import { afterEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';

let editor;
afterEach(() => editor?.destroy());

const keys = () => {
    const found = [];
    editor.state.doc.descendants(node => { if (node.type.name === 'keyboardInput') found.push(node.attrs.text); });
    return found;
};
const keyPos = text => {
    let pos = null;
    editor.state.doc.descendants((node, p) => { if (pos === null && node.type.name === 'keyboardInput' && node.attrs.text === text) pos = p; });
    return pos;
};

describe('KeyboardInput', () => {
    it('parses and renders <kbd>, each key a token of its own', () => {
        editor = createEditor({ content: '<p>Press <kbd>Ctrl</kbd>+<kbd>S</kbd></p>' });
        expect(editor.getHTML()).toBe('<p>Press <kbd>Ctrl</kbd>+<kbd>S</kbd></p>');
        expect(keys()).toEqual(['Ctrl', 'S']);
        expect(editor.getText()).toBe('Press Ctrl+S');
    });

    it('keeps two keys side by side as two keys, however they came to meet', () => {
        editor = createEditor({ content: '<p><kbd>Ctrl</kbd><kbd>S</kbd></p>' });
        expect(editor.getHTML()).toBe('<p><kbd>Ctrl</kbd><kbd>S</kbd></p>');
        editor.commands.setContent('<p><kbd>Ctrl</kbd>+<kbd>S</kbd></p>');
        editor.commands.deleteRange({ from: 2, to: 3 });
        expect(editor.getHTML()).toBe('<p><kbd>Ctrl</kbd><kbd>S</kbd></p>');
        editor.commands.setTextSelection(2);
        editor.commands.insertContent('<kbd>Alt</kbd>');
        expect(keys()).toEqual(['Ctrl', 'Alt', 'S']);
    });

    it('the same HTML always reads to the same document', () => {
        const html = '<p><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>P</kbd> and <strong><kbd>Esc</kbd></strong></p>';
        editor = createEditor({ content: html });
        const first = JSON.stringify(editor.getJSON());
        editor.commands.setContent(html);
        expect(JSON.stringify(editor.getJSON())).toBe(first);
        expect(editor.getHTML()).toBe(html);
    });

    it('setKeyboardInput makes the selected text a key, keeping its formatting', () => {
        editor = createEditor({ content: '<p><strong>Esc</strong> to close</p>' });
        editor.commands.setTextSelection({ from: 1, to: 4 });
        expect(editor.commands.setKeyboardInput()).toBe(true);
        expect(editor.getHTML()).toBe('<p><strong><kbd>Esc</kbd></strong> to close</p>');
    });

    it('unsetKeyboardInput turns the selected key back into its text, selected', () => {
        editor = createEditor({ content: '<p><kbd>Esc</kbd> to close</p>' });
        editor.commands.setNodeSelection(keyPos('Esc'));
        expect(editor.commands.unsetKeyboardInput()).toBe(true);
        expect(editor.getHTML()).toBe('<p>Esc to close</p>');
        const { from, to } = editor.state.selection;
        expect(editor.state.doc.textBetween(from, to)).toBe('Esc');
    });

    it('unsetKeyboardInput turns the keys in a selected range back into text, the range still selected', () => {
        editor = createEditor({ content: '<p>a <kbd>Ctrl</kbd><kbd>S</kbd> b</p>' });
        const from = keyPos('Ctrl');
        editor.commands.setTextSelection({ from, to: from + 2 });
        expect(editor.isActive('keyboardInput')).toBe(true);
        expect(editor.can().toggleKeyboardInput()).toBe(true);
        editor.commands.toggleKeyboardInput();
        expect(editor.getHTML()).toBe('<p>a CtrlS b</p>');
        const { from: start, to: end } = editor.state.selection;
        expect(editor.state.doc.textBetween(start, end)).toBe('CtrlS');
    });

    it('unsetKeyboardInput under select-all leaves a valid selection', () => {
        editor = createEditor({ content: '<p>a <kbd>K</kbd> b</p><p>c</p>' });
        editor.commands.selectAll();
        expect(editor.commands.unsetKeyboardInput()).toBe(true);
        expect(editor.getHTML()).toBe('<p>a K b</p><p>c</p>');
        expect(editor.state.selection.$from.parent.inlineContent).toBe(true);
        expect(editor.state.selection.$to.parent.inlineContent).toBe(true);
    });

    it('its text is the node\'s text (a heading of keys reads whole, a cell holding one is not empty)', () => {
        editor = createEditor({ content: '<h2>Press <kbd>Ctrl</kbd>+<kbd>K</kbd></h2>' });
        expect(editor.state.doc.firstChild.textContent).toBe('Press Ctrl+K');
        expect(editor.state.doc.textBetween(0, editor.state.doc.content.size)).toBe('Press Ctrl+K');
    });

    it('toggleKeyboardInput does whichever applies, and nothing with only a cursor', () => {
        editor = createEditor({ content: '<p>Esc</p>' });
        editor.commands.setTextSelection({ from: 1, to: 4 });
        editor.commands.toggleKeyboardInput();
        expect(keys()).toEqual(['Esc']);
        editor.commands.setNodeSelection(keyPos('Esc'));
        editor.commands.toggleKeyboardInput();
        expect(keys()).toEqual([]);
        editor.commands.setTextSelection(2);
        expect(editor.can().toggleKeyboardInput()).toBe(false);
    });

    it('refuses a selection across blocks, or one that already holds a key', () => {
        editor = createEditor({ content: '<p>a <kbd>X</kbd> b</p><p>c</p>' });
        editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });
        expect(editor.commands.setKeyboardInput()).toBe(false);
        editor.commands.setTextSelection({ from: 1, to: 6 });
        expect(editor.commands.setKeyboardInput()).toBe(false);
    });

    it('refuses a code block, and a selection holding a line break or another inline token', () => {
        editor = createEditor({ content: '<pre><code>ctrl s</code></pre><p>foo<br>bar baz</p>' });
        editor.commands.setTextSelection({ from: 1, to: 5 });
        expect(editor.commands.setKeyboardInput()).toBe(false);
        const start = editor.state.doc.firstChild.nodeSize + 1;
        editor.commands.setTextSelection({ from: start, to: start + 8 });
        expect(editor.commands.setKeyboardInput()).toBe(false);
        expect(editor.getHTML()).toContain('<pre><code>ctrl s</code></pre><p>foo<br>bar baz</p>');
    });

    it('refuses inline code, and keeps a link on a key made from a linked word', () => {
        editor = createEditor({ content: '<p>a <code>x</code> b <a href="https://x.com">Ctrl</a> c</p>' }, { link: { autolink: false } });
        editor.commands.setTextSelection({ from: 3, to: 4 });
        expect(editor.commands.setKeyboardInput()).toBe(false);
        let link = null;
        editor.state.doc.descendants((node, pos) => { if (link === null && node.isText && node.text === 'Ctrl') link = pos; });
        editor.commands.setTextSelection({ from: link, to: link + 4 });
        editor.commands.setKeyboardInput();
        expect(editor.getHTML()).toContain('<a target="_blank" rel="noopener noreferrer nofollow" href="https://x.com"><kbd>Ctrl</kbd></a>');
    });

    it('a key read from HTML holds its text as a reader sees it (spaces run together, none at the ends)', () => {
        editor = createEditor({ content: '<p><kbd> Ctrl\n </kbd>+<kbd>Page\n  Down</kbd></p>' });
        expect(keys()).toEqual(['Ctrl', 'Page Down']);
    });

    it('a <kbd> of only spaces is no key, as setKeyboardInput makes none (Markdown could not keep it)', () => {
        editor = createEditor({ content: '<p>Press <kbd> </kbd> now</p>' });
        expect(keys()).toEqual([]);
    });

    it('a key made from text formatted in part keeps only the formatting all of it shares', () => {
        editor = createEditor({ content: '<p>press <strong>ctrl</strong> now</p>' });
        let at = null;
        editor.state.doc.descendants((node, pos) => { if (at === null && node.isText && node.text === 'ctrl') at = pos; });
        editor.commands.setTextSelection({ from: at, to: at + 6 });
        editor.commands.setKeyboardInput();
        expect(editor.getHTML()).toBe('<p>press <kbd>ctrl n</kbd>ow</p>');
        editor.commands.setContent('<p><strong><em>Esc</em></strong></p>');
        editor.commands.setTextSelection({ from: 1, to: 4 });
        editor.commands.setKeyboardInput();
        expect(editor.getHTML()).toBe('<p><strong><em><kbd>Esc</kbd></em></strong></p>');
    });

    it('leaves spaces around the selected text outside the key', () => {
        editor = createEditor({ content: '<p>Press Ctrl then</p>' });
        editor.commands.setTextSelection({ from: 7, to: 12 });
        editor.commands.setKeyboardInput();
        expect(editor.getHTML()).toBe('<p>Press <kbd>Ctrl</kbd> then</p>');
    });

    it('a key made from text with spaces run together holds what reading it back gives', () => {
        editor = createEditor({ content: '<p>x</p>' });
        editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ctrl\u00a0\u00a0S' }] }] });
        editor.commands.setTextSelection({ from: 1, to: 8 });
        editor.commands.setKeyboardInput();
        expect(keys()).toEqual(['Ctrl S']);
        const html = editor.getHTML();
        editor.commands.setContent(html);
        expect(keys()).toEqual(['Ctrl S']);
    });

    it('does not make a key of only spaces', () => {
        editor = createEditor({ content: '<p>a b</p>' });
        editor.commands.setTextSelection({ from: 2, to: 3 });
        expect(editor.commands.setKeyboardInput()).toBe(false);
    });

    it('turning a key with no text back into text removes it', () => {
        editor = createEditor({ content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'keyboardInput' }] }] } });
        editor.commands.setNodeSelection(2);
        expect(() => editor.commands.unsetKeyboardInput()).not.toThrow();
        expect(editor.getHTML()).toBe('<p>a</p>');
    });

    it('an empty <kbd> is no key; a nested one is one key with the outer text', () => {
        editor = createEditor({ content: '<p>a<kbd></kbd>b <kbd><kbd>Ctrl</kbd>+<kbd>S</kbd></kbd></p>' });
        expect(keys()).toEqual(['Ctrl+S']);
    });

    it('can be turned off: <kbd> is then plain text', () => {
        editor = createEditor({ content: '<p><kbd>Tab</kbd></p>' }, { keyboardInput: false });
        expect(editor.schema.nodes.keyboardInput).toBeUndefined();
        expect(editor.getHTML()).toBe('<p>Tab</p>');
    });
});
