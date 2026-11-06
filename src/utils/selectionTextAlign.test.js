import { afterEach, describe, expect, it } from 'vitest';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { selectionTextAlign } from './selectionTextAlign.js';

let editor;
let element;
afterEach(() => { editor?.destroy(); element?.remove(); editor = null; });
const mount = (content) => {
    element = document.createElement('div');
    document.body.appendChild(element);
    editor = createEditor({ element, content });
    return editor;
};
const select = (from, to = from) => editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to)));

describe('selectionTextAlign', () => {
    it('reads the paragraph under the cursor, left for none of its own', () => {
        mount('<p style="text-align: right">a</p><p>b</p>');
        select(1);
        expect(selectionTextAlign(editor)).toBe('right');
        select(4);
        expect(selectionTextAlign(editor)).toBe('left');
    });
    it('is null across paragraphs aligned differently, and in a code block', () => {
        mount('<p style="text-align: right">a</p><p>b</p><pre><code>c</code></pre>');
        select(1, 5);
        expect(selectionTextAlign(editor)).toBe(null);
        select(8);
        expect(selectionTextAlign(editor)).toBe(null);
    });
    it('reads a table cell\'s own alignment, and a selected quote by its paragraphs', () => {
        mount('<table><tbody><tr><th style="text-align: center"><p>H</p></th></tr></tbody></table><blockquote><p style="text-align: right">q</p></blockquote>');
        select(4);
        expect(selectionTextAlign(editor)).toBe('center');
        let quote = null;
        editor.state.doc.descendants((node, pos) => { if (quote === null && node.type.name === 'blockquote') quote = pos; });
        editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, quote)));
        expect(selectionTextAlign(editor)).toBe('right');
    });
    it('is null with no view', () => {
        expect(selectionTextAlign(null)).toBe(null);
    });

    it('an empty paragraph the selection only touches at its end does not count', () => {
        mount('<p style="text-align: center">ab</p><p></p>');
        select(1, 5);
        expect(selectionTextAlign(editor)).toBe('center');
    });
});
