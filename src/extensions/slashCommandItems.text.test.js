import { afterEach, describe, expect, it } from 'vitest';
import { createInstance } from 'i18next';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { setEditorI18n } from './HostBridge.js';
import { getDefaultSlashItems, slashItemText } from './slashCommandItems.js';
import { editorT } from '../utils/editorT.js';

let editor;
afterEach(() => editor?.destroy());

describe('slashItemText', () => {
    it('gives a built-in item\'s text in the editor\'s language, and a host\'s item as given', async () => {
        const german = createInstance();
        await german.init({ lng: 'de', resources: { de: { 'inscript-editor': { heading1: 'Überschrift 1' } } } });
        editor = createEditor();
        setEditorI18n(editor, german);
        const [h1] = getDefaultSlashItems(editorT);
        expect(slashItemText(h1, 'title', editor)).toBe('Überschrift 1');
        // A host's copy with its own title, and a host's own item with keys it translates itself.
        expect(slashItemText({ ...h1, title: 'My heading' }, 'title', editor)).toBe('My heading');
        expect(slashItemText({ titleKey: 'heading1', title: 'Translated by host' }, 'title', editor)).toBe('Translated by host');
    });
});
