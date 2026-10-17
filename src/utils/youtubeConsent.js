// The consent placeholder a YouTube video shows before it loads: the editor's node view
// (facade: 'local') and YoutubeEmbedModal's live preview both draw this one element, so the two
// can never look or behave differently. It is built from plain DOM, requests nothing from any
// host, and loads the player only when the visitor presses its button: that press is the
// consent, for that one video, and nothing is remembered.

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The lucide "youtube" glyph, drawn here so nothing is fetched for it. */
export const YOUTUBE_ICON_PATHS = Object.freeze([
    'M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17',
    'm10 15 5-3-5-3z',
]);
const PLAY_ICON_POINTS = '6 3 20 12 6 21 6 3';
const ICON_VIEWBOX = '0 0 24 24';
const TITLE_ICON_SIZE = 18;
const BUTTON_ICON_SIZE = 13;

/** The placeholder's English, the default for each translatable label (en.json has the same). */
export const YOUTUBE_CONSENT_DEFAULTS = Object.freeze({
    title: 'YouTube video',
    text: 'Playing this video loads it from YouTube. YouTube (Google) then receives data such as your IP address and may set cookies.',
    load: 'Load video',
    loadPreview: 'Load preview',
    privacy: 'Privacy notice',
});

/** Marks the placeholder, so it can be found (and told apart from the thumbnail facade). */
export const YOUTUBE_CONSENT_ATTRIBUTE = 'data-youtube-consent';

/** The protocols a privacy link may use: a host-supplied `javascript:` URL never becomes a link. */
const PRIVACY_URL_PROTOCOLS = Object.freeze(['http:', 'https:']);
const URL_BASE_FALLBACK = 'https://localhost/';
const LINK_TARGET = '_blank';
const LINK_REL = 'noopener';

// Each placeholder labels itself through ids; a counter keeps them unique on a page with many.
let idCounter = 0;

/**
 * The privacy notice URL to link, or null when there is none to link: anything that is not a
 * non-empty http(s) URL (absolute, or relative to the page) gives no link.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function resolvePrivacyUrl(value) {
    if (typeof value !== 'string') return null;
    const url = value.trim();
    if (!url) return null;
    try {
        const base = typeof location !== 'undefined' ? location.href : URL_BASE_FALLBACK;
        return PRIVACY_URL_PROTOCOLS.includes(new URL(url, base).protocol) ? url : null;
    } catch {
        return null;
    }
}

function svgIcon(size, className) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', ICON_VIEWBOX);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', className);
    return svg;
}

/**
 * The YouTube glyph as an inline SVG element (no request).
 *
 * @param {number} size - Width and height in pixels.
 * @param {string} [className]
 */
export function buildYoutubeIcon(size, className = '') {
    const svg = svgIcon(size, className);
    YOUTUBE_ICON_PATHS.forEach(d => {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
    });
    return svg;
}

function buildPlayIcon() {
    const svg = svgIcon(BUTTON_ICON_SIZE, 'shrink-0');
    svg.setAttribute('fill', 'currentColor');
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', PLAY_ICON_POINTS);
    svg.appendChild(polygon);
    return svg;
}

/**
 * Build the consent placeholder. It fills its positioned parent (absolute, inset 0), so the
 * parent keeps the video's size and aspect ratio. At narrow widths (under 20rem, measured on the
 * nearest `@container` ancestor) the heading is left out so the text and the button still fit.
 *
 * @param {object} options
 * @param {{ title: string, text: string, load: string, privacy: string }} options.labels -
 *   The heading, the consent text, the button and the privacy link, already translated.
 * @param {() => void} options.onLoad - Called when the visitor presses the button.
 * @param {unknown} [options.privacyUrl] - The host's privacy notice; no link unless it is an
 *   http(s) URL (see resolvePrivacyUrl).
 * @param {() => ((url: string) => void) | null | undefined} [options.getOpenExternal] - Read when
 *   the privacy link is followed: a host opener (a desktop webview where a new tab cannot open)
 *   opens the URL instead of the browser.
 * @returns {HTMLDivElement}
 */
export function buildYoutubeConsent({ labels, onLoad, privacyUrl, getOpenExternal }) {
    idCounter += 1;
    const titleId = `inscript-youtube-consent-title-${idCounter}`;
    const textId = `inscript-youtube-consent-text-${idCounter}`;

    const root = document.createElement('div');
    root.setAttribute(YOUTUBE_CONSENT_ATTRIBUTE, '');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-labelledby', titleId);
    root.className = 'absolute inset-0 flex flex-col items-center justify-center-safe gap-2 @xs:gap-3 overflow-y-auto p-3 @xs:p-6 text-center bg-[var(--inscript-color-surface-raised)] text-[var(--inscript-color-text)] border border-[var(--inscript-color-border)] rounded-[inherit] select-none';

    const title = document.createElement('div');
    title.id = titleId;
    title.className = 'hidden @xs:flex items-center gap-2 text-sm font-semibold';
    title.appendChild(buildYoutubeIcon(TITLE_ICON_SIZE, 'shrink-0 text-[var(--inscript-color-muted)]'));
    const titleText = document.createElement('span');
    titleText.textContent = labels.title;
    title.appendChild(titleText);
    root.appendChild(title);

    // A div, not a <p>: inside the editor the content rules would give a <p> a paragraph's margin.
    const text = document.createElement('div');
    text.id = textId;
    text.className = 'max-w-[28rem] text-[11px] @xs:text-xs leading-snug text-[var(--inscript-color-muted)]';
    text.textContent = labels.text;
    root.appendChild(text);

    const actions = document.createElement('div');
    actions.className = 'flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5';

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-describedby', textId);
    // The same control as the generic embed's "Load embedded content" button.
    button.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer border-0 bg-[var(--inscript-color-text)] text-[var(--inscript-color-surface)] hover:opacity-90 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--inscript-color-accent)]';
    button.appendChild(buildPlayIcon());
    const buttonText = document.createElement('span');
    buttonText.textContent = labels.load;
    button.appendChild(buttonText);
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onLoad();
    });
    actions.appendChild(button);

    const href = resolvePrivacyUrl(privacyUrl);
    if (href) {
        const link = document.createElement('a');
        link.href = href;
        link.target = LINK_TARGET;
        link.rel = LINK_REL;
        // Its colour is set in the stylesheet, which outranks the editor's own link colour.
        link.className = 'text-xs underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--inscript-color-accent)] rounded-sm';
        link.textContent = labels.privacy;
        link.addEventListener('click', (event) => {
            const open = getOpenExternal?.();
            if (typeof open !== 'function') return; // the browser opens it in a new tab
            event.preventDefault();
            open(href);
        });
        actions.appendChild(link);
    }

    root.appendChild(actions);
    return root;
}
