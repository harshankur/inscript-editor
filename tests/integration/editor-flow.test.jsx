import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from '../../src/hooks/useInscriptEditor.js';
import { InscriptEditor } from '../../src/InscriptEditor.jsx';

vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children }) => <div data-testid="bubble-menu">{children}</div>,
    FloatingMenu: ({ children }) => <div data-testid="floating-menu">{children}</div>,
}));

// Mirrors how App.jsx wires the hook and component together: undo/redo drive
// restoreVersion directly, showDiff swaps to the history view. Takes the hook's
// return value as a prop rather than calling useInscriptEditor itself, so a test
// can drive a single shared hook instance through both the hook API and the UI.
function Harness({ hook }) {
    const { editor, history, historyIndex, canUndo, canRedo, restoreVersion, markSaved, isDirty } = hook;
    const [showDiff, setShowDiff] = useState(false);

    return (
        <div>
            <div data-testid="dirty-flag">{String(isDirty)}</div>
            <button onClick={() => setShowDiff((v) => !v)}>Toggle Diff</button>
            <InscriptEditor
                editor={editor}
                showDiff={showDiff}
                history={history}
                historyIndex={historyIndex}
                canUndo={canUndo}
                canRedo={canRedo}
                onHistoryUndo={() => restoreVersion(historyIndex - 1)}
                onHistoryRedo={() => restoreVersion(historyIndex + 1)}
                onHistorySelect={(index) => { restoreVersion(index, { reason: 'restore' }); setShowDiff(false); }}
                restoreVersion={restoreVersion}
                markSaved={markSaved}
            />
        </div>
    );
}

describe('full editor integration', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('edits made via editor.commands flow through the debounce into history, driving the toolbar undo state', () => {
        let hookRef;
        function Capture() {
            const hook = useInscriptEditor({ contentKey: 'a.md' });
            hookRef = hook;
            return (
                <InscriptEditor
                    editor={hook.editor}
                    history={hook.history}
                    historyIndex={hook.historyIndex}
                    canUndo={hook.canUndo}
                    canRedo={hook.canRedo}
                    onHistoryUndo={() => hook.restoreVersion(hook.historyIndex - 1)}
                    onHistoryRedo={() => hook.restoreVersion(hook.historyIndex + 1)}
                    restoreVersion={hook.restoreVersion}
                    markSaved={hook.markSaved}
                />
            );
        }
        const { rerender } = render(<Capture />);

        expect(screen.getByTitle('Undo')).toBeDisabled();

        // canUndo requires historyIndex > 0, i.e. at least two pushed entries to step back through.
        act(() => { hookRef.editor.commands.insertContent('hello'); });
        act(() => { vi.advanceTimersByTime(1000); });
        rerender(<Capture />);
        expect(screen.getByTitle('Undo')).toBeDisabled();

        act(() => { hookRef.editor.commands.insertContent(' world'); });
        act(() => { vi.advanceTimersByTime(1000); });
        rerender(<Capture />);

        expect(screen.getByTitle('Undo')).not.toBeDisabled();
    });

    it('undo/redo toolbar buttons restore content via restoreVersion', () => {
        let hookRef;
        function Capture() {
            const hook = useInscriptEditor({ contentKey: 'a.md' });
            hookRef = hook;
            return (
                <InscriptEditor
                    editor={hook.editor}
                    history={hook.history}
                    historyIndex={hook.historyIndex}
                    canUndo={hook.canUndo}
                    canRedo={hook.canRedo}
                    onHistoryUndo={() => hook.restoreVersion(hook.historyIndex - 1)}
                    onHistoryRedo={() => hook.restoreVersion(hook.historyIndex + 1)}
                    restoreVersion={hook.restoreVersion}
                    markSaved={hook.markSaved}
                />
            );
        }
        const { rerender } = render(<Capture />);

        act(() => { hookRef.editor.commands.insertContent('a'); });
        act(() => { vi.advanceTimersByTime(1000); });
        rerender(<Capture />);
        act(() => { hookRef.editor.commands.insertContent('b'); });
        act(() => { vi.advanceTimersByTime(1000); });
        rerender(<Capture />);

        expect(hookRef.editor.getHTML()).toBe('<p>ab</p>');

        fireEvent.click(screen.getByTitle('Undo'));
        rerender(<Capture />);
        expect(hookRef.editor.getHTML()).toBe('<p>a</p>');

        fireEvent.click(screen.getByTitle('Redo'));
        rerender(<Capture />);
        expect(hookRef.editor.getHTML()).toBe('<p>ab</p>');
    });

    it('restoring a version from the HistoryView diff updates the live editor content', () => {
        let hookRef;
        function Capture() {
            const hook = useInscriptEditor({ contentKey: 'a.md' });
            hookRef = hook;
            return <Harness hook={hook} />;
        }
        const { rerender, container } = render(<Capture />);

        act(() => { hookRef.loadContent('<p>first</p>'); });
        act(() => { hookRef.editor.commands.insertContent(' second'); });
        act(() => { vi.advanceTimersByTime(1000); });
        rerender(<Capture />);

        fireEvent.click(screen.getByText('Toggle Diff'));
        rerender(<Capture />);

        // No originalContent is passed: the reference defaults to the loaded baseline.
        expect(container.querySelector('[data-history-preview="reference"]').textContent).toBe('first');

        fireEvent.click(screen.getByText('Opened'));
        fireEvent.click(screen.getByText('Restore Version'));
        rerender(<Capture />);

        expect(hookRef.editor.getHTML()).toBe('<p>first</p>');
        expect(hookRef.history.map(e => e.kind)).toEqual(['opened', 'edited', 'restored']);
    });

    it('spreading the hook result wires Undo, Redo and the panel Restore with no handlers', () => {
        let hookRef;
        const onContentChange = vi.fn();
        function Capture() {
            const hook = useInscriptEditor({ contentKey: 'a.md', onContentChange });
            hookRef = hook;
            return <InscriptEditor {...hook} />;
        }
        const { rerender } = render(<Capture />);
        act(() => { hookRef.loadContent('<p>A</p>'); });
        rerender(<Capture />);
        expect(screen.getByTitle('Undo')).toBeDisabled();
        act(() => { hookRef.editor.commands.insertContent('B'); });
        act(() => { vi.advanceTimersByTime(1000); });
        rerender(<Capture />);

        fireEvent.click(screen.getByTitle('Undo'));
        rerender(<Capture />);
        expect(hookRef.editor.getHTML()).toBe('<p>A</p>');
        fireEvent.click(screen.getByTitle('Redo'));
        rerender(<Capture />);
        expect(hookRef.editor.getHTML()).toBe('<p>AB</p>');
        expect(onContentChange.mock.calls.map(([, info]) => info.reason)).toEqual(['edit', 'undo', 'redo']);
    });

    it('markSaved clears the dirty flag surfaced by the hook', () => {
        let hookRef;
        function Capture() {
            const hook = useInscriptEditor({ contentKey: 'a.md' });
            hookRef = hook;
            return <div data-testid="dirty">{String(hook.isDirty)}</div>;
        }
        const { rerender, getByTestId } = render(<Capture />);

        act(() => { hookRef.editor.commands.insertContent('a'); });
        act(() => { vi.advanceTimersByTime(1000); });
        rerender(<Capture />);
        expect(getByTestId('dirty')).toHaveTextContent('true');

        act(() => { hookRef.markSaved(); });
        rerender(<Capture />);
        expect(getByTestId('dirty')).toHaveTextContent('false');
    });
});
