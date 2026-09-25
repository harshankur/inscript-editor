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

describe('slash item labels', () => {
    it('follow an i18n language switch made after the items were built', async () => {
        const i18n = (await import('i18next')).default;
        i18n.addResourceBundle('de', 'inscript-editor', { heading1: 'Überschrift 1', h1Subtitle: 'Große Überschrift' }, true, true);
        const live = (k, f) => i18n.t(k, { defaultValue: f, ns: 'inscript-editor' });
        const [h1] = getDefaultSlashItems(live, {});
        try {
            expect(h1.title).toBe('Heading 1');
            await i18n.changeLanguage('de');
            expect(h1.title).toBe('Überschrift 1');
            expect(h1.subtitle).toBe('Große Überschrift');
            expect(h1).toMatchObject({ titleKey: 'heading1', subtitleKey: 'h1Subtitle' });
        } finally {
            await i18n.changeLanguage('en');
        }
    });

    it('keep their English defaults when a key has no translation', () => {
        const [h1] = getDefaultSlashItems((k, f) => f, {});
        expect(h1.title).toBe('Heading 1');
        expect(h1.subtitle).toBe('Big section heading');
    });
});
