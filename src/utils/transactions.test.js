import { afterEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { changedRange, perTransaction, replacesWholeDocument, touchesNodes } from './transactions.js';

let editor;
afterEach(() => { editor?.destroy(); editor = null; });

describe('transaction helpers', () => {
    it('changedRange covers what steps put in, and attribute and mark steps', () => {
        editor = createEditor({ content: '<p>abc</p><p>def</p>' });
        const { state } = editor;
        expect(changedRange([state.tr.insertText('X', 2)])).toEqual({ from: 2, to: 3 });
        expect(changedRange([state.tr.setNodeAttribute(0, 'textAlign', 'center')])).toEqual({ from: 0, to: 1 });
        expect(changedRange([state.tr.addMark(1, 3, state.schema.marks.bold.create())])).toEqual({ from: 1, to: 3 });
        expect(changedRange([state.tr])).toBeNull();
    });

    it('touchesNodes sees a node put in, taken out or changed, and (whole) not text typed inside one', () => {
        editor = createEditor({ content: '<p>abc</p><pre><code>x</code></pre>' });
        const { state } = editor;
        const isCode = node => node.type.name === 'codeBlock';
        const inCode = state.doc.firstChild.nodeSize + 1;
        expect(touchesNodes(state.tr.insertText('y', inCode), isCode)).toBe(true);
        expect(touchesNodes(state.tr.insertText('y', inCode), isCode, { whole: true })).toBe(false);
        expect(touchesNodes(state.tr.insertText('y', 2), isCode)).toBe(false);
        expect(touchesNodes(state.tr.delete(state.doc.firstChild.nodeSize, state.doc.content.size), isCode, { whole: true })).toBe(true);
    });

    it('perTransaction works a check out once per transaction', () => {
        let runs = 0;
        const check = perTransaction(() => { runs += 1; return runs; });
        editor = createEditor({ content: '<p>a</p>' });
        const tr = editor.state.tr;
        expect([check(tr), check(tr)]).toEqual([1, 1]);
        expect(check(editor.state.tr)).toBe(2);
    });

    it('replacesWholeDocument tells a whole replacement from an edit', () => {
        editor = createEditor({ content: '<p>a</p>' });
        const { state } = editor;
        expect(replacesWholeDocument(state.tr.replaceWith(0, state.doc.content.size, state.schema.nodes.paragraph.create()))).toBe(true);
        expect(replacesWholeDocument(state.tr.insertText('b', 1))).toBe(false);
    });
});
