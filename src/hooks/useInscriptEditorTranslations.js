import { useEffect } from 'react';
import i18next from 'i18next';
import { registerInscriptEditorTranslations } from '../locales/index.js';

let autoRegistered = false;

/**
 * Registers inscript-editor's bundled translations onto the active i18next singleton, once per
 * page load. `overwrite: false` means any resources a consumer registered first (e.g. their own
 * `inscript-editor` overrides via registerInscriptEditorTranslations) win over the library defaults.
 * Components still carry an English `defaultValue` on every t() call, so nothing breaks even if a
 * consumer never sets up i18next at all.
 */
export function useInscriptEditorTranslations() {
    useEffect(() => {
        if (autoRegistered) return;
        autoRegistered = true;
        registerInscriptEditorTranslations(i18next, { overwrite: false });
    }, []);
}
