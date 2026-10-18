// Versions whose text has a leading space or a run of spaces (the user deleted the first word, or
// typed two spaces) do not come back as recorded on undo / redo / restore.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from '../useInscriptEditor.js';

const idle = (ms = 1000) => act(() => { vi.advanceTimersByTime(ms); });

describe('whitespace in a version survives undo, redo and restore', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('a leading space left by deleting the first word', () => {
        const calls = [];
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', onContentChange: (e, i) => calls.push([i.reason, e.html]) }));
        act(() => { result.current.loadContent('<p>Hello world</p>'); });
        // Delete "Hello" (positions 1..6): the paragraph now starts with a space.
        act(() => { result.current.editor.chain().setTextSelection({ from: 1, to: 6 }).deleteSelection().run(); });
        idle();
        const v1 = result.current.history[1].html;
        expect(v1).toBe('<p> world</p>');
        act(() => { result.current.editor.commands.insertContent('!'); });
        idle();
        act(() => { result.current.undo(); });
        expect(result.current.editor.getHTML()).toBe(v1);
    });

    it('two spaces typed in a row', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a' }));
        act(() => { result.current.loadContent('<p>a</p>'); });
        act(() => { const ed = result.current.editor; ed.view.dispatch(ed.state.tr.insertText('  b', 2)); });
        idle();
        const v1 = result.current.history[1].html;
        expect(v1).toBe('<p>a  b</p>');
        act(() => { result.current.undo(); });
        act(() => { result.current.redo(); });
        expect(result.current.editor.getHTML()).toBe(v1);
        act(() => { result.current.restoreVersion(1, { reason: 'restore' }); });
        // The 'restored' entry should hold the version's text, not a whitespace-collapsed copy.
        expect(result.current.history.at(-1).html).toBe(v1);
    });
});
