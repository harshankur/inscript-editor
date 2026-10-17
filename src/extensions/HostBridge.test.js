import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { getExternalOpener, getHostHandlers, setExternalOpener } from './HostBridge.js';

describe('HostBridge', () => {
    let editor;
    afterEach(() => editor?.destroy());

    describe('getHostHandlers', () => {
        it('reads the live handlers ref', () => {
            const onAddYoutube = () => {};
            editor = createEditor({}, { hostHandlersRef: { current: { onAddYoutube } } });
            expect(getHostHandlers(editor)).toEqual({ onAddYoutube });
        });

        it('is {} without a ref, or without an editor', () => {
            editor = createEditor();
            expect(getHostHandlers(editor)).toEqual({});
            expect(getHostHandlers(null)).toEqual({});
        });
    });

    describe('external opener', () => {
        it("prefers the opener <InscriptEditor> published over editorOptions.onOpenExternal", () => {
            const fromProp = vi.fn();
            const fromOptions = vi.fn();
            editor = createEditor({}, { hostHandlersRef: { current: { onOpenExternal: fromOptions } } });
            setExternalOpener(editor, fromProp);
            expect(getExternalOpener(editor)).toBe(fromProp);
        });

        it('falls back to editorOptions.onOpenExternal when none is published', () => {
            const fromOptions = vi.fn();
            editor = createEditor({}, { hostHandlersRef: { current: { onOpenExternal: fromOptions } } });
            expect(getExternalOpener(editor)).toBe(fromOptions);
        });

        it('is null when the host has neither, so the browser opens the link', () => {
            editor = createEditor();
            expect(getExternalOpener(editor)).toBeNull();
            expect(getExternalOpener(null)).toBeNull();
        });

        it('clears a published opener with null, and ignores a value that is not a function', () => {
            editor = createEditor();
            setExternalOpener(editor, vi.fn());
            setExternalOpener(editor, null);
            expect(getExternalOpener(editor)).toBeNull();
            setExternalOpener(editor, 'not a function');
            expect(getExternalOpener(editor)).toBeNull();
        });

        it('ignores an editorOptions.onOpenExternal that is not a function', () => {
            editor = createEditor({}, { hostHandlersRef: { current: { onOpenExternal: 'nope' } } });
            expect(getExternalOpener(editor)).toBeNull();
        });

        it('does nothing without an editor', () => {
            expect(() => setExternalOpener(null, vi.fn())).not.toThrow();
        });
    });
});
