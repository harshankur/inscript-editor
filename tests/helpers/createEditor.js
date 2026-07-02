import { Editor } from '@tiptap/core';
import { buildExtensions } from '../../src/extensions/index.js';

/**
 * A headless (no DOM mount required by the caller) TipTap editor sharing the
 * exact extension set used by useInscriptEditor, for unit-testing extensions
 * and table helpers without going through React.
 */
export function createEditor(options = {}) {
    return new Editor({
        extensions: buildExtensions(),
        content: '',
        ...options,
    });
}
