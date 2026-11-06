import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { abbreviationTool } from './abbreviationTool.js';

let editor;
let element;
afterEach(() => { editor?.destroy(); element?.remove(); vi.restoreAllMocks(); });
const mount = (content) => {
    element = document.createElement('div');
    document.body.appendChild(element);
    editor = createEditor({ element, content });
};
const t = (key, fallback) => fallback;

describe('abbreviationTool', () => {
    it('without a host handler: a toggle that asks for the expansion, and removes one under the cursor', () => {
        mount('<p>HTML rocks</p>');
        editor.commands.setTextSelection({ from: 1, to: 5 });
        vi.spyOn(window, 'prompt').mockReturnValue('HyperText Markup Language');
        const tool = abbreviationTool(editor, t, undefined);
        expect(tool.toggle).toBe(true);
        expect(tool.active).toBe(false);
        tool.action();
        expect(editor.getHTML()).toContain('<abbr title="HyperText Markup Language">HTML</abbr>');
        editor.commands.setTextSelection(3);
        const again = abbreviationTool(editor, t, undefined);
        expect(again.active).toBe(true);
        again.action();
        expect(editor.getHTML()).not.toContain('<abbr');
    });
    it('with a host handler: calls it, and is no toggle', () => {
        mount('<p><abbr title="x">HTML</abbr></p>');
        editor.commands.setTextSelection(3);
        const onAdd = vi.fn();
        const tool = abbreviationTool(editor, t, onAdd);
        expect(tool.toggle).toBe(false);
        expect(tool.active).toBe(true);
        tool.action();
        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(editor.getHTML()).toContain('<abbr');
    });
});
