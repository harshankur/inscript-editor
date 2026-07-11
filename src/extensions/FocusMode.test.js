import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
});
