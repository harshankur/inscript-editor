// The hook's functions as effect dependencies. flush/undo/redo/restoreVersion/markSaved are
// stable; a host that lists loadContent in its effect deps (as the rules of hooks ask) must not
// have its load effect re-run when the editor is recreated for the same document.
import { useEffect, useState } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInscriptEditor } from '../useInscriptEditor.js';

const idle = (ms = 1000) => act(() => { vi.advanceTimersByTime(ms); });

let api;
let loads;
function Host({ slash = true }) {
    const [docId] = useState('a');
    api = useInscriptEditor({ contentKey: 'one', documentKey: docId, editorOptions: { slashCommand: slash } });
    const { loadContent } = api;
    useEffect(() => {
        queueMicrotask(() => { loads += 1; loadContent('<p>Saved document</p>'); });
    }, [docId, loadContent]);
    return null;
}

describe('stable API identities', () => {
    beforeEach(() => { vi.useFakeTimers(); loads = 0; });
    afterEach(() => { vi.useRealTimers(); });

    it('an editorOptions change does not re-run a load effect that lists loadContent', async () => {
        const { rerender } = render(<Host />);
        await act(async () => { await Promise.resolve(); });
        act(() => { api.editor.commands.insertContent('typed '); });
        idle();
        expect(api.history.map(e => e.kind)).toEqual(['opened', 'edited']);
        rerender(<Host slash={false} />);                     // same document, new editor
        await act(async () => { await Promise.resolve(); });
        expect(loads).toBe(1);
        // The typing (at the end, where a load leaves the cursor) is still there: no second load.
        expect(api.editor.getHTML()).toBe('<p>Saved documenttyped </p>');
        expect(api.history.map(e => e.kind)).toEqual(['opened', 'edited']);
    });

    // (An <Activity> reveal re-runs every effect whatever its deps, so a host's load effect
    // re-runs there by React's design; not counted against loadContent.)

    it('the other functions keep their identity across an editor recreation', () => {
        const { rerender } = render(<Host />);
        const before = { ...api };
        rerender(<Host slash={false} />);
        for (const name of ['flush', 'undo', 'redo', 'restoreVersion', 'markSaved', 'setHistory', 'setHistoryIndex', 'loadContent']) {
            expect([name, api[name] === before[name]]).toEqual([name, true]);
        }
    });
});
