import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from './useInscriptEditor.js';

function typeText(editor, text) {
    act(() => {
        editor.commands.insertContent(text);
    });
}

describe('useInscriptEditor', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts with empty history, no dirty flag, and a live editor instance', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a.md' }));
        expect(result.current.history).toEqual([]);
        expect(result.current.historyIndex).toBe(-1);
        expect(result.current.isDirty).toBe(false);
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
        expect(result.current.editor).not.toBeNull();
    });

    it('pushes a full history entry exactly at the 1000ms debounce boundary', () => {
        const onContentChange = vi.fn();
        const { result } = renderHook(() => useInscriptEditor({
            contentKey: 'a.md', title: 'My Title', tags: ['t1'], categories: ['c1'], onContentChange,
        }));

        typeText(result.current.editor, 'hello');

        act(() => { vi.advanceTimersByTime(999); });
        expect(result.current.history).toHaveLength(0);

        act(() => { vi.advanceTimersByTime(1); });
        expect(result.current.history).toHaveLength(1);
        expect(result.current.history[0]).toMatchObject({
            html: '<p>hello</p>',
            title: 'My Title',
            tags: ['t1'],
            categories: ['c1'],
        });
        expect(result.current.history[0].timestamp).toEqual(expect.any(String));
        expect(result.current.historyIndex).toBe(0);
        expect(result.current.isDirty).toBe(true);
        expect(onContentChange).toHaveBeenCalledTimes(1);
        expect(onContentChange).toHaveBeenCalledWith(result.current.history[0]);
    });

    it('coalesces rapid edits within the debounce window into a single push', () => {
        const onContentChange = vi.fn();
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a.md', onContentChange }));

        typeText(result.current.editor, 'h');
        act(() => { vi.advanceTimersByTime(400); });
        typeText(result.current.editor, 'e');
        act(() => { vi.advanceTimersByTime(400); });
        typeText(result.current.editor, 'y');
        act(() => { vi.advanceTimersByTime(1000); });

        expect(onContentChange).toHaveBeenCalledTimes(1);
        expect(result.current.history).toHaveLength(1);
        expect(result.current.history[0].html).toBe('<p>hey</p>');
    });

    it('does not push while isReadonly', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a.md', isReadonly: true }));
        typeText(result.current.editor, 'hello');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.history).toHaveLength(0);
    });

    it('does not push while isLoadingRef.current is true', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a.md' }));
        result.current.isLoadingRef.current = true;
        typeText(result.current.editor, 'hello');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.history).toHaveLength(0);
    });

    it('does not push while isSyncingRef.current is true', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a.md' }));
        result.current.isSyncingRef.current = true;
        typeText(result.current.editor, 'hello');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.history).toHaveLength(0);
    });

    it('records a title-only change (no content edit)', () => {
        const onContentChange = vi.fn();
        const { result, rerender } = renderHook(
            ({ title }) => useInscriptEditor({ contentKey: 'a.md', title, onContentChange }),
            { initialProps: { title: 'Old' } },
        );

        act(() => { rerender({ title: 'New Heading' }); });
        act(() => { vi.advanceTimersByTime(1000); });

        expect(result.current.history).toHaveLength(1);
        expect(result.current.history[0].title).toBe('New Heading');
        expect(result.current.isDirty).toBe(true);
        expect(onContentChange).toHaveBeenCalledTimes(1);
        expect(onContentChange).toHaveBeenCalledWith(result.current.history[0]);
    });

    it('records a tags-only change (no content edit)', () => {
        const { result, rerender } = renderHook(
            ({ tags }) => useInscriptEditor({ contentKey: 'a.md', tags }),
            { initialProps: { tags: ['a'] } },
        );

        act(() => { rerender({ tags: ['a', 'b'] }); });
        act(() => { vi.advanceTimersByTime(1000); });

        expect(result.current.history).toHaveLength(1);
        expect(result.current.history[0].tags).toEqual(['a', 'b']);
        expect(result.current.isDirty).toBe(true);
    });

    it('does not record a metadata change that coincides with a document switch', () => {
        const { result, rerender } = renderHook(
            ({ contentKey, title }) => useInscriptEditor({ contentKey, title }),
            { initialProps: { contentKey: 'a.md', title: 'A' } },
        );

        // Switching documents changes both contentKey and title at once — a load, not an edit.
        act(() => { rerender({ contentKey: 'b.md', title: 'B' }); });
        act(() => { vi.advanceTimersByTime(1000); });

        expect(result.current.history).toHaveLength(0);
        expect(result.current.isDirty).toBe(false);
    });

    it('does not push a duplicate entry when the resolved content is unchanged from the last entry', () => {
        const onContentChange = vi.fn();
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a.md', onContentChange }));

        typeText(result.current.editor, 'a');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.history).toHaveLength(1);

        // Re-set identical content in a new debounce window.
        act(() => { result.current.editor.commands.setContent('<p>a</p>'); });
        act(() => { vi.advanceTimersByTime(1000); });

        expect(result.current.history).toHaveLength(1);
        expect(onContentChange).toHaveBeenCalledTimes(1);
    });

    it('truncates forward history after undo before pushing a new entry', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a.md' }));

        typeText(result.current.editor, 'a');
        act(() => { vi.advanceTimersByTime(1000); });
        typeText(result.current.editor, 'b');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.history).toHaveLength(2);

        act(() => { result.current.restoreVersion(0); });
        expect(result.current.historyIndex).toBe(0);

        typeText(result.current.editor, 'c');
        act(() => { vi.advanceTimersByTime(1000); });

        expect(result.current.history).toHaveLength(2);
        expect(result.current.historyIndex).toBe(1);
    });

    it('restoreVersion sets content without triggering a history push', () => {
        const onContentChange = vi.fn();
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a.md', onContentChange }));

        typeText(result.current.editor, 'a');
        act(() => { vi.advanceTimersByTime(1000); });
        onContentChange.mockClear();

        act(() => { result.current.restoreVersion(0); });
        act(() => { vi.advanceTimersByTime(1000); });

        expect(result.current.history).toHaveLength(1);
        expect(onContentChange).not.toHaveBeenCalled();
        expect(result.current.editor.getHTML()).toBe('<p>a</p>');
    });

    it('restoreVersion is a no-op for an out-of-range index', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a.md' }));
        typeText(result.current.editor, 'a');
        act(() => { vi.advanceTimersByTime(1000); });

        expect(() => act(() => { result.current.restoreVersion(99); })).not.toThrow();
        expect(result.current.historyIndex).toBe(0);
    });

    it('markSaved clears the dirty flag', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a.md' }));
        typeText(result.current.editor, 'a');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.isDirty).toBe(true);

        act(() => { result.current.markSaved(); });
        expect(result.current.isDirty).toBe(false);
    });

    it('canUndo/canRedo reflect historyIndex boundaries', () => {
        const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a.md' }));
        typeText(result.current.editor, 'a');
        act(() => { vi.advanceTimersByTime(1000); });
        typeText(result.current.editor, 'b');
        act(() => { vi.advanceTimersByTime(1000); });
        // historyIndex === 1 (last), length 2
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);

        act(() => { result.current.restoreVersion(0); });
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(true);
    });

    it('reads the latest title prop from a ref, not a stale closure, after rerender', () => {
        const { result, rerender } = renderHook(
            ({ title }) => useInscriptEditor({ contentKey: 'a.md', title }),
            { initialProps: { title: 'Old Title' } },
        );

        rerender({ title: 'New Title' });

        typeText(result.current.editor, 'a');
        act(() => { vi.advanceTimersByTime(1000); });

        expect(result.current.history[0].title).toBe('New Title');
    });

    describe('Phase A regression pins', () => {
        it('clears the pending debounce timer on unmount, so it never fires afterward', () => {
            const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
            const { result, unmount } = renderHook(() => useInscriptEditor({ contentKey: 'a.md' }));
            typeText(result.current.editor, 'a');
            unmount();
            expect(clearSpy).toHaveBeenCalled();
            // Advancing timers post-unmount must not throw or touch unmounted state.
            expect(() => act(() => { vi.advanceTimersByTime(1000); })).not.toThrow();
            clearSpy.mockRestore();
        });

        it('clears the pending debounce timer and resets history on contentKey change', () => {
            const onContentChange = vi.fn();
            const { result, rerender } = renderHook(
                ({ contentKey }) => useInscriptEditor({ contentKey, onContentChange }),
                { initialProps: { contentKey: 'a.md' } },
            );

            typeText(result.current.editor, 'a');
            act(() => { vi.advanceTimersByTime(1000); });
            expect(result.current.history).toHaveLength(1);

            // Start a second, never-flushed edit just before switching documents.
            typeText(result.current.editor, 'b');

            act(() => { rerender({ contentKey: 'b.md' }); });

            expect(result.current.history).toEqual([]);
            expect(result.current.historyIndex).toBe(-1);
            expect(result.current.isDirty).toBe(false);

            onContentChange.mockClear();
            act(() => { vi.advanceTimersByTime(2000); });
            // The stale timer from the old document must not have pushed into the new one.
            expect(result.current.history).toEqual([]);
            expect(onContentChange).not.toHaveBeenCalled();
        });

        it('flips isEditable on isReadonly change without recreating the editor instance', () => {
            const { result, rerender } = renderHook(
                ({ isReadonly }) => useInscriptEditor({ contentKey: 'a.md', isReadonly }),
                { initialProps: { isReadonly: false } },
            );
            const originalEditor = result.current.editor;
            expect(originalEditor.isEditable).toBe(true);

            act(() => { rerender({ isReadonly: true }); });

            expect(result.current.editor).toBe(originalEditor);
            expect(result.current.editor.isEditable).toBe(false);
        });
    });
});
