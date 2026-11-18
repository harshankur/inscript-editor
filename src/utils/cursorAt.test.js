import { afterEach, describe, expect, it } from 'vitest';
import { TextSelection } from '@tiptap/pm/state';
import { GapCursor } from '@tiptap/pm/gapcursor';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { cursorAt } from './cursorAt.js';

let editor;
afterEach(() => { editor?.destroy(); editor = null; });
const docOf = html => { editor = createEditor({ content: html }); return editor.state.doc; };
const startOf = (doc, name, nth = 0) => { const found = []; doc.forEach((node, offset) => { if (node.type.name === name) found.push(offset); }); return found[nth]; };

describe('cursorAt', () => {
    it('is the position itself in a line', () => {
        const doc = docOf('<p>abc</p>');
        const cursor = cursorAt(doc, 2);
        expect(cursor instanceof TextSelection && cursor.head).toBe(2);
    });

    it('goes into the next block\'s first line when one starts right there (a list\'s first item too)', () => {
        const doc = docOf('<hr><ul><li><p>item</p></li></ul>');
        const cursor = cursorAt(doc, startOf(doc, 'bulletList'));
        expect(cursor.$head.parent.textContent).toBe('item');
    });

    it('is a gap cursor between blocks that hold no cursor', () => {
        const doc = docOf('<p>a</p><hr><hr><p>b</p>');
        const cursor = cursorAt(doc, startOf(doc, 'horizontalRule', 1));
        expect(cursor instanceof GapCursor).toBe(true);
    });

    it('is the end of the line before when nothing else can be there', () => {
        const doc = docOf('<p>abc</p><table><tbody><tr><td><p>x</p></td></tr></tbody></table>');
        const cursor = cursorAt(doc, startOf(doc, 'table'));
        expect(cursor instanceof TextSelection && cursor.$head.parent.textContent).toBe('abc');
    });
});
