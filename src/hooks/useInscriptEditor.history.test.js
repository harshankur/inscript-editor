import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from './useInscriptEditor.js';

const type = (editor, text) => act(() => { editor.commands.insertContent(text); });
const idle = (ms = 1000) => act(() => { vi.advanceTimersByTime(ms); });
const kinds = result => result.current.history.map(e => e.kind);

describe('useInscriptEditor version history', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    describe('loadContent (R1)', () => {
        it('seeds one "opened" baseline without notifying the host or marking dirty', () => {
            const onContentChange = vi.fn();
            const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', onContentChange }));
            act(() => { result.current.loadContent('<p>Hello</p>', { title: 'T' }); });
            expect(result.current.history).toHaveLength(1);
            expect(result.current.historyIndex).toBe(0);
            expect(result.current.history[0]).toMatchObject({ kind: 'opened', html: '<p>Hello</p>', title: 'T' });
            expect(result.current.isDirty).toBe(false);
            idle(2000);
            expect(onContentChange).not.toHaveBeenCalled();
            expect(result.current.history).toHaveLength(1);
        });

        it('the first edit becomes a second version, Undo is enabled and returns the loaded HTML exactly', () => {
            const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a' }));
            act(() => { result.current.loadContent('<p>Hello</p>'); });
            type(result.current.editor, ' world');
            idle();
            expect(result.current.historyIndex).toBe(1);
            expect(result.current.canUndo).toBe(true);
            act(() => { result.current.restoreVersion(0); });
            expect(result.current.editor.getHTML()).toBe('<p>Hello</p>');
        });

        it('drops a debounce armed by a keystroke just before the load', () => {
            const onContentChange = vi.fn();
            const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', onContentChange }));
            act(() => { result.current.loadContent('<p>Doc A</p>'); });
            type(result.current.editor, 'typed in A');
            act(() => { result.current.loadContent('<p>Doc B</p>'); });
            idle(2000);
            expect(onContentChange).not.toHaveBeenCalled();
            expect(result.current.history.map(e => e.html)).toEqual(['<p>Doc B</p>']);
        });

        it('stores the normalized HTML, so a load the editor normalizes never adds a phantom entry', () => {
            const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a' }));
            act(() => { result.current.loadContent('<p data-unknown="x"><b>Bold</b></p>'); });
            expect(result.current.history[0].html).toBe('<p><strong>Bold</strong></p>');
            idle(2000);
            expect(result.current.history).toHaveLength(1);
        });

        it('keepHistory appends an "external" entry and keeps the earlier ones', () => {
            const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a' }));
            act(() => { result.current.loadContent('<p>v1</p>'); });
            type(result.current.editor, '!');
            idle();
            act(() => { result.current.loadContent('<p>changed elsewhere</p>', { keepHistory: true }); });
            expect(kinds(result)).toEqual(['opened', 'edited', 'external']);
            expect(result.current.historyIndex).toBe(2);
            expect(result.current.isDirty).toBe(false);
        });

        it('keepHistory with unchanged content adds nothing', () => {
            const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a' }));
            act(() => { result.current.loadContent('<p>same</p>'); });
            act(() => { result.current.loadContent('<p>same</p>', { keepHistory: true }); });
            expect(result.current.history).toHaveLength(1);
        });

        it('keystroke undo (Cmd/Ctrl+Z) can never undo the load itself', () => {
            const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a' }));
            act(() => { result.current.loadContent('<p>Doc A</p>'); });
            act(() => { result.current.loadContent('<p>Doc B</p>'); });
            expect(result.current.editor.can().undo()).toBe(false);
            type(result.current.editor, '!');
            act(() => { result.current.editor.commands.undo(); });
            expect(result.current.editor.getHTML()).toBe('<p>Doc B</p>');
        });

        it('restores a persisted stack, validated (R10)', () => {
            const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a' }));
            const saved = [
                { id: 'x1', kind: 'opened', html: '<p>one</p>', title: '', tags: [], categories: [], timestamp: '2026-01-01T00:00:00.000Z' },
                { id: 'x1', kind: 'bogus', html: '<p>two</p>', timestamp: 'nope', restoredFrom: 'missing' },
                null,
                { html: 42 },
            ];
            act(() => { result.current.loadContent('<p>two</p>', { history: saved, historyIndex: 99 }); });
            const h = result.current.history;
            expect(h).toHaveLength(2);
            expect(new Set(h.map(e => e.id)).size).toBe(2);
            expect(h[1].kind).toBeUndefined();
            expect(h[1].restoredFrom).toBeUndefined();
            expect(result.current.historyIndex).toBe(1);
            act(() => { result.current.loadContent('<p>three</p>', { history: saved }); });
            expect(result.current.history.map(e => e.kind)).toEqual(['opened', undefined, 'external']);
        });
    });

    describe('undo, redo and restore reach the host (R2)', () => {
        const setup = () => {
            const onContentChange = vi.fn();
            const hook = renderHook(() => useInscriptEditor({ contentKey: 'a', onContentChange }));
            act(() => { hook.result.current.loadContent('<p>A</p>'); });
            type(hook.result.current.editor, 'B');
            idle();
            onContentChange.mockClear();
            act(() => { hook.result.current.markSaved(); });
            return { ...hook, onContentChange };
        };

        it('undo and redo each notify once with their reason and mark dirty', () => {
            const { result, onContentChange } = setup();
            act(() => { result.current.undo(); });
            expect(onContentChange).toHaveBeenLastCalledWith(result.current.history[0], { reason: 'undo' });
            expect(result.current.isDirty).toBe(true);
            act(() => { result.current.redo(); });
            expect(onContentChange).toHaveBeenLastCalledWith(result.current.history[1], { reason: 'redo' });
            expect(onContentChange).toHaveBeenCalledTimes(2);
            expect(result.current.history).toHaveLength(2);
        });

        it("a panel restore appends a 'restored' entry, notifies once and never deletes a version", () => {
            const { result, onContentChange } = setup();
            act(() => { result.current.restoreVersion(0, { reason: 'restore' }); });
            expect(kinds(result)).toEqual(['opened', 'edited', 'restored']);
            const restored = result.current.history[2];
            expect(restored.restoredFrom).toBe(result.current.history[0].id);
            expect(restored.html).toBe('<p>A</p>');
            expect(onContentChange).toHaveBeenCalledTimes(1);
            expect(onContentChange).toHaveBeenCalledWith(restored, { reason: 'restore' });
            expect(result.current.isDirty).toBe(true);
            // Then edit: every earlier version survives.
            type(result.current.editor, 'C');
            idle();
            expect(kinds(result)).toEqual(['opened', 'edited', 'restored', 'edited']);
        });

        it('restoring the active version is a no-op', () => {
            const { result, onContentChange } = setup();
            act(() => { result.current.restoreVersion(1, { reason: 'restore' }); });
            expect(result.current.history).toHaveLength(2);
            expect(onContentChange).not.toHaveBeenCalled();
        });

        it('undo twice then edit keeps the undone versions in the list (R4)', () => {
            const { result } = setup();
            type(result.current.editor, 'C');
            idle();
            act(() => { result.current.undo(); });
            act(() => { result.current.undo(); });
            type(result.current.editor, 'D');
            idle();
            expect(result.current.history.map(e => e.html)).toEqual(['<p>A</p>', '<p>AB</p>', '<p>ABC</p>', '<p>AD</p>']);
            expect(result.current.canRedo).toBe(false);
        });

        it('undo first commits pending typing, so the typing can be redone', () => {
            const { result } = setup();
            type(result.current.editor, 'X');
            act(() => { result.current.undo(); });
            expect(result.current.editor.getHTML()).toBe('<p>AB</p>');
            act(() => { result.current.redo(); });
            expect(result.current.editor.getHTML()).toBe('<p>ABX</p>');
        });
    });

    it('restoring the metadata after an undo records nothing and keeps redo (bug 7)', () => {
        const { result, rerender } = renderHook(
            props => useInscriptEditor({ contentKey: 'a.md', ...props }),
            { initialProps: { title: 'A' } },
        );
        // A host seeding with non-normalized HTML ('' where the editor holds '<p></p>').
        act(() => {
            result.current.setHistory([{ html: '', title: 'A', tags: [], categories: [], timestamp: 't0' }]);
            result.current.setHistoryIndex(0);
        });
        rerender({ title: 'B' });
        idle();
        expect(result.current.history).toHaveLength(2);

        act(() => { result.current.restoreVersion(0); });
        rerender({ title: 'A' });
        expect(result.current.canRedo).toBe(true);
        idle(1500);
        expect(result.current.history[1].title).toBe('B');
        expect(result.current.historyIndex).toBe(0);
        expect(result.current.canRedo).toBe(true);
    });

    describe('documentKey and editor recreation (R6)', () => {
        it('recreating the editor with the same documentKey keeps history and content, adding nothing', () => {
            const { result, rerender } = renderHook(
                props => useInscriptEditor({ documentKey: 'doc-1', ...props }),
                { initialProps: { contentKey: 'k1' } },
            );
            act(() => { result.current.loadContent('<p>Loaded</p>'); });
            type(result.current.editor, '!');
            idle();
            const before = result.current.history;
            const first = result.current.editor;

            rerender({ contentKey: 'k2' });
            expect(result.current.editor).not.toBe(first);
            expect(result.current.history).toEqual(before);
            expect(result.current.historyIndex).toBe(1);
            expect(result.current.editor.getHTML()).toBe('<p>Loaded!</p>');
            idle(2000);
            expect(result.current.history).toHaveLength(2);
        });

        it('a pending edit survives the recreation (committed, then carried over)', () => {
            const onContentChange = vi.fn();
            const { result, rerender } = renderHook(
                props => useInscriptEditor({ documentKey: 'doc-1', onContentChange, ...props }),
                { initialProps: { contentKey: 'k1' } },
            );
            act(() => { result.current.loadContent('<p>Loaded</p>'); });
            type(result.current.editor, 'typed');
            rerender({ contentKey: 'k2' });
            expect(result.current.editor.getHTML()).toBe('<p>Loadedtyped</p>');
            expect(result.current.history.map(e => e.kind)).toEqual(['opened', 'edited']);
            expect(onContentChange).toHaveBeenCalledWith(result.current.history[1], { reason: 'edit' });
        });

        it('changing documentKey resets history', () => {
            const { result, rerender } = renderHook(
                props => useInscriptEditor({ contentKey: 'same', ...props }),
                { initialProps: { documentKey: 'doc-1' } },
            );
            act(() => { result.current.loadContent('<p>One</p>'); });
            type(result.current.editor, 'x');
            rerender({ documentKey: 'doc-2' });
            expect(result.current.history).toEqual([]);
            expect(result.current.isDirty).toBe(false);
            idle(2000);
            expect(result.current.history).toEqual([]);
        });
    });

    describe('editorOptions changes (bug 10)', () => {
        it('recreate the editor with the new options and keep the document', () => {
            const { result, rerender } = renderHook(
                props => useInscriptEditor({ contentKey: 'a.md', ...props }),
                { initialProps: { editorOptions: { slashCommand: true } } },
            );
            const has = ed => ed.extensionManager.extensions.some(e => e.name === 'slashCommand');
            act(() => { result.current.loadContent('<p>Kept</p>'); });
            expect(has(result.current.editor)).toBe(true);
            rerender({ editorOptions: { slashCommand: false } });
            expect(has(result.current.editor)).toBe(false);
            expect(result.current.editor.getHTML()).toBe('<p>Kept</p>');
            expect(result.current.history).toHaveLength(1);
        });

        it('a new function identity (or equal options) does not recreate the editor', () => {
            const { result, rerender } = renderHook(
                props => useInscriptEditor({ contentKey: 'a.md', ...props }),
                { initialProps: { editorOptions: { wikilink: { enabled: true, resolver: () => null } } } },
            );
            const first = result.current.editor;
            rerender({ editorOptions: { wikilink: { enabled: true, resolver: () => ({ exists: true, href: '/x' }) } } });
            expect(result.current.editor).toBe(first);
        });

        it('reads the latest wikilink resolver without recreating the editor', () => {
            let answer = null;
            const { result, rerender } = renderHook(
                props => useInscriptEditor({ contentKey: 'a.md', ...props }),
                { initialProps: { editorOptions: { wikilink: { enabled: true, resolver: () => answer } } } },
            );
            answer = { exists: true, href: '/new' };
            rerender({ editorOptions: { wikilink: { enabled: true, resolver: () => answer } } });
            const ext = result.current.editor.extensionManager.extensions.find(e => e.name === 'wikilink');
            expect(ext.options.resolver('Page')).toEqual({ exists: true, href: '/new' });
        });
    });

    describe('cap (R7)', () => {
        it('evicts the oldest versions, keeps the baseline, and keeps pointing at the same entry', () => {
            const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', maxHistory: 4 }));
            act(() => { result.current.loadContent('<p>base</p>'); });
            for (const ch of 'abcdef') { type(result.current.editor, ch); idle(); }
            expect(result.current.history).toHaveLength(4);
            expect(result.current.history[0].kind).toBe('opened');
            expect(result.current.historyIndex).toBe(3);
            expect(result.current.editor.getHTML()).toBe(result.current.history[3].html);
            act(() => { result.current.undo(); });
            const pointed = result.current.history[result.current.historyIndex];
            type(result.current.editor, 'z');
            idle();
            expect(result.current.history).toHaveLength(4);
            expect(result.current.history).toContain(pointed);
            expect(result.current.history[0].kind).toBe('opened');
        });

        it('also caps by total HTML size', () => {
            const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', maxHistoryBytes: 60 }));
            act(() => { result.current.loadContent('<p>base</p>'); });
            for (const ch of 'abcdefgh') { type(result.current.editor, ch); idle(); }
            const total = result.current.history.reduce((n, e) => n + e.html.length, 0);
            expect(total).toBeLessThanOrEqual(60);
            expect(result.current.history[0].kind).toBe('opened');
        });
    });

    describe('initialContent', () => {
        it('creates the editor with the document and seeds it as the baseline, quietly', () => {
            const onContentChange = vi.fn();
            const { result } = renderHook(() => useInscriptEditor({ contentKey: 'a', initialContent: '<p>Start</p>', title: 'T', onContentChange }));
            expect(result.current.editor.getHTML()).toBe('<p>Start</p>');
            expect(result.current.history).toHaveLength(1);
            expect(result.current.history[0]).toMatchObject({ kind: 'opened', html: '<p>Start</p>', title: 'T' });
            expect(result.current.editor.can().undo()).toBe(false);
            idle(2000);
            expect(onContentChange).not.toHaveBeenCalled();
            expect(result.current.isDirty).toBe(false);
        });

        it('seeds the next document when the editor is recreated for it', () => {
            const { result, rerender } = renderHook(
                props => useInscriptEditor(props),
                { initialProps: { contentKey: 'a', initialContent: '<p>A</p>' } },
            );
            type(result.current.editor, '!');
            idle();
            rerender({ contentKey: 'b', initialContent: '<p>B</p>' });
            expect(result.current.editor.getHTML()).toBe('<p>B</p>');
            expect(result.current.history.map(e => [e.kind, e.html])).toEqual([['opened', '<p>B</p>']]);
        });
    });
});
