import { useEffect } from 'react';
import i18next from 'i18next';
import { registerInscriptEditorTranslations } from '../locales/index.js';

let autoRegistered = false;

function registerOnce() {
    if (autoRegistered) return;
    autoRegistered = true;
    i18next.off('initialized', registerOnce);
    registerInscriptEditorTranslations(i18next, { overwrite: false });
}

/**
 * Registers inscript-editor's bundled translations onto the active i18next singleton
 * once per page load. `overwrite: false` means any resources a consumer registered first
 * (e.g. `inscript-editor` overrides via registerInscriptEditorTranslations) win over the
 * library defaults.
 *
 * i18next only gains its store API (`addResourceBundle`) once `init()` has been called. Until
 * then this waits for the host to initialize, so an app that never does, or does so after the
 * editor mounts, renders fine. Components carry an English `defaultValue` on every t() call.
 */
export function useInscriptEditorTranslations() {
    useEffect(() => {
        if (autoRegistered) return undefined;
        if (typeof i18next.addResourceBundle === 'function') {
            registerOnce();
            return undefined;
        }
        i18next.on('initialized', registerOnce);
        return () => i18next.off('initialized', registerOnce);
    }, []);
}
