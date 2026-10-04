import { Activity, StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from './useInscriptEditor.js';

// React re-runs effects without replacing anything (StrictMode on mount, Fast Refresh), and it
// can tear them down for a while (<Activity mode="hidden">), during which TipTap destroys the
// editor. Neither may cost the user their document.
//
// <Activity> is how these tests drive both: hidden then visible again at once re-runs every
// effect on the same editor (what Fast Refresh does); hidden across TipTap's 1ms destroy timer
// replaces the editor.

let api;
const onContentChange = vi.fn();
function Host(props) {
    api = useInscriptEditor({ contentKey: 'k', documentKey: 'fixed', onContentChange, ...props });
    return null;
}
const tree = ({ mode = 'visible', strict = false, ...props } = {}) => {
    const inner = <Activity mode={mode}><Host {...props} /></Activity>;
    return strict ? <StrictMode>{inner}</StrictMode> : inner;
};
const tick = (ms = 5) => act(() => { vi.advanceTimersByTime(ms); });
const idle = (ms = 1000) => act(() => { vi.advanceTimersByTime(ms); });
const kinds = () => api.history.map(e => e.kind);

describe('useInscriptEditor across React lifecycle events', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        onContentChange.mockClear();
    });
    afterEach(() => { vi.useRealTimers(); });

    describe('effects re-run on the same editor (StrictMode, Fast Refresh)', () => {
        // The reported data loss: StrictMode builds and discards an extra editor a tick after
        // mount; its destruction was read as "the live editor is being replaced" and the live
        // (still empty) document kept as a leftover, which the next effect re-run applied.
        it('never replaces the content of the live editor', () => {
            const { rerender } = render(tree({ strict: true }));
            const live = api.editor;
            tick();                                             // the discarded instance is destroyed
            act(() => { api.loadContent('<p>My document</p>'); });

            rerender(tree({ strict: true, mode: 'hidden' }));
            rerender(tree({ strict: true }));

            expect(api.editor).toBe(live);
            expect(api.editor.getHTML()).toBe('<p>My document</p>');
            expect(kinds()).toEqual(['opened']);
            idle(3000);
            expect(kinds()).toEqual(['opened']);
            expect(onContentChange).not.toHaveBeenCalled();
            expect(api.isDirty).toBe(false);
        });

        it('keeps an edit that was pending, and commits it once', () => {
            const { rerender } = render(tree());
            act(() => { api.loadContent('<p>Doc</p>'); });
            act(() => { api.editor.commands.insertContent('!'); });

            rerender(tree({ mode: 'hidden' }));
            rerender(tree());
            expect(kinds()).toEqual(['opened']);

            idle();
            expect(api.history.map(e => e.html)).toEqual(['<p>Doc</p>', '<p>Doc!</p>']);
            expect(onContentChange).toHaveBeenCalledTimes(1);
            expect(onContentChange).toHaveBeenCalledWith(api.history[1], { reason: 'edit' });
            idle(3000);
            expect(api.history).toHaveLength(2);
        });

        it('records nothing for an editor nobody loaded or edited', () => {
            render(tree({ strict: true, title: 'T', tags: ['a'] }));
            tick();
            idle(3000);
            expect(api.history).toEqual([]);
            expect(onContentChange).not.toHaveBeenCalled();
            expect(api.isDirty).toBe(false);
        });

        it('seeds initialContent as the baseline exactly once', () => {
            const { rerender } = render(tree({ strict: true, initialContent: '<p>Start</p>' }));
            tick();
            rerender(tree({ strict: true, initialContent: '<p>Start</p>', mode: 'hidden' }));
            rerender(tree({ strict: true, initialContent: '<p>Start</p>' }));
            idle(3000);
            expect(api.history.map(e => [e.kind, e.html])).toEqual([['opened', '<p>Start</p>']]);
            expect(api.editor.getHTML()).toBe('<p>Start</p>');
        });
    });

    describe('the editor is destroyed while its effects are torn down (<Activity> hidden)', () => {
        const hideUntilDestroyed = (rerender, props = {}) => {
            const before = api.editor;
            rerender(tree({ ...props, mode: 'hidden' }));
            tick();
            expect(before.isDestroyed).toBe(true);
            rerender(tree(props));
            tick();
            expect(api.editor).not.toBe(before);
            return before;
        };

        it('gives the replacement editor the document back, with its history, quietly', () => {
            const { rerender } = render(tree());
            act(() => { api.loadContent('<p>My document</p>'); });
            act(() => { api.editor.commands.insertContent('!'); });
            idle();
            onContentChange.mockClear();

            hideUntilDestroyed(rerender);

            expect(api.editor.getHTML()).toBe('<p>My document!</p>');
            expect(kinds()).toEqual(['opened', 'edited']);
            expect(api.historyIndex).toBe(1);
            idle(3000);
            expect(api.history).toHaveLength(2);
            expect(onContentChange).not.toHaveBeenCalled();
        });

        it('carries an uncommitted edit across, then commits it', () => {
            const { rerender } = render(tree());
            act(() => { api.loadContent('<p>Doc</p>'); });
            act(() => { api.editor.commands.insertContent(' typed'); });   // never reaches its 1s commit

            hideUntilDestroyed(rerender);
            expect(api.editor.getHTML()).toBe('<p>Doc typed</p>');
            expect(kinds()).toEqual(['opened']);

            idle();
            expect(api.history.map(e => e.html)).toEqual(['<p>Doc</p>', '<p>Doc typed</p>']);
            expect(onContentChange).toHaveBeenCalledTimes(1);
            expect(onContentChange).toHaveBeenCalledWith(api.history[1], { reason: 'edit' });
        });

        it('keeps a document the user emptied empty', () => {
            const { rerender } = render(tree());
            act(() => { api.loadContent('<p>Doc</p>'); });
            act(() => { api.editor.commands.clearContent(true); });
            idle();
            expect(api.history.map(e => e.html)).toEqual(['<p>Doc</p>', '<p></p>']);

            hideUntilDestroyed(rerender);
            expect(api.editor.getHTML()).toBe('<p></p>');
            expect(api.history).toHaveLength(2);
        });
    });

    describe('an empty editor never blanks a document', () => {
        it('is not carried over a replacement created with the document (initialContent arriving late)', () => {
            // The first editor is created before the document is known, so it is empty and nothing
            // is recorded; the document then arrives together with a new editor.
            const { rerender } = render(tree({ contentKey: 'k1' }));
            expect(api.editor.getHTML()).toBe('<p></p>');
            rerender(tree({ contentKey: 'k2', initialContent: '<p>Arrived</p>' }));
            expect(api.editor.getHTML()).toBe('<p>Arrived</p>');
            expect(api.history.map(e => [e.kind, e.html])).toEqual([['opened', '<p>Arrived</p>']]);
        });

        it('falls back to the active version when the outgoing editor cannot be read', () => {
            const { rerender } = render(tree({ contentKey: 'k1' }));
            act(() => { api.loadContent('<p>Recorded</p>'); });
            api.editor.getHTML = () => { throw new Error('unreadable'); };
            rerender(tree({ contentKey: 'k2' }));
            expect(api.editor.getHTML()).toBe('<p>Recorded</p>');
            expect(kinds()).toEqual(['opened']);
        });

        it('restores the active version over an outgoing editor that lost its content', () => {
            const { rerender } = render(tree({ contentKey: 'k1' }));
            act(() => { api.loadContent('<p>Recorded</p>'); });
            // Emptied behind the hook's back: no edit pending, and not the synced state.
            act(() => { api.editor.commands.setContent('', { emitUpdate: false }); });
            rerender(tree({ contentKey: 'k2' }));
            expect(api.editor.getHTML()).toBe('<p>Recorded</p>');
        });
    });

    describe('a real replacement for the same document still carries everything', () => {
        it('content, history and a pending edit (committed before the swap)', () => {
            const { rerender } = render(tree({ strict: true, contentKey: 'k1' }));
            tick();
            act(() => { api.loadContent('<p>Loaded</p>'); });
            act(() => { api.editor.commands.insertContent('typed'); });
            const first = api.editor;

            rerender(tree({ strict: true, contentKey: 'k2' }));
            expect(api.editor).not.toBe(first);
            expect(api.editor.getHTML()).toBe('<p>Loadedtyped</p>');
            expect(kinds()).toEqual(['opened', 'edited']);
            expect(onContentChange).toHaveBeenCalledWith(api.history[1], { reason: 'edit' });
            idle(3000);
            expect(api.history).toHaveLength(2);
        });

        it('but not across a document change', () => {
            const { rerender } = render(tree({ documentKey: 'a', contentKey: 'k1' }));
            act(() => { api.loadContent('<p>Document A</p>'); });
            act(() => { api.editor.commands.insertContent('!'); });
            rerender(tree({ documentKey: 'b', contentKey: 'k2' }));
            expect(api.editor.getHTML()).toBe('<p></p>');
            expect(api.history).toEqual([]);
            idle(3000);
            expect(api.history).toEqual([]);
            expect(onContentChange).not.toHaveBeenCalled();
        });
    });
});
