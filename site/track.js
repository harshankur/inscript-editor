// Page views on the self-hosted viewcounter. Every page of the site is counted at the edge,
// without consent and without anything running on the page. Call trackPageView() once from
// the homepage entry: it adds the viewcounter's consent prompt (consent.js), which asks the
// visitor whether the site may count in more detail. Only after "Allow" does it load the
// tracker, which then also counts how long the page was visible, how far it was scrolled, and
// clicks on links out and downloads. The answer is the one thing kept on the device, in
// localStorage, and the footer's "Privacy settings" link (data-viewcounter-consent)
// opens the prompt again to change it. Never blocks rendering (the script loads async) and a
// failed load is simply a visit not counted in detail.
//
// The embed page loads none of this: it is counted at the edge only. Its own
// "Privacy settings" link opens this page at SETTINGS_HASH, where the prompt opens.
//
// Exported as a called function (not a bare side-effect import) on purpose: the root
// package.json marks every non-CSS module side-effect-free, so a side-effect-only
// `import './track.js'` would be tree-shaken out of the bundle. Calling an exported
// function keeps it in.
//
// Only the production site asks. Anywhere else (the dev server, a preview build, a LAN
// address) the script is not even requested, and data-hosts makes the prompt itself hold
// to the same rule. The viewcounter also refuses any other origin.
const CONSENT_SRC = 'https://views.harshankur.com/consent.js';
const APP_ID = 'inscript-editor';
const PRODUCTION_HOST = 'inscript-editor.harshankur.com';
const PRIVACY_URL = 'https://harshankur.com/datenschutz#en-inscript-editor'; // the prompt is in English
/** Opens the prompt when the page is opened with it, as the embed page's link does. */
const SETTINGS_HASH = '#datenschutz-einstellungen';

export function trackPageView() {
    if (location.hostname !== PRODUCTION_HOST) return;
    if (document.querySelector(`script[src="${CONSENT_SRC}"]`)) return;
    const script = document.createElement('script');
    script.src = CONSENT_SRC;
    script.async = true;
    script.dataset.app = APP_ID;
    script.dataset.hosts = PRODUCTION_HOST;
    script.dataset.privacyUrl = PRIVACY_URL;
    script.addEventListener('load', () => {
        if (location.hash !== SETTINGS_HASH || !window.viewcounterConsent) return;
        // Asked once: the address loses the hash, so a reload does not ask again.
        history.replaceState(history.state, '', location.pathname + location.search);
        window.viewcounterConsent.open();
    });
    document.head.append(script);
}
