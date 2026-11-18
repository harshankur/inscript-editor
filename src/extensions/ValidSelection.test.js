import { afterEach, describe, expect, it } from 'vitest';
import { TextSelection } from '@tiptap/pm/state';
import { GapCursor } from '@tiptap/pm/gapcursor';
import { createEditor } from '../../tests/helpers/createEditor.js';

let editor;
afterEach(() => { editor?.destroy(); editor = null; });

describe('ValidSelection', () => {
    it('moves a text cursor a command left between blocks into the nearest text', () => {
        editor = createEditor({ content: '<h1>e</h1><ol><li><p>a</p><hr><hr></li></ol><p>z</p>' });
        // A cursor in the list item itself, between its blocks (as TipTap 3.34's divider leaves one).
        let between = null;
        editor.state.doc.descendants((node, pos) => {
            if (between === null && node.type.name === 'horizontalRule') between = pos + node.nodeSize;
        });
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, between)));
        // Between the two rules in the item: a gap cursor right there.
        expect(editor.state.selection instanceof GapCursor).toBe(true);
        expect(editor.state.selection.head).toBe(between);
    });

    it('keeps a stray cursor beside a video where it is (a gap cursor), never selecting the video', () => {
        editor = createEditor({ content: '<div data-youtube-video="dQw4w9WgXcQ"></div><p>after</p>' });
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 0)));
        const { selection } = editor.state;
        // Before the video, at the top: a gap cursor right there (never the video selected).
        expect(selection instanceof GapCursor).toBe(true);
        expect(selection.head).toBe(0);
    });

    it('keeps a stray cursor between two videos where it is, far from any text', () => {
        editor = createEditor({ content: '<p>top</p><div data-youtube-video="dQw4w9WgXcQ"></div><div data-youtube-video="dQw4w9WgXcQ"></div><p>far</p>' });
        let between = null;
        let videos = 0;
        editor.state.doc.forEach((node, offset) => { if (node.type.name === 'youtube' && (videos += 1) === 1) between = offset + node.nodeSize; });
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, between)));
        expect(editor.state.selection instanceof GapCursor).toBe(true);
        expect(editor.state.selection.head).toBe(between);
    });

    it('a divider put in over a selection running from a heading into a list leaves the cursor in text', () => {
        editor = createEditor({ content: '<h1>head</h1><ol><li><p>item</p></li></ol>' });
        let start = null;
        let end = null;
        editor.state.doc.descendants((node, pos) => {
            if (node.isText && node.text === 'head') start = pos + 2;
            if (node.isText && node.text === 'item') end = pos + 2;
        });
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, start, end)));
        editor.commands.setHorizontalRule();
        const { selection } = editor.state;
        // A cursor in text or a gap cursor, never one in no block.
        expect(selection instanceof GapCursor || (selection instanceof TextSelection && selection.$head.parent.inlineContent)).toBe(true);
        expect(selection instanceof TextSelection && !selection.$head.parent.inlineContent).toBe(false);
    });
});

describe('ValidSelection, a range', () => {
    it('leaves a range as it is: select-all on a document opening with a video holds the video', () => {
        editor = createEditor({ content: '<div data-youtube-video="dQw4w9WgXcQ"></div><p>after text</p>' });
        editor.commands.setTextSelection({ from: 0, to: editor.state.doc.content.size });
        // From before the video (TipTap ends it at the last text): the video is in the range.
        expect(editor.state.selection.from).toBe(0);
        expect(editor.state.doc.firstChild.type.name).toBe('youtube');
    });

    it('moves a stray cursor against a block into that block, not back over a divider', () => {
        editor = createEditor({ content: '<p>a</p><hr><p>b</p>' });
        let before = null;
        editor.state.doc.descendants((node, pos) => { if (node.isText && node.text === 'b') before = pos - 1; });
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, before)));
        expect(editor.state.selection.$head.parent.textContent).toBe('b');
    });
});
