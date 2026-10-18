// The README's own recipes, run as written, in StrictMode with <InscriptEditor> mounted and a
// document holding React-rendered nodes.
import { StrictMode, useEffect, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from '../useInscriptEditor.js';
import { InscriptEditor } from '../../InscriptEditor.jsx';

vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children }) => <div>{children}</div>,
    FloatingMenu: ({ children }) => <div>{children}</div>,
}));

const idle = (ms = 1000) => act(() => { vi.advanceTimersByTime(ms); });
const DOCS = {
    a: { html: '<p>Document A</p><div class="admonition admonition-note" data-type="note"><p>note</p></div>', title: 'A' },
    b: { html: '<p>Document B</p>', title: 'B' },
};

let api;
let calls;
let switchTo;
const saved = {};

// One editor, documents switched by documentKey, loaded from a deferred effect; the outgoing
// document flushed and saved in the same handler that switches.
function OneEditorHost() {
    const [docId, setDocId] = useState('a');
    api = useInscriptEditor({
        contentKey: 'single', documentKey: docId, title: DOCS[docId].title,
        onContentChange: (entry, info) => calls.push([docId, info.reason, entry.html]),
    });
    const { loadContent } = api;
    useEffect(() => {
        queueMicrotask(() => {
            const persisted = saved[docId];
            if (persisted) loadContent(persisted.history[persisted.historyIndex].html, { title: DOCS[docId].title, ...persisted });
            else loadContent(DOCS[docId].html, { title: DOCS[docId].title });
        });
    }, [docId, loadContent]);
    switchTo = (next) => {
        saved[docId] = api.flush();
        setDocId(next);
    };
    return <InscriptEditor {...api} />;
}

describe('README: one editor, documentKey switch, deferred load, flush before switching', () => {
    let errorSpy;
    beforeEach(() => { vi.useFakeTimers(); calls = []; for (const k of Object.keys(saved)) delete saved[k]; errorSpy = vi.spyOn(console, 'error'); });
    afterEach(() => { errorSpy.mockRestore(); vi.useRealTimers(); });

    it('keeps each document\'s history, notifies only edits, and logs no React error', async () => {
        render(<StrictMode><OneEditorHost /></StrictMode>);
        await act(async () => { await Promise.resolve(); });
        idle(10);
        expect(api.history.map(e => e.kind)).toEqual(['opened']);
        act(() => { api.editor.commands.focus('end'); api.editor.commands.insertContent('!'); });
        // Switch within the debounce: flush() must carry the typing into A's saved stack.
        await act(async () => { switchTo('b'); await Promise.resolve(); });
        expect(saved.a.history.map(e => e.kind)).toEqual(['opened', 'edited']);
        expect(api.history.map(e => e.html)).toEqual(['<p>Document B</p>']);
        idle(3000);
        expect(api.history).toHaveLength(1);
        // And back: A reopens at its pointer, nothing added.
        await act(async () => { switchTo('a'); await Promise.resolve(); });
        idle(3000);
        expect(api.history.map(e => e.kind)).toEqual(['opened', 'edited']);
        expect(api.historyIndex).toBe(1);
        expect(calls.map(c => c.slice(0, 2))).toEqual([['a', 'edit']]);
        fireEvent.click(screen.getByTitle('Undo'));
        expect(api.editor.getHTML()).toBe(saved.a.history[0].html);
        expect(errorSpy).not.toHaveBeenCalled();
    });
});
