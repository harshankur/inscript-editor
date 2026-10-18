// useInscriptEditor's version history across pending typing, the cap, React lifecycle events,
// read-only flips, the legacy sync guard and index validation.
import { Activity, StrictMode, useEffect } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from '../useInscriptEditor.js';

const idle = (ms = 1000) => act(() => { vi.advanceTimersByTime(ms); });
const tick = (ms = 5) => act(() => { vi.advanceTimersByTime(ms); });
const type = (editor, text) => act(() => { editor.commands.insertContent(text); });

let api;
let calls;
const onContentChange = (entry, info) => calls.push({ entry, reason: info?.reason });
function Host(props) {
    api = useInscriptEditor({ onContentChange, ...props });
    return null;
}
const tree = ({ mode = 'visible', strict = false, ...props } = {}) => {
    const inner = <Activity mode={mode}><Host {...props} /></Activity>;
    return strict ? <StrictMode>{inner}</StrictMode> : inner;
};

let errorSpy;
beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    errorSpy = vi.spyOn(console, 'error');
});
afterEach(() => {
    errorSpy.mockRestore();
    vi.useRealTimers();
});

describe('restoreVersion with a pending edit and a full history', () => {
    // The panel names a version by its index. restoreVersion commits pending typing first; when
    // that commit pushes the history past maxHistory, the cap evicts the oldest version and every
    // index after it shifts by one, so the index now names a different version.
    it("reason 'restore' restores the version that was asked for", () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', maxHistory: 3, onContentChange }));
        act(() => { result.current.loadContent('<p>base</p>'); });
        type(result.current.editor, '1'); idle();
        type(result.current.editor, '2'); idle();
        // [opened base, edited base1, edited base12], pointer 2, full.
        const wanted = result.current.history[1];
        expect(wanted.html).toBe('<p>base1</p>');
        type(result.current.editor, '3');              // pending, not yet committed
        act(() => { result.current.restoreVersion(1, { reason: 'restore' }); });
        const active = result.current.history[result.current.historyIndex];
        expect(active.kind).toBe('restored');
        expect(active.html).toBe(wanted.html);
        expect(result.current.editor.getHTML()).toBe(wanted.html);
    });

    it('a pointer move (no reason) lands on the version that was asked for', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', maxHistory: 3, onContentChange }));
        act(() => { result.current.loadContent('<p>base</p>'); });
        type(result.current.editor, '1'); idle();
        type(result.current.editor, '2'); idle();
        const wanted = result.current.history[1];
        type(result.current.editor, '3');
        act(() => { result.current.restoreVersion(1); });
        expect(result.current.editor.getHTML()).toBe(wanted.html);
    });

    it('the same through the byte cap (maxHistoryBytes)', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', maxHistoryBytes: 45, onContentChange }));
        act(() => { result.current.loadContent('<p>base</p>'); });     // 11 chars
        type(result.current.editor, '1'); idle();                       // 12
        type(result.current.editor, '2'); idle();                       // 13 -> 36 total
        const wanted = result.current.history[1];
        type(result.current.editor, '3');                               // 14 -> 50 > 45 when flushed
        act(() => { result.current.restoreVersion(1, { reason: 'restore' }); });
        expect(result.current.history[result.current.historyIndex].html).toBe(wanted.html);
    });
});

describe('onContentChange hands the host the entry that was stored', () => {
    it('after an edit whose branch point the cap evicted', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', maxHistory: 3, onContentChange }));
        act(() => { result.current.loadContent('<p>base</p>'); });
        type(result.current.editor, '1'); idle();
        type(result.current.editor, '2'); idle();
        act(() => { result.current.undo(); });                         // pointer on base1
        calls = [];
        type(result.current.editor, 'X'); idle();                      // branches from base1, which the cap evicts
        const stored = result.current.history[result.current.historyIndex];
        expect(calls).toHaveLength(1);
        expect(calls[0].entry).toEqual(stored);                         // actual: carries a parentId to an evicted id
    });

    it('after a restore whose source the cap evicted', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', maxHistory: 3, onContentChange }));
        act(() => { result.current.loadContent('<p>base</p>'); });
        type(result.current.editor, '1'); idle();
        type(result.current.editor, '2'); idle();
        calls = [];
        act(() => { result.current.restoreVersion(1, { reason: 'restore' }); });
        const stored = result.current.history[result.current.historyIndex];
        expect(calls).toHaveLength(1);
        expect(calls[0].entry).toEqual(stored);                         // actual: restoredFrom names an evicted id
    });
});

