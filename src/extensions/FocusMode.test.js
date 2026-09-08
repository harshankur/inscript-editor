import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NodeSelection } from '@tiptap/pm/state';
import { createEditor } from '../../tests/helpers/createEditor.js';

describe('FocusModeBlock extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
    });

    afterEach(() => {
        editor.destroy();
    });

    it('does not crash when mounted', () => {
        editor.commands.setContent('<p>Line 1</p><p>Line 2</p>');
        // Since FocusMode adds decorations only when focused, and it's hard to simulate
        // full focus/selection rendering in headless DOM, we just test that the plugin
        // evaluates cleanly without errors.
        expect(editor.getText()).toContain('Line 1');
    });

    it('does not throw when a top-level atom is node-selected while focused', () => {
        editor.commands.setContent('<p>hi</p><hr><p>bye</p>');
        // Force the plugin's guard-clause open so decorations() actually runs the
        // before(1)/nodeAt path (own props shadow the prototype getters).
        Object.defineProperty(editor, 'isEditable', { get: () => true, configurable: true });
        Object.defineProperty(editor, 'isFocused', { get: () => true, configurable: true });

        let hrPos = null;
        editor.state.doc.descendants((n, pos) => { if (n.type.name === 'horizontalRule') hrPos = pos; });
        expect(hrPos).not.toBeNull();

        // A NodeSelection on a top-level atom resolves at depth 0; the decoration must
        // still evaluate cleanly (this is the crash class we hardened against).
        expect(() => {
            editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, hrPos)));
        }).not.toThrow();
    });
});
