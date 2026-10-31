import { StrictMode } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getI18n, I18nextProvider, setI18n } from 'react-i18next';

const NAMESPACE = 'inscript-editor';

/**
 * tests/setup.js initializes the i18next singleton for every other test, which is why none of them
 * could see this crash. Each test here gets a fresh, never-initialized singleton, and a fresh copy
 * of the hook's once-per-page flag.
 */
async function freshSingleton() {
    vi.resetModules();
    const real = (await vi.importActual('i18next')).default;
    const uninitialized = real.createInstance();
    vi.doMock('i18next', async () => ({ ...(await vi.importActual('i18next')), default: uninitialized }));
    const { useInscriptEditorTranslations } = await import('../src/hooks/useInscriptEditorTranslations.js');
    return { i18next: uninitialized, useInscriptEditorTranslations, real };
}

const listeners = (i18next) => [...(i18next.observers.initialized?.keys() ?? [])];
const initialInstance = getI18n();

afterEach(() => {
    vi.doUnmock('i18next');
    vi.resetModules();
    setI18n(initialInstance);
});

describe('editor translations with i18next not initialized', () => {
    it('i18next has no store API before init, which is the cause of the crash', async () => {
        const { i18next } = await freshSingleton();
        expect(i18next.addResourceBundle).toBeUndefined();
    });

    it('the hook does not throw, and waits', async () => {
        const { i18next, useInscriptEditorTranslations } = await freshSingleton();
        expect(() => renderHook(() => useInscriptEditorTranslations())).not.toThrow();
        expect(listeners(i18next)).toHaveLength(1);
    });

    it('the whole editor mounts in English with no i18next instance anywhere', async () => {
        await freshSingleton();
        setI18n(undefined);
        const { InscriptEditor, useInscriptEditor } = await import('../src/index.js');
        function Host() {
            return <InscriptEditor {...useInscriptEditor({ initialContent: '<p>Hello</p>' })} />;
        }
        expect(() => render(<Host />)).not.toThrow();
        expect(await screen.findByText('Hello')).toBeInTheDocument();
        expect(document.querySelector('[title="Undo"]')).not.toBeNull();
    });

    it('registers when the host initializes after mount, with the host winning, and stops listening', async () => {
        const { i18next, useInscriptEditorTranslations } = await freshSingleton();
        renderHook(() => useInscriptEditorTranslations());
        await act(async () => {
            await i18next.init({ lng: 'en', resources: { en: { [NAMESPACE]: { bold: 'Fett' } } } });
        });
        expect(i18next.getResource('en', NAMESPACE, 'bold')).toBe('Fett');
        expect(i18next.getResource('en', NAMESPACE, 'undo')).toBeTruthy();
        expect(listeners(i18next)).toEqual([]);
    });

    it('registers at once if init was called but has not finished', async () => {
        const { i18next, useInscriptEditorTranslations } = await freshSingleton();
        const pending = i18next.init({ lng: 'en' });
        expect(i18next.isInitialized).toBeFalsy();
        renderHook(() => useInscriptEditorTranslations());
        expect(i18next.getResource('en', NAMESPACE, 'undo')).toBeTruthy();
        expect(listeners(i18next)).toEqual([]);
        await pending;
    });

    it('registers at once when already initialized, as before', async () => {
        const { i18next, useInscriptEditorTranslations } = await freshSingleton();
        await i18next.init({ lng: 'en' });
        renderHook(() => useInscriptEditorTranslations());
        expect(i18next.getResource('en', NAMESPACE, 'undo')).toBeTruthy();
    });

    it('keeps resources the host registered first', async () => {
        const { i18next, useInscriptEditorTranslations } = await freshSingleton();
        await i18next.init({ lng: 'en', resources: { en: { [NAMESPACE]: { undo: 'Mine' } } } });
        renderHook(() => useInscriptEditorTranslations());
        expect(i18next.getResource('en', NAMESPACE, 'undo')).toBe('Mine');
    });

    it('leaves one listener under StrictMode and many components, and none after unmount', async () => {
        const { i18next, useInscriptEditorTranslations } = await freshSingleton();
        const first = renderHook(() => useInscriptEditorTranslations(), { wrapper: StrictMode });
        const second = renderHook(() => useInscriptEditorTranslations());
        expect(listeners(i18next)).toHaveLength(1);
        first.unmount();
        second.unmount();
        expect(listeners(i18next)).toEqual([]);
    });

    it('a host with its own instance and an uninitialized singleton renders the instance strings', async () => {
        const { real } = await freshSingleton();
        const own = real.createInstance();
        await own.init({ lng: 'en', defaultNS: NAMESPACE, ns: [NAMESPACE], resources: { en: { [NAMESPACE]: { bold: 'Fett' } } } });
        const { InscriptEditor, useInscriptEditor } = await import('../src/index.js');
        function Host() {
            return <InscriptEditor {...useInscriptEditor({ initialContent: '<p>Hello</p>' })} />;
        }
        expect(() => render(<I18nextProvider i18n={own}><Host /></I18nextProvider>)).not.toThrow();
        expect(await screen.findByText('Hello')).toBeInTheDocument();
    });

    it('the public function still throws for an uninitialized instance, with this exact message', async () => {
        const { i18next } = await freshSingleton();
        const { registerInscriptEditorTranslations } = await import('../src/locales/index.js');
        expect(() => registerInscriptEditorTranslations(i18next)).toThrow('registerInscriptEditorTranslations: `i18n` must be an i18next instance.');
    });
});
