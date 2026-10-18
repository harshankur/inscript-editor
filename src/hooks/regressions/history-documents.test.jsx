// Metadata passed to loadContent, guards across editor replacement, and a document switch while
// the editor is hidden.
import { Activity } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from '../useInscriptEditor.js';

const idle = (ms = 1000) => act(() => { vi.advanceTimersByTime(ms); });
const type = (editor, text) => act(() => { editor.commands.insertContent(text); });

let api;
let calls;
const onContentChange = (entry, info) => calls.push({ entry, reason: info?.reason });
function Host(props) {
    api = useInscriptEditor({ onContentChange, ...props });
    return null;
}
const tree = ({ mode = 'visible', ...props } = {}) => <Activity mode={mode}><Host {...props} /></Activity>;

beforeEach(() => { vi.useFakeTimers(); calls = []; });
afterEach(() => { vi.useRealTimers(); });

describe('metadata given to loadContent', () => {
    // loadContent documents title/tags/categories as the document's metadata. A host that keeps
    // metadata in loadContent (and passes no tags prop) must not see the next edit drop them.
    it('tags passed to loadContent survive a re-render and are kept by the next edit', () => {
        const { result, rerender } = renderHook(() => useInscriptEditor({ contentKey: 'a', onContentChange }));
        act(() => { result.current.loadContent('<p>A</p>', { title: 'T', tags: ['x'], categories: ['c'] }); });
        rerender();
        type(result.current.editor, '!'); idle();
        expect(result.current.history.map(e => [e.title, e.tags, e.categories])).toEqual([
            ['T', ['x'], ['c']],
            ['T', ['x'], ['c']],
        ]);
    });

    it('the same with inline tags/categories props (a fresh array each render) that equal the loaded ones', () => {
        const { result, rerender } = renderHook(
            ({ tags }) => useInscriptEditor({ contentKey: 'a', tags: [...tags], categories: [], onContentChange }),
            { initialProps: { tags: [] } },
        );
        // The host loads the document with its metadata, then renders with it.
        act(() => { result.current.loadContent('<p>A</p>', { tags: ['x'] }); });
        rerender({ tags: [] });   // the host has not caught up yet (same value as before)
        type(result.current.editor, '!'); idle();
        expect(result.current.history[1].tags).toEqual(['x']);
    });
});

describe('guards across an editor replacement', () => {
    it('typing dropped by a read-only flip is recorded once editable again, even if the editor was recreated meanwhile', () => {
        const { rerender } = render(tree({ contentKey: 'k1', documentKey: 'd' }));
        act(() => { api.loadContent('<p>Doc</p>'); });
        type(api.editor, ' typed');
        rerender(tree({ contentKey: 'k1', documentKey: 'd', isReadonly: true }));
        rerender(tree({ contentKey: 'k2', documentKey: 'd', isReadonly: true }));    // recreated (same document)
        idle(2000);
        rerender(tree({ contentKey: 'k2', documentKey: 'd', isReadonly: false }));
        idle(2000);
        expect(api.editor.getHTML()).toBe('<p>Doc typed</p>');
        // Control: without the recreation the same typing IS recorded here (see the next test).
        expect(api.history.map(e => e.html)).toEqual(['<p>Doc</p>', '<p>Doc typed</p>']);
    });

    it('(control) without the recreation, the typing is recorded once editable again', () => {
        const { rerender } = render(tree({ contentKey: 'k1', documentKey: 'd' }));
        act(() => { api.loadContent('<p>Doc</p>'); });
        type(api.editor, ' typed');
        rerender(tree({ contentKey: 'k1', documentKey: 'd', isReadonly: true }));
        idle(2000);
        rerender(tree({ contentKey: 'k1', documentKey: 'd', isReadonly: false }));
        idle(2000);
        expect(api.history.map(e => e.html)).toEqual(['<p>Doc</p>', '<p>Doc typed</p>']);
    });
});

describe('a document switch while the editor is hidden', () => {
    it("never records the previous document's typing as the next document's first version", () => {
        const { rerender } = render(tree({ contentKey: 'k', documentKey: 'a' }));
        act(() => { api.loadContent('<p>Document A</p>'); });
        type(api.editor, ' typed in A');
        rerender(tree({ contentKey: 'k', documentKey: 'a', mode: 'hidden' }));
        rerender(tree({ contentKey: 'k', documentKey: 'b', mode: 'hidden' }));
        rerender(tree({ contentKey: 'k', documentKey: 'b' }));
        idle(3000);
        expect(api.history).toEqual([]);
        // A's typing was recorded for A when the effects were torn down; nothing for B.
        expect(calls.map(c => [c.reason, c.entry.html])).toEqual([['edit', '<p>Document A typed in A</p>']]);
    });
});

describe('an "empty-looking" document across an editor replacement', () => {
    // TipTap's isEmpty is true for a table (or list, quote, heading) whose cells hold no text. An
    // edit a guard kept out of the history is then not believed by the replacement editor.
    it('an empty table inserted just before a read-only flip survives an editorOptions change', () => {
        const { rerender } = render(tree({ contentKey: 'k', editorOptions: { slashCommand: true } }));
        act(() => { api.loadContent(''); });
        act(() => { api.editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false }); });
        const withTable = api.editor.getHTML();
        expect(withTable).toContain('<table');
        rerender(tree({ contentKey: 'k', editorOptions: { slashCommand: true }, isReadonly: true }));
        idle(2000);
        rerender(tree({ contentKey: 'k', editorOptions: { slashCommand: false }, isReadonly: true }));
        expect(api.editor.getHTML()).toBe(withTable);
    });
});

describe('metadata given to loadContent across an effect re-run', () => {
    // An <Activity> hide/show (or Fast Refresh) re-runs the
    // title/tags/categories ref effects, which put the props back over what loadContent set.
    it('the title passed to loadContent is still the one recorded after a hide/show', () => {
        const { rerender } = render(tree({ contentKey: 'k', documentKey: 'd', title: 'Prop title' }));
        act(() => { api.loadContent('<p>Doc</p>', { title: 'Loaded title' }); });
        type(api.editor, '!'); idle();
        expect(api.history.map(e => e.title)).toEqual(['Loaded title', 'Loaded title']);
        rerender(tree({ contentKey: 'k', documentKey: 'd', title: 'Prop title', mode: 'hidden' }));
        rerender(tree({ contentKey: 'k', documentKey: 'd', title: 'Prop title' }));
        type(api.editor, '?'); idle();
        expect(api.history.map(e => e.title)).toEqual(['Loaded title', 'Loaded title', 'Loaded title']);
    });
});
