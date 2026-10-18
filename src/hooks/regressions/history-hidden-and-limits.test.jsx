// The hook's API while <Activity> has torn the effects down, prop changes while
// hidden, a throwing onContentChange, and odd limits.
import { Activity, StrictMode } from 'react';
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
beforeEach(() => { vi.useFakeTimers(); calls = []; errorSpy = vi.spyOn(console, 'error'); });
afterEach(() => { errorSpy.mockRestore(); vi.useRealTimers(); });

describe('the API while the editor is hidden (effects torn down, editor not yet destroyed)', () => {
    it('undo() keeps the typing that was pending: it can be redone', () => {
        const { rerender } = render(tree({ contentKey: 'k', documentKey: 'd' }));
        act(() => { api.loadContent('<p>A</p>'); });
        type(api.editor, 'B'); idle();
        type(api.editor, 'C');                                   // pending
        rerender(tree({ contentKey: 'k', documentKey: 'd', mode: 'hidden' }));
        act(() => { api.undo(); });
        rerender(tree({ contentKey: 'k', documentKey: 'd' }));
        idle(3000);
        expect(api.history.map(e => e.html)).toContain('<p>ABC</p>');
    });
});

describe('the API while the editor is destroyed (hidden past TipTap\'s 1ms timer)', () => {
    it('every call is a harmless no-op that reports so', () => {
        const { rerender } = render(tree({ contentKey: 'k', documentKey: 'd' }));
        act(() => { api.loadContent('<p>A</p>'); });
        type(api.editor, 'B'); idle();
        rerender(tree({ contentKey: 'k', documentKey: 'd', mode: 'hidden' }));
        tick();
        expect(api.editor.isDestroyed).toBe(true);
        let results;
        act(() => {
            results = [api.undo(), api.redo(), api.restoreVersion(0), api.restoreVersion(0, { reason: 'restore' }), api.loadContent('<p>X</p>')];
            api.markSaved();
        });
        expect(results).toEqual([false, false, false, false, false]);
        expect(api.flush().history).toHaveLength(2);
        rerender(tree({ contentKey: 'k', documentKey: 'd' }));
        tick();
        expect(api.editor.getHTML()).toBe('<p>AB</p>');
        expect(api.history).toHaveLength(2);
        expect(errorSpy).not.toHaveBeenCalled();
    });
});

describe('prop changes while hidden', () => {
    it('an editorOptions change while hidden keeps the document and commits pending typing once', () => {
        const { rerender } = render(tree({ contentKey: 'k', documentKey: 'd', editorOptions: { slashCommand: true } }));
        act(() => { api.loadContent('<p>A</p>'); });
        type(api.editor, 'B');
        rerender(tree({ contentKey: 'k', documentKey: 'd', editorOptions: { slashCommand: true }, mode: 'hidden' }));
        rerender(tree({ contentKey: 'k', documentKey: 'd', editorOptions: { slashCommand: false }, mode: 'hidden' }));
        rerender(tree({ contentKey: 'k', documentKey: 'd', editorOptions: { slashCommand: false } }));
        idle(3000);
        expect(api.editor.getHTML()).toBe('<p>AB</p>');
        expect(api.history.map(e => e.html)).toEqual(['<p>A</p>', '<p>AB</p>']);
        expect(calls.map(c => c.reason)).toEqual(['edit']);
    });

    it('a contentKey change while hidden and destroyed keeps the document (StrictMode)', () => {
        const { rerender } = render(tree({ strict: true, contentKey: 'k1', documentKey: 'd' }));
        tick();
        act(() => { api.loadContent('<p>A</p>'); });
        type(api.editor, 'B');
        rerender(tree({ strict: true, contentKey: 'k1', documentKey: 'd', mode: 'hidden' }));
        tick();
        rerender(tree({ strict: true, contentKey: 'k2', documentKey: 'd', mode: 'hidden' }));
        rerender(tree({ strict: true, contentKey: 'k2', documentKey: 'd' }));
        tick();
        idle(3000);
        expect(api.editor.getHTML()).toBe('<p>AB</p>');
        expect(api.history.map(e => e.html)).toEqual(['<p>A</p>', '<p>AB</p>']);
        expect(errorSpy).not.toHaveBeenCalled();
    });
});

describe('a host callback that throws', () => {
    it('leaves the history consistent and the next operations working', () => {
        let fail = true;
        const { result } = renderHook(() => useInscriptEditor({
            contentKey: 'a',
            onContentChange: () => { if (fail) throw new Error('save failed'); },
        }));
        act(() => { result.current.loadContent('<p>A</p>'); });
        type(result.current.editor, 'B');
        // Caught inside act(): an act() whose callback throws discards React's queued updates,
        // which a browser would not do.
        let caught = null;
        act(() => { try { vi.advanceTimersByTime(1000); } catch (e) { caught = e; } });
        expect(caught?.message).toBe('save failed');
        expect(result.current.history.map(e => e.html)).toEqual(['<p>A</p>', '<p>AB</p>']);
        caught = null;
        act(() => { try { result.current.undo(); } catch (e) { caught = e; } });
        expect(caught?.message).toBe('save failed');
        expect(result.current.historyIndex).toBe(0);
        expect(result.current.editor.getHTML()).toBe('<p>A</p>');
        fail = false;
        act(() => { result.current.redo(); });
        expect(result.current.editor.getHTML()).toBe('<p>AB</p>');
    });
});

describe('limits', () => {
    it('maxHistory given as a numeric string still caps', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', maxHistory: '3' }));
        act(() => { result.current.loadContent('<p>A</p>'); });
        for (const ch of 'bcdef') { type(result.current.editor, ch); idle(); }
        expect(result.current.history.length).toBeLessThanOrEqual(3);
    });

    it('a byte cap smaller than the baseline plus the active version keeps both and nothing else', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', maxHistoryBytes: 5 }));
        act(() => { result.current.loadContent('<p>Base</p>'); });
        for (const ch of 'bcd') { type(result.current.editor, ch); idle(); }
        expect(result.current.history.map(e => e.kind)).toEqual(['opened', 'edited']);
        expect(result.current.historyIndex).toBe(1);
        act(() => { result.current.undo(); });
        expect(result.current.editor.getHTML()).toBe('<p>Base</p>');
    });
});
