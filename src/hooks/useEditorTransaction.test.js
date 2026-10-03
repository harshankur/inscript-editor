import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorTransaction } from './useEditorTransaction.js';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('useEditorTransaction', () => {
    let editor;
    afterEach(() => editor?.destroy());

    it('re-renders with a new count on every transaction, selection-only ones included', () => {
        editor = createEditor({ content: '<p>hello</p>' });
        let renders = 0;
        const { result } = renderHook(() => { renders += 1; return useEditorTransaction(editor); });
        const start = result.current;
        const rendersAtStart = renders;

        act(() => { editor.commands.insertContent('x'); });
        expect(result.current).toBeGreaterThan(start);

        const afterEdit = result.current;
        act(() => { editor.commands.setTextSelection(1); });
        expect(result.current).toBeGreaterThan(afterEdit);
        expect(renders).toBeGreaterThan(rendersAtStart);
    });

    it('returns 0 without an editor', () => {
        const { result } = renderHook(() => useEditorTransaction(null));
        expect(result.current).toBe(0);
    });
});
