import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDefaultSlashItems } from './slashCommandItems.js';
import { createEditor } from '../../tests/helpers/createEditor.js';

const t = (_key, def) => def;
const citationItem = (options) => getDefaultSlashItems(t, options).find((i) => i.id === 'citation');

describe('slash command: citation', () => {
    let editor;
    afterEach(() => { editor?.destroy(); });

    it('routes through options.onAddCitation when the host provides it (no prompt, no direct insert)', () => {
        editor = createEditor();
        editor.commands.setContent('<p></p>');
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('x');
        const onAddCitation = vi.fn();
        citationItem({ onAddCitation }).command({ editor, range: { from: 1, to: 1 } });
        expect(onAddCitation).toHaveBeenCalledTimes(1);
        expect(promptSpy).not.toHaveBeenCalled();
        expect(editor.getHTML()).not.toContain('data-key');
        promptSpy.mockRestore();
    });

    it('falls back to native prompts and inserts a citation when no host handler is given', () => {
        editor = createEditor();
        editor.commands.setContent('<p></p>');
        let n = 0;
        const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => (++n === 1 ? 'doe2026' : n === 2 ? 'Doe 2026' : 'Doe, J. (2026)'));
        citationItem({}).command({ editor, range: { from: 1, to: 1 } });
        expect(promptSpy).toHaveBeenCalledTimes(3);
        expect(editor.getHTML()).toContain('data-key="doe2026"');
        promptSpy.mockRestore();
    });

    it('cancelling the first prompt inserts nothing', () => {
        editor = createEditor();
        editor.commands.setContent('<p></p>');
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
        citationItem({}).command({ editor, range: { from: 1, to: 1 } });
        expect(editor.getHTML()).not.toContain('data-key');
        promptSpy.mockRestore();
    });
});
