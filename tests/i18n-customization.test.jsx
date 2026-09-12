import { render, screen } from '@testing-library/react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { INSCRIPT_EDITOR_NAMESPACE, inscriptEditorTranslations, registerInscriptEditorTranslations } from '../src/locales/index.js';

function freshInstance() {
    const instance = i18next.createInstance();
    instance.use(initReactI18next).init({
        lng: 'en',
        fallbackLng: 'en',
        ns: [INSCRIPT_EDITOR_NAMESPACE],
        defaultNS: INSCRIPT_EDITOR_NAMESPACE,
        resources: {},
        interpolation: { escapeValue: false },
    });
    return instance;
}

function Probe({ i18nKey, i18n }) {
    const { t } = useTranslation(INSCRIPT_EDITOR_NAMESPACE, { i18n });
    return <span>{t(i18nKey, 'fallback-english')}</span>;
}

describe('registerInscriptEditorTranslations', () => {
    it('is idempotent — calling it repeatedly does not change the resolved strings', () => {
        const instance = freshInstance();
        registerInscriptEditorTranslations(instance);
        registerInscriptEditorTranslations(instance);
        registerInscriptEditorTranslations(instance);
        expect(instance.getFixedT('en', INSCRIPT_EDITOR_NAMESPACE)('undo')).toBe('Undo');
    });

    it('does not overwrite resources the consumer registered first (overwrite: false is the default)', () => {
        const instance = freshInstance();
        instance.addResourceBundle('en', INSCRIPT_EDITOR_NAMESPACE, { undo: 'Custom Undo' }, true, true);
        registerInscriptEditorTranslations(instance);
        expect(instance.getFixedT('en', INSCRIPT_EDITOR_NAMESPACE)('undo')).toBe('Custom Undo');
        // Untouched keys still come from the library's bundle.
        expect(instance.getFixedT('en', INSCRIPT_EDITOR_NAMESPACE)('redo')).toBe('Redo');
    });

    it('registers only shipped languages; a `languages` entry that is not shipped is not conjured', () => {
        const instance = freshInstance();
        registerInscriptEditorTranslations(instance, { languages: ['en', 'fr'] });
        expect(instance.getFixedT('en', INSCRIPT_EDITOR_NAMESPACE)('undo')).toBe('Undo');
        // Only English is bundled, so 'fr' cannot come from the whitelist (bring it via `overrides`).
        expect(instance.hasResourceBundle('fr', INSCRIPT_EDITOR_NAMESPACE)).toBe(false);
    });

    it('deep-merges `overrides` over the shipped bundle and can register a brand-new language', () => {
        const instance = freshInstance();
        registerInscriptEditorTranslations(instance, {
            overrides: {
                en: { undo: 'Undo Custom' },
                'pt-BR': { undo: 'Desfazer BR' },
            },
        });
        // Overridden key changed, sibling keys from the shipped bundle survive the merge.
        expect(instance.getFixedT('en', INSCRIPT_EDITOR_NAMESPACE)('undo')).toBe('Undo Custom');
        expect(instance.getFixedT('en', INSCRIPT_EDITOR_NAMESPACE)('redo')).toBe('Redo');
        // A language the library doesn't ship at all still gets registered via overrides.
        expect(instance.hasResourceBundle('pt-BR', INSCRIPT_EDITOR_NAMESPACE)).toBe(true);
        expect(instance.getFixedT('pt-BR', INSCRIPT_EDITOR_NAMESPACE)('undo')).toBe('Desfazer BR');
    });

    it('a component renders the English defaultValue when no bundle is registered at all', () => {
        const instance = freshInstance(); // zero resources registered
        render(<Probe i18nKey="undo" i18n={instance} />);
        expect(screen.getByText('fallback-english')).toBeInTheDocument();
    });
});

describe('inscriptEditorTranslations', () => {
    it('ships only the English bundle', () => {
        expect(Object.keys(inscriptEditorTranslations)).toEqual(['en']);
    });
});
