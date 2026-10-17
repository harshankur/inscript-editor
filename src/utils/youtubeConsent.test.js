import { describe, expect, it, vi } from 'vitest';
import en from '../locales/en.json';
import {
    buildYoutubeConsent, buildYoutubeIcon, resolvePrivacyUrl,
    YOUTUBE_CONSENT_ATTRIBUTE, YOUTUBE_CONSENT_DEFAULTS, YOUTUBE_ICON_PATHS,
} from './youtubeConsent.js';

const LABELS = { title: 'Title', text: 'Consent text', load: 'Load it', privacy: 'Privacy' };
const PRIVACY_URL = 'https://example.com/privacy#video';

const build = (options = {}) => buildYoutubeConsent({ labels: LABELS, onLoad: () => {}, ...options });

describe('resolvePrivacyUrl', () => {
    it.each([
        ['an https URL', PRIVACY_URL, PRIVACY_URL],
        ['an http URL', 'http://example.com/privacy', 'http://example.com/privacy'],
        ['a URL relative to the page', '/privacy', '/privacy'],
        ['a URL with surrounding spaces, trimmed', `  ${PRIVACY_URL}  `, PRIVACY_URL],
    ])('links %s', (_label, input, expected) => {
        expect(resolvePrivacyUrl(input)).toBe(expected);
    });

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['a number', 42],
        ['an empty string', ''],
        ['only spaces', '   '],
        ['a javascript: URL', 'javascript:alert(1)'],
        ['a data: URL', 'data:text/html,hi'],
        ['a mailto: URL', 'mailto:someone@example.com'],
        ['a URL that does not parse', 'http://[not a host'],
    ])('gives no link for %s', (_label, input) => {
        expect(resolvePrivacyUrl(input)).toBeNull();
    });
});

describe('buildYoutubeIcon', () => {
    it('draws the YouTube glyph inline, at the given size, hidden from assistive technology', () => {
        const svg = buildYoutubeIcon(20, 'my-class');
        expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
        expect(svg.getAttribute('width')).toBe('20');
        expect(svg.getAttribute('height')).toBe('20');
        expect(svg.getAttribute('class')).toBe('my-class');
        expect(svg.getAttribute('aria-hidden')).toBe('true');
        expect([...svg.querySelectorAll('path')].map(p => p.getAttribute('d'))).toEqual([...YOUTUBE_ICON_PATHS]);
    });

    it('takes no class by default', () => {
        expect(buildYoutubeIcon(16).getAttribute('class')).toBe('');
    });
});

describe('YOUTUBE_CONSENT_DEFAULTS', () => {
    it('are the English of the translatable labels', () => {
        expect(YOUTUBE_CONSENT_DEFAULTS).toEqual({
            title: en.youtubeConsentTitle,
            text: en.youtubeConsentText,
            load: en.youtubeConsentLoad,
            loadPreview: en.youtubeConsentLoadPreview,
            privacy: en.youtubeConsentPrivacy,
        });
    });

    it('say in plain words what loading the video sends to YouTube', () => {
        expect(YOUTUBE_CONSENT_DEFAULTS.text).toBe('Playing this video loads it from YouTube. YouTube (Google) then receives data such as your IP address and may set cookies.');
    });
});

describe('buildYoutubeConsent', () => {
    it('shows the heading, the consent text and the button, and requests nothing', () => {
        const root = build();
        expect(root.hasAttribute(YOUTUBE_CONSENT_ATTRIBUTE)).toBe(true);
        expect(root.textContent).toContain('Title');
        expect(root.textContent).toContain('Consent text');
        expect(root.querySelector('button').textContent).toBe('Load it');
        expect(root.querySelector('button').type).toBe('button');
        expect(root.querySelector('img, iframe')).toBeNull();
        expect(root.innerHTML).not.toMatch(/url\(|https?:\/\//);
    });

    it('names itself by its heading and describes the button by the consent text', () => {
        const root = build();
        document.body.appendChild(root);
        expect(root.getAttribute('role')).toBe('group');
        expect(document.getElementById(root.getAttribute('aria-labelledby')).textContent).toBe('Title');
        const button = root.querySelector('button');
        expect(document.getElementById(button.getAttribute('aria-describedby')).textContent).toBe('Consent text');
        root.remove();
    });

    it('gives every placeholder its own ids', () => {
        const a = build();
        const b = build();
        expect(a.getAttribute('aria-labelledby')).not.toBe(b.getAttribute('aria-labelledby'));
        expect(a.querySelector('button').getAttribute('aria-describedby')).not.toBe(b.querySelector('button').getAttribute('aria-describedby'));
    });

    it('calls onLoad when the button is pressed, and keeps the press to itself', () => {
        const onLoad = vi.fn();
        const parentClick = vi.fn();
        const parent = document.createElement('div');
        parent.addEventListener('click', parentClick);
        parent.appendChild(build({ onLoad }));
        parent.querySelector('button').click();
        expect(onLoad).toHaveBeenCalledTimes(1);
        expect(parentClick).not.toHaveBeenCalled();
    });

    it('has no privacy link without a privacy URL', () => {
        expect(build().querySelector('a')).toBeNull();
    });

    it('has no privacy link for a URL that is not http(s)', () => {
        expect(build({ privacyUrl: 'javascript:alert(1)' }).querySelector('a')).toBeNull();
    });

    it('links the privacy notice in a new tab, with rel="noopener"', () => {
        const link = build({ privacyUrl: PRIVACY_URL }).querySelector('a');
        expect(link.getAttribute('href')).toBe(PRIVACY_URL);
        expect(link.target).toBe('_blank');
        expect(link.rel).toBe('noopener');
        expect(link.textContent).toBe('Privacy');
    });

    it('lets the browser follow the link when the host has no opener', () => {
        for (const getOpenExternal of [undefined, () => null]) {
            const parent = document.createElement('div');
            parent.appendChild(build({ privacyUrl: PRIVACY_URL, getOpenExternal }));
            let preventedByPlaceholder = null;
            parent.addEventListener('click', (event) => {
                preventedByPlaceholder = event.defaultPrevented;
                event.preventDefault(); // jsdom cannot navigate
            });
            parent.querySelector('a').click();
            expect(preventedByPlaceholder).toBe(false);
        }
    });

    it("opens the link through the host's opener, read when it is followed", () => {
        const open = vi.fn();
        let opener = null;
        const link = build({ privacyUrl: PRIVACY_URL, getOpenExternal: () => opener }).querySelector('a');
        opener = open;
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(open).toHaveBeenCalledWith(PRIVACY_URL);
    });
});
