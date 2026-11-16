import { afterEach, describe, expect, it } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { toolIsAvailable, unavailableToolIds } from './toolAvailability.js';

let editor;
afterEach(() => editor?.destroy());

describe('toolIsAvailable', () => {
    it('is false for a tool whose feature the host turned off, true otherwise', () => {
        editor = createEditor({}, { keyboardInput: false });
        expect(toolIsAvailable(editor, 'kbd')).toBe(false);
        expect(toolIsAvailable(editor, 'details')).toBe(true);
        expect(toolIsAvailable(editor, 'bold')).toBe(true);
        expect(unavailableToolIds(editor)).toEqual(['kbd']);
    });
});
