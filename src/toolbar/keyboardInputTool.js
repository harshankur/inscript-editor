import { cachedPerState } from '../utils/editorView.js';

/**
 * The Keyboard Input button, shared by the toolbar and the selection menu: it turns the selected
 * text into a key, or selected keys back into text; lit when the selection holds a key (a click
 * then turns it back into text), off where neither can be done. Only for an editor with keyboard input (its command and node exist only then).
 * @param {import('@tiptap/core').Editor} editor
 */
export const keyboardInputTool = editor => {
    const active = cachedPerState(editor.state, 'canUnsetKeyboardInput', () => editor.can().unsetKeyboardInput());
    return {
        action: () => editor.chain().focus().toggleKeyboardInput().run(),
        active,
        // Toggling unsets when a key is selected (active), else sets.
        disabled: !(active || cachedPerState(editor.state, 'canSetKeyboardInput', () => editor.can().setKeyboardInput())),
    };
};