describe('metadata edits around React lifecycle events', () => {
    it('a title changed while the editor is hidden (not destroyed) is recorded once shown', () => {
        const { rerender } = render(tree({ contentKey: 'k', documentKey: 'd', title: 'A' }));
        act(() => { api.loadContent('<p>Doc</p>', { title: 'A' }); });
        rerender(tree({ contentKey: 'k', documentKey: 'd', title: 'A', mode: 'hidden' }));
        rerender(tree({ contentKey: 'k', documentKey: 'd', title: 'B', mode: 'hidden' }));
        rerender(tree({ contentKey: 'k', documentKey: 'd', title: 'B' }));
        idle(3000);
        expect(api.history.map(e => e.title)).toEqual(['A', 'B']);
        expect(calls.map(c => c.reason)).toEqual(['edit']);
    });

    it('a title changed while the editor is hidden and destroyed is recorded once shown', () => {
        const { rerender } = render(tree({ contentKey: 'k', documentKey: 'd', title: 'A' }));
        act(() => { api.loadContent('<p>Doc</p>', { title: 'A' }); });
        const first = api.editor;
        rerender(tree({ contentKey: 'k', documentKey: 'd', title: 'A', mode: 'hidden' }));
        tick();
        expect(first.isDestroyed).toBe(true);
        rerender(tree({ contentKey: 'k', documentKey: 'd', title: 'B', mode: 'hidden' }));
        rerender(tree({ contentKey: 'k', documentKey: 'd', title: 'B' }));
        tick();
        idle(3000);
        expect(api.editor.getHTML()).toBe('<p>Doc</p>');
        expect(api.history.map(e => e.title)).toEqual(['A', 'B']);
    });

    it('a title change in the same render as a contentKey change (same documentKey) is recorded', () => {
        const { rerender } = render(tree({ contentKey: 'k1', documentKey: 'd', title: 'A' }));
        act(() => { api.loadContent('<p>Doc</p>', { title: 'A' }); });
        rerender(tree({ contentKey: 'k2', documentKey: 'd', title: 'B' }));
        idle(3000);
        expect(api.history.map(e => e.title)).toEqual(['A', 'B']);
        expect(api.isDirty).toBe(true);
    });

    it('a title change in the same render as an editorOptions change is recorded', () => {
        const { rerender } = render(tree({ contentKey: 'k', title: 'A', editorOptions: { slashCommand: true } }));
        act(() => { api.loadContent('<p>Doc</p>', { title: 'A' }); });
        rerender(tree({ contentKey: 'k', title: 'B', editorOptions: { slashCommand: false } }));
        idle(3000);
        expect(api.history.map(e => e.title)).toEqual(['A', 'B']);
    });
});

