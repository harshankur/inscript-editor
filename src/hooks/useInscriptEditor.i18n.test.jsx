import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { useInscriptEditor } from './useInscriptEditor.js';

function Probe({ onEditor }) {
    const { editor } = useInscriptEditor({ initialContent: '<p>x</p>' });
    onEditor(editor);
    return null;
}

describe('useInscriptEditor and the host\'s i18next', () => {
    it('gives each editor the instance its own provider holds, for text built outside React', async () => {
        const german = createInstance();
        await german.init({ lng: 'de', resources: { de: { 'inscript-editor': {} } } });
        const french = createInstance();
        await french.init({ lng: 'fr', resources: { fr: { 'inscript-editor': {} } } });
        let first = null;
        let second = null;
        const { unmount } = render(
            <>
                <I18nextProvider i18n={german}><Probe onEditor={e => { first = e ?? first; }} /></I18nextProvider>
                <I18nextProvider i18n={french}><Probe onEditor={e => { second = e ?? second; }} /></I18nextProvider>
            </>,
        );
        expect(first.storage.hostBridge.i18n).toBe(german);
        expect(second.storage.hostBridge.i18n).toBe(french);
        unmount();
    });

    it('never suspends the host\'s component, even with an instance that is not ready', () => {
        const notReady = createInstance();
        let editor = null;
        expect(() => render(
            <I18nextProvider i18n={notReady}><Probe onEditor={e => { editor = e ?? editor; }} /></I18nextProvider>,
        )).not.toThrow();
        expect(editor).not.toBeNull();
    });
});
