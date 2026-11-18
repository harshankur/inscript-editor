import { createInstance } from 'i18next';
import * as reactI18next from 'react-i18next';
import { useInscriptT } from '../hooks/useInscriptT.js';
import { INSCRIPT_EDITOR_NAMESPACE, inscriptEditorTranslations } from '../locales/index.js';

/**
 * An i18next of the editor's own, holding its English, ready at once: what <Trans> reads when the
 * host has no initialized i18next, so it gives what it gives with one (react-i18next 18 gives an
 * empty <Trans> for an instance not initialized yet). Made when first needed, never the host's.
 */
const { Trans } = reactI18next;

/**
 * Whether <Trans> decodes entities by itself. react-i18next 18 always does, and warns that the
 * shouldUnescape it no longer reads is set; 16 and 17 do only with shouldUnescape. 18 is told apart by
 * the placeholder exports it removed (`date` and the rest, there since 16 and before).
 */
const decodesItself = !('date' in reactI18next);

let english = null;
function englishI18n() {
    if (!english) {
        english = createInstance();
        english.init({
            lng: 'en',
            fallbackLng: 'en',
            ns: [INSCRIPT_EDITOR_NAMESPACE],
            defaultNS: INSCRIPT_EDITOR_NAMESPACE,
            resources: { en: { [INSCRIPT_EDITOR_NAMESPACE]: inscriptEditorTranslations.en } },
            // Values escaped, and their text decoded again by <Trans>: a value is text, never a
            // component's tag.
            interpolation: { escapeValue: true },
            // Ready before the first render: the resources are given, nothing is loaded.
            initAsync: false,
        });
    }
    return english;
}

/**
 * react-i18next's <Trans> in the editor's namespace: through the host's i18next when it translates,
 * else through the editor's own English one (see englishI18n), so every feature of <Trans> (tags,
 * values, plurals, nested components) works the same with or without a host i18next. With `values`,
 * the values are escaped going in and the text decoded coming out (a value is never read as a tag),
 * so an entity written in the translation itself (`&lt;`) shows as the character it stands for.
 */
export function InscriptTrans(props) {
    const { translates } = useInscriptT();
    // With values: always escaped as they go in (whatever the host's escapeValue), so <Trans> reads a
    // value as text, never as a component's tag, then decoded to the text they were (React escapes
    // them once): by react-i18next 18 itself, by 16 and 17 when asked (shouldUnescape). Without
    // values, the translation's own entities are as the host's react-i18next leaves them (18 decodes
    // them, 16 and 17 keep them).
    const valueSafe = props.values ? {
        tOptions: { ...props.tOptions, interpolation: { ...props.tOptions?.interpolation, escapeValue: true } },
        ...(decodesItself ? {} : { shouldUnescape: true }),
    } : {};
    return <Trans ns={INSCRIPT_EDITOR_NAMESPACE} {...props} {...valueSafe} {...(translates ? {} : { i18n: englishI18n() })} />;
}
