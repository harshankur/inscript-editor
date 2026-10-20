// The project site's view counting (site/track.js): the consent prompt is added only on the
// production host, once, with the attributes viewcounter's consent.js reads.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackPageView } from '../../site/track.js';

const CONSENT_SRC = 'https://views.harshankur.com/consent.js';
const PRODUCTION_HOST = 'inscript-editor.harshankur.com';
const SETTINGS_HASH = '#datenschutz-einstellungen';

const consentScripts = () => document.head.querySelectorAll(`script[src="${CONSENT_SRC}"]`);

// trackPageView reads the bare `location`; jsdom's cannot be pointed at another host, so the
// global is replaced with just what it reads.
function at(hostname, hash = '') {
    vi.stubGlobal('location', { hostname, hash, pathname: '/', search: '' });
}

describe('site/track.js trackPageView', () => {
    beforeEach(() => consentScripts().forEach(script => script.remove()));
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        delete window.viewcounterConsent;
    });

    it('requests nothing off the production host', () => {
        for (const host of ['localhost', '192.168.1.20', 'inscript-editor.example.com']) {
            at(host);
            trackPageView();
        }
        expect(consentScripts()).toHaveLength(0);
    });

    it('adds the consent prompt once on the production host, with its app, hosts, privacy notice and operator', () => {
        at(PRODUCTION_HOST);
        trackPageView();
        trackPageView();
        const scripts = consentScripts();
        expect(scripts).toHaveLength(1);
        const [script] = scripts;
        expect(script.async).toBe(true);
        expect(script.dataset).toMatchObject({
            app: 'inscript-editor',
            hosts: PRODUCTION_HOST,
            privacyUrl: 'https://harshankur.com/datenschutz#en-inscript-editor',
            operator: 'Harsh Ankur',
        });
        expect(script.getAttribute('data-operator')).toBe('Harsh Ankur');
    });

    it('opens the prompt once loaded when the page was opened at the settings hash, and drops the hash', () => {
        at(PRODUCTION_HOST, SETTINGS_HASH);
        const replaceState = vi.spyOn(history, 'replaceState').mockImplementation(() => {});
        window.viewcounterConsent = { open: vi.fn() };
        trackPageView();
        consentScripts()[0].dispatchEvent(new Event('load'));
        expect(window.viewcounterConsent.open).toHaveBeenCalledTimes(1);
        expect(replaceState).toHaveBeenCalledWith(history.state, '', '/');
    });

    it('does not open the prompt, or touch the address, without the settings hash or without consent.js', () => {
        const replaceState = vi.spyOn(history, 'replaceState').mockImplementation(() => {});
        at(PRODUCTION_HOST);
        window.viewcounterConsent = { open: vi.fn() };
        trackPageView();
        consentScripts()[0].dispatchEvent(new Event('load'));
        expect(window.viewcounterConsent.open).not.toHaveBeenCalled();

        consentScripts().forEach(script => script.remove());
        at(PRODUCTION_HOST, SETTINGS_HASH);
        delete window.viewcounterConsent;
        trackPageView();
        consentScripts()[0].dispatchEvent(new Event('load'));
        expect(replaceState).not.toHaveBeenCalled();
    });
});
