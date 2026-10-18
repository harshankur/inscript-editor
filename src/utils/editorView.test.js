import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { hasView, isActiveCached, viewDom } from './editorView.js';

let editor;
afterEach(() => { if (editor && !editor.isDestroyed) editor.destroy(); });

describe('editorView helpers', () => {
    it('hasView and viewDom follow the editor being destroyed', () => {
        editor = createEditor({ content: '<p>x</p>' });
        expect(hasView(editor)).toBe(true);
        expect(viewDom(editor)).toBe(editor.view.dom);
        editor.destroy();
        expect(hasView(editor)).toBe(false);
        expect(viewDom(editor)).toBeNull();
        expect(hasView(null)).toBe(false);
    });

    it('isActiveCached answers like isActive, once per state', () => {
        editor = createEditor({ content: '<p><strong>bold</strong> plain</p><h2>Head</h2>' });
        editor.commands.setTextSelection(2);
        const spy = vi.spyOn(editor, 'isActive');
        expect(isActiveCached(editor, 'bold')).toBe(true);
        expect(isActiveCached(editor, 'bold')).toBe(true);
        expect(isActiveCached(editor, 'heading', { level: 2 })).toBe(false);
        expect(spy).toHaveBeenCalledTimes(2);
        editor.commands.setTextSelection(14);
        expect(isActiveCached(editor, 'bold')).toBe(false);
        expect(isActiveCached(editor, 'heading', { level: 2 })).toBe(true);
        expect(spy).toHaveBeenCalledTimes(4);
    });

    it('isActiveCached is false without a live editor', () => {
        editor = createEditor();
        editor.destroy();
        expect(isActiveCached(editor, 'bold')).toBe(false);
        expect(isActiveCached(null, 'bold')).toBe(false);
    });
});
