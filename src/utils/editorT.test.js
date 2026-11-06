import { afterEach, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { editorT } from './editorT.js';

afterEach(() => vi.restoreAllMocks());

describe('editorT', () => {
    it('before the host initializes i18next: the default, its values filled, never undefined', () => {
        vi.spyOn(i18next, 'isInitialized', 'get').mockReturnValue(false);
        vi.spyOn(i18next, 't').mockReturnValue(undefined);
        expect(editorT('htmlComment', 'Hidden comment')).toBe('Hidden comment');
        expect(editorT('version', 'Version {{n}}', { n: 2 })).toBe('Version 2');
    });

    it('once initialized: the text i18next gives, values unescaped', () => {
        i18next.addResourceBundle('en', 'inscript-editor', { editorTProbe: 'By {{name}}' }, true, true);
        expect(editorT('editorTProbe', 'fallback {{name}}', { name: "O'Brien & co" })).toBe("By O'Brien & co");
    });
});

describe('editorT with an editor\'s own instance', () => {
    it('uses the instance its host\'s React tree gave the editor, not the default one', async () => {
        const { createInstance } = await import('i18next');
        const { setEditorI18n } = await import('../extensions/HostBridge.js');
        const { createEditor } = await import('../../tests/helpers/createEditor.js');
        const own = createInstance();
        await own.init({ lng: 'de', resources: { de: { 'inscript-editor': { htmlComment: 'Versteckter Kommentar' } } } });
        const german = createEditor();
        const other = createEditor();
        try {
            setEditorI18n(german, own);
            expect(editorT('htmlComment', 'Hidden comment', {}, german)).toBe('Versteckter Kommentar');
            // Another editor on the page keeps its own (here the default, English).
            expect(editorT('htmlComment', 'Hidden comment', {}, other)).toBe('Hidden comment');
        } finally { german.destroy(); other.destroy(); }
    });
});

describe('onEditorLanguageChanged', () => {
    it('follows the editor to another instance, and stops when told', async () => {
        const { createInstance } = await import('i18next');
        const { setEditorI18n } = await import('../extensions/HostBridge.js');
        const { createEditor } = await import('../../tests/helpers/createEditor.js');
        const { onEditorLanguageChanged } = await import('./editorT.js');
        const first = createInstance();
        await first.init({ lng: 'en', resources: {} });
        const second = createInstance();
        await second.init({ lng: 'it', resources: {} });
        const editor = createEditor();
        try {
            setEditorI18n(editor, first);
            let calls = 0;
            const stop = onEditorLanguageChanged(editor, () => { calls++; });
            await first.changeLanguage('de');
            expect(calls).toBe(1);
            setEditorI18n(editor, second);
            // Moved, it runs once to redraw in the new instance's language.
            expect(calls).toBe(2);
            await first.changeLanguage('fr');
            await second.changeLanguage('de');
            expect(calls).toBe(3);
            stop();
            await second.changeLanguage('fr');
            expect(calls).toBe(3);
        } finally { editor.destroy(); }
    });
});

describe('onEditorLanguageChanged without the host bridge', () => {
    it('unsubscribes from the instance it subscribed to, even if the default has changed since', async () => {
        const { createInstance } = await import('i18next');
        const { getI18n, setI18n } = await import('react-i18next');
        const { onEditorLanguageChanged } = await import('./editorT.js');
        const before = getI18n();
        const first = createInstance();
        await first.init({ lng: 'en', resources: {} });
        const later = createInstance();
        await later.init({ lng: 'en', resources: {} });
        setI18n(first);
        try {
            let calls = 0;
            const stop = onEditorLanguageChanged(null, () => { calls++; });
            setI18n(later);
            stop();
            await first.changeLanguage('de');
            expect(calls).toBe(0);
        } finally { setI18n(before); }
    });
});

