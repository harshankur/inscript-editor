// <InscriptEditor> wired to useInscriptEditor exactly as the README says (spread the hook's result):
// toolbar Undo/Redo, the history panel's Restore, the imperative ref handle, and React-rendered
// nodes surviving an editor replacement.
import { Activity, createRef, StrictMode, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from '../useInscriptEditor.js';
import { InscriptEditor } from '../../InscriptEditor.jsx';

vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children }) => <div data-testid="bubble-menu">{children}</div>,
    FloatingMenu: ({ children }) => <div data-testid="floating-menu">{children}</div>,
}));

const idle = (ms = 1000) => act(() => { vi.advanceTimersByTime(ms); });
const tick = (ms = 5) => act(() => { vi.advanceTimersByTime(ms); });
const type = (editor, text) => act(() => { editor.commands.insertContent(text); });

let api;
let calls;
const ref = createRef();
const onContentChange = (entry, info) => calls.push({ entry, reason: info?.reason });

function Host({ showDiff = false, hookProps = {} }) {
    api = useInscriptEditor({ contentKey: 'k', onContentChange, ...hookProps });
    return <InscriptEditor {...api} showDiff={showDiff} ref={ref} />;
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

const reactErrors = () => errorSpy.mock.calls.map(args => String(args[0]).slice(0, 160));

describe('toolbar Undo/Redo (hook result spread in)', () => {
    it('undo and redo walk the versions and notify the host', () => {
        render(tree());
        act(() => { api.loadContent('<p>A</p>'); });
        type(api.editor, 'B'); idle();
        type(api.editor, 'C'); idle();
        expect(screen.getByTitle('Undo')).not.toBeDisabled();
        fireEvent.click(screen.getByTitle('Undo'));
        expect(api.editor.getHTML()).toBe('<p>AB</p>');
        fireEvent.click(screen.getByTitle('Undo'));
        expect(api.editor.getHTML()).toBe('<p>A</p>');
        expect(screen.getByTitle('Undo')).toBeDisabled();
        fireEvent.click(screen.getByTitle('Redo'));
        expect(api.editor.getHTML()).toBe('<p>AB</p>');
        expect(calls.map(c => c.reason)).toEqual(['edit', 'edit', 'undo', 'undo', 'redo']);
        expect(reactErrors()).toEqual([]);
    });

    it('Undo is offered right after typing on the opened document (undo() would step back)', () => {
        render(tree());
        act(() => { api.loadContent('<p>A</p>'); });
        type(api.editor, 'B');
        // The user typed, so there is something to undo: the hook's undo() commits and steps back.
        expect(screen.getByTitle('Undo')).not.toBeDisabled();
    });

    it('Redo is not offered while an edit made after an undo is pending (redo() would do nothing)', () => {
        render(tree());
        act(() => { api.loadContent('<p>A</p>'); });
        type(api.editor, 'B'); idle();
        fireEvent.click(screen.getByTitle('Undo'));
        type(api.editor, 'C');
        expect(screen.getByTitle('Redo')).toBeDisabled();
    });
});

describe('history panel Restore', () => {
    it('restores the selected version as a new one', () => {
        const { rerender } = render(tree());
        act(() => { api.loadContent('<p>A</p>'); });
        type(api.editor, 'B'); idle();
        type(api.editor, 'C'); idle();
        rerender(tree({ showDiff: true }));
        fireEvent.click(screen.getByText('Opened'));
        fireEvent.click(screen.getByText('Restore Version'));
        expect(api.history.map(e => e.kind)).toEqual(['opened', 'edited', 'edited', 'restored']);
        expect(api.editor.getHTML()).toBe('<p>A</p>');
        rerender(tree());
        expect(api.editor.getHTML()).toBe('<p>A</p>');
        expect(reactErrors()).toEqual([]);
    });

    it('restores the version clicked when a title edit is pending and the history is full', () => {
        const { rerender } = render(tree({ hookProps: { maxHistory: 3, title: 'T1' } }));
        act(() => { api.loadContent('<p>A</p>', { title: 'T1' }); });
        type(api.editor, 'B'); idle();
        type(api.editor, 'C'); idle();
        // History full: Opened, Version 1 (AB), Version 2 (ABC). The panel opens; the user edits the
        // title in the host's own field and, within a second, restores Version 1.
        rerender(tree({ showDiff: true, hookProps: { maxHistory: 3, title: 'T2' } }));
        fireEvent.click(screen.getByText('Version 1'));
        fireEvent.click(screen.getByText('Restore Version'));
        const active = api.history[api.historyIndex];
        expect(active.html).toBe('<p>AB</p>');
    });
});

describe('imperative ref handle', () => {
    it('loadContent, flush, undo, redo, restoreVersion, markSaved, getHTML agree with the hook', () => {
        render(tree());
        act(() => { expect(ref.current.loadContent('<p>A</p>')).toBe(true); });
        expect(ref.current.getHTML()).toBe('<p>A</p>');
        type(api.editor, 'B');
        let snap;
        act(() => { snap = ref.current.flush(); });
        expect(snap.history.map(e => e.html)).toEqual(['<p>A</p>', '<p>AB</p>']);
        act(() => { expect(ref.current.undo()).toBe(true); });
        expect(ref.current.getHTML()).toBe('<p>A</p>');
        act(() => { expect(ref.current.redo()).toBe(true); });
        expect(ref.current.getHTML()).toBe('<p>AB</p>');
        act(() => { expect(ref.current.restoreVersion(0, { reason: 'restore' })).toBe(true); });
        expect(api.history.map(e => e.kind)).toEqual(['opened', 'edited', 'restored']);
        act(() => { expect(ref.current.restoreVersion(1)).toBe(true); });
        expect(ref.current.getHTML()).toBe('<p>AB</p>');
        expect(api.historyIndex).toBe(1);
        act(() => { ref.current.markSaved(); });
        expect(api.isDirty).toBe(false);
        act(() => { ref.current.setContent('<p>Z</p>'); });
        idle();
        expect(api.history[api.historyIndex]).toMatchObject({ kind: 'edited', html: '<p>Z</p>' });
        expect(calls.map(c => c.reason)).toEqual(['edit', 'undo', 'redo', 'restore', 'undo', 'edit']);
        expect(reactErrors()).toEqual([]);
    });

    it('flush() through the ref in the same handler as a setContent returns the new version', () => {
        render(tree());
        act(() => { ref.current.loadContent('<p>A</p>'); });
        let snap;
        act(() => {
            ref.current.setContent('<p>Q</p>');
            snap = ref.current.flush();
        });
        expect(snap.history.map(e => e.html)).toEqual(['<p>A</p>', '<p>Q</p>']);
    });
});

// React-rendered nodes mount through flushSync. The hook itself puts the document into a
// replacement editor from a passive effect, which is where React refuses flushSync.
const RICH = '<p>x</p><div class="admonition admonition-note" data-type="note"><p>note</p></div>';

describe('React-rendered nodes across an editor replacement', () => {
    it('an editorOptions change keeps the document without React errors', () => {
        const { rerender } = render(tree({ hookProps: { editorOptions: { slashCommand: true } } }));
        act(() => { api.loadContent(RICH); });
        const html = api.editor.getHTML();
        errorSpy.mockClear();
        rerender(tree({ hookProps: { editorOptions: { slashCommand: false } } }));
        tick();
        expect(api.editor.getHTML()).toBe(html);
        expect(reactErrors()).toEqual([]);
    });

    it('a contentKey change with a documentKey keeps the document without React errors', () => {
        const { rerender } = render(tree({ hookProps: { contentKey: 'k1', documentKey: 'd' } }));
        act(() => { api.loadContent(RICH); });
        errorSpy.mockClear();
        rerender(tree({ hookProps: { contentKey: 'k2', documentKey: 'd' } }));
        tick();
        expect(reactErrors()).toEqual([]);
    });

    it('<Activity> hidden until destroyed, then shown, without React errors', () => {
        const { rerender } = render(tree({ hookProps: { documentKey: 'd' } }));
        act(() => { api.loadContent(RICH); });
        const html = api.editor.getHTML();
        errorSpy.mockClear();
        rerender(tree({ mode: 'hidden', hookProps: { documentKey: 'd' } }));
        tick();
        rerender(tree({ hookProps: { documentKey: 'd' } }));
        tick();
        expect(api.editor.getHTML()).toBe(html);
        expect(reactErrors()).toEqual([]);
    });

    it('initialContent with React-rendered nodes mounts without React errors (StrictMode)', () => {
        render(tree({ strict: true, hookProps: { initialContent: RICH } }));
        tick();
        idle(2000);
        expect(api.history).toHaveLength(1);
        expect(reactErrors()).toEqual([]);
    });

    it('undo across a React-rendered node from the toolbar logs no React error', () => {
        render(tree());
        act(() => { api.loadContent(RICH); });
        type(api.editor, 'y'); idle();
        errorSpy.mockClear();
        fireEvent.click(screen.getByTitle('Undo'));
        expect(reactErrors()).toEqual([]);
    });
});

describe('a replacement editor and React-rendered nodes', () => {
    it('the React-rendered node renders in the replacement editor', async () => {
        const { rerender, container } = render(tree({ hookProps: { editorOptions: { slashCommand: true } } }));
        act(() => { api.loadContent(RICH); });
        rerender(tree({ hookProps: { editorOptions: { slashCommand: false } } }));
        // Node views of an editor created holding its document render a microtask later.
        await act(async () => { await Promise.resolve(); });
        expect(container.querySelector('.ProseMirror .admonition')).not.toBeNull();
        expect(container.querySelector('.ProseMirror .admonition').textContent).toContain('note');
    });
});