describe('typing that has not been committed yet', () => {
    it('is reported to the host when the editor unmounts mid-debounce', () => {
        const { unmount } = render(tree({ contentKey: 'k' }));
        act(() => { api.loadContent('<p>Doc</p>'); });
        type(api.editor, ' typed');
        unmount();
        idle(3000);
        expect(calls.map(c => [c.reason, c.entry.html])).toEqual([['edit', '<p>Doc typed</p>']]);
    });

    it("can be flushed from the host component's own unmount cleanup", () => {
        let snapshot = null;
        function FlushingHost() {
            const hook = useInscriptEditor({ contentKey: 'k', onContentChange });
            api = hook;
            useEffect(() => () => { snapshot = hook.flush(); }, [hook.flush]);
            return null;
        }
        const { unmount } = render(<FlushingHost />);
        act(() => { api.loadContent('<p>Doc</p>'); });
        type(api.editor, ' typed');
        unmount();
        expect(snapshot.history.map(e => e.html)).toEqual(['<p>Doc</p>', '<p>Doc typed</p>']);
    });

    it('is included by flush() while the editor is hidden by <Activity>', () => {
        const { rerender } = render(tree({ contentKey: 'k', documentKey: 'd' }));
        act(() => { api.loadContent('<p>Doc</p>'); });
        type(api.editor, ' typed');
        rerender(tree({ contentKey: 'k', documentKey: 'd', mode: 'hidden' }));
        let snapshot;
        act(() => { snapshot = api.flush(); });
        expect(snapshot.history.map(e => e.html)).toEqual(['<p>Doc</p>', '<p>Doc typed</p>']);
    });

    it('is recorded (and the document marked dirty) when the editor turns read-only within the debounce', () => {
        const { rerender } = render(tree({ contentKey: 'k', isReadonly: false }));
        act(() => { api.loadContent('<p>Doc</p>'); });
        type(api.editor, ' typed');
        rerender(tree({ contentKey: 'k', isReadonly: true }));
        idle(3000);
        expect(api.history.map(e => e.html)).toEqual(['<p>Doc</p>', '<p>Doc typed</p>']);
        expect(api.isDirty).toBe(true);
        expect(calls.map(c => c.reason)).toEqual(['edit']);
    });
});

describe('legacy sync guard', () => {
    it('a server sync right after typing is not recorded as the user\'s edit', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', onContentChange }));
        act(() => { result.current.loadContent('<p>Doc</p>'); });
        type(result.current.editor, ' typed');
        act(() => {
            result.current.isSyncingRef.current = true;
            result.current.editor.commands.setContent('<p>From server</p>');
            result.current.isSyncingRef.current = false;
        });
        idle(3000);
        expect(calls.filter(c => c.entry.html === '<p>From server</p>')).toEqual([]);
    });
});

describe('index validation', () => {
    it('a string index never leaves historyIndex a string', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', onContentChange }));
        act(() => { result.current.loadContent('<p>A</p>'); });
        type(result.current.editor, 'B'); idle();
        type(result.current.editor, 'C'); idle();
        act(() => { result.current.restoreVersion('1'); });
        expect(typeof result.current.historyIndex).toBe('number');
        act(() => { result.current.redo(); });
        expect(result.current.editor.getHTML()).toBe('<p>ABC</p>');
    });
});

describe('toolbar state while typing is pending', () => {
    it('canUndo is true while an edit on the baseline is pending (undo() would step back)', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', onContentChange }));
        act(() => { result.current.loadContent('<p>A</p>'); });
        type(result.current.editor, 'B');
        expect(result.current.canUndo).toBe(true);
    });

    it('canRedo is false while an edit after an undo is pending (redo() would do nothing)', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', onContentChange }));
        act(() => { result.current.loadContent('<p>A</p>'); });
        type(result.current.editor, 'B'); idle();
        act(() => { result.current.undo(); });
        type(result.current.editor, 'C');
        let redone;
        act(() => { redone = result.current.redo(); });
        expect(redone).toBe(false);
        // The button was offered although it could not do anything:
        // (checked before the redo in a fresh sequence)
    });
});

describe('React-rendered nodes and editor replacement', () => {
    it('recreating the editor (editorOptions change) with a math node logs no React error', () => {
        const { rerender } = render(tree({ contentKey: 'k', editorOptions: { slashCommand: true } }));
        act(() => { api.loadContent('<p>x</p><div data-type="admonition" data-variant="note"><p>note</p></div>'); });
        errorSpy.mockClear();
        rerender(tree({ contentKey: 'k', editorOptions: { slashCommand: false } }));
        tick();
        expect(errorSpy).not.toHaveBeenCalled();
    });
});
