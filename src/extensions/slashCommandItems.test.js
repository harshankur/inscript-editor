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

describe('slash command: inline math', () => {
    let editor;
    afterEach(() => { editor?.destroy(); });
    const item = () => getDefaultSlashItems(t, {}).find((i) => i.id === 'mathInline');

    it('replaces the typed query with inline math', () => {
        editor = createEditor({ content: '<p>a /inl</p>' });
        editor.commands.setTextSelection(7);
        item().command({ editor, range: { from: 3, to: 7 } });
        const paragraph = editor.state.doc.firstChild;
        expect(paragraph.textContent).toBe('a ');
        expect(paragraph.lastChild.type.name).toBe('mathInline');
    });

    it('leaves the typed query between two inline code spans, where inline math cannot go once it is gone', () => {
        editor = createEditor({ content: '<p><code>ab</code>/inl<code>cd</code></p>' });
        editor.commands.setTextSelection(7);
        const before = editor.getHTML();
        item().command({ editor, range: { from: 3, to: 7 } });
        expect(editor.getHTML()).toBe(before);
    });

    it('leaves the typed query where inline math cannot go, rather than removing it for nothing', () => {
        editor = createEditor({ content: '<pre><code>/inl</code></pre>' });
        editor.commands.setTextSelection(5);
        const before = editor.getHTML();
        item().command({ editor, range: { from: 1, to: 5 } });
        expect(editor.getHTML()).toBe(before);
        expect(editor.state.doc.firstChild.textContent).toBe('/inl');
    });
});

describe('slash command: image', () => {
    let editor;
    afterEach(() => { editor?.destroy(); vi.restoreAllMocks(); });

    it('is offered for an image-file handler in the slash options themselves', () => {
        editor = createEditor({ content: '<p>/im</p>' });
        const image = getDefaultSlashItems(t, { onImageFile: () => 'assets/a.png' }).find((i) => i.id === 'image');
        expect(image.isAvailable({ editor })).toBe(true);
    });

    it('is offered for, and picks through, an image-file handler the editor was built with', () => {
        const onImageFile = vi.fn(() => 'assets/a.png');
        editor = createEditor({ content: '<p>/im</p>' }, { onImageFile });
        const image = getDefaultSlashItems(t, {}).find((i) => i.id === 'image');
        expect(image.isAvailable({ editor })).toBe(true);
        const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
        image.command({ editor, range: { from: 1, to: 4 } });
        expect(click).toHaveBeenCalledTimes(1);
        document.querySelector('input[type=file]')?.remove();
    });
});
