import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, getI18n, initReactI18next, setI18n } from 'react-i18next';
import { useInscriptT } from './useInscriptT.js';

const withI18n = i18n => ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;

describe('useInscriptT', () => {
    it('fills placeholders before the host initializes i18next', () => {
        // A host that never initializes i18next: react-i18next has no instance and returns defaults.
        const global = getI18n();
        setI18n(undefined);
        try {
            const { result } = renderHook(() => useInscriptT());
            const { t } = result.current;
            expect(t('imageWidth', 'Image width {{width}}', { width: '25%' })).toBe('Image width 25%');
            expect(t('version', { n: 3, defaultValue: 'Version {{n}}' })).toBe('Version 3');
            expect(t('bold', 'Bold')).toBe('Bold');
            // The same function on every render, so memos keyed on it hold.
            const { result: again, rerender } = renderHook(() => useInscriptT());
            const first = again.current.t;
            rerender();
            expect(again.current.t).toBe(first);
        } finally { setI18n(global); }
    });

    it('uses the translation once initialized, and does not HTML-escape the values', async () => {
        const i18n = createInstance();
        await i18n.use(initReactI18next).init({
            lng: 'fr',
            resources: { fr: { 'inscript-editor': { colorValue: '{{name}} : {{color}}' } } },
        });
        const { result } = renderHook(() => useInscriptT(), { wrapper: withI18n(i18n) });
        expect(result.current.t('colorValue', '{{name}}: {{color}}', { name: "Couleur d'arrière-plan & texte", color: '#dc2626' }))
            .toBe("Couleur d'arrière-plan & texte : #dc2626");
        expect(result.current.i18n.language).toBe('fr');
        // A value that itself holds a placeholder is not filled a second time.
        expect(result.current.t('wikilinkGoTo', 'Go to {{target}}', { target: 'a {{target}}' })).toBe('Go to a {{target}}');
    });

    it('an instance given but not initialized yet gives the English defaults, filled', () => {
        const i18n = createInstance({ react: { useSuspense: false } });
        const { result } = renderHook(() => useInscriptT(), { wrapper: withI18n(i18n) });
        expect(result.current.t('bold', 'Bold')).toBe('Bold');
        expect(result.current.t('fontSizeValue', 'Font Size {{size}}', { size: 18 })).toBe('Font Size 18');
    });
});
