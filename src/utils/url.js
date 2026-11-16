// Which URLs from a document or an input may be used for what. Parsed the way browsers parse them
// (the WHATWG URL parser drops tabs, newlines and leading control characters, so `java\tscript:`
// is `javascript:`), relative to the page.

/** Schemes a link to a web page may use. */
export const WEB_PROTOCOLS = Object.freeze(['http:', 'https:']);
/** Schemes an image may load from (besides `data:image/…`). */
export const IMAGE_PROTOCOLS = Object.freeze(['http:', 'https:', 'blob:']);
const DATA_IMAGE = /^data:image\//i;
const URL_BASE_FALLBACK = 'https://localhost/';

/** `value` parsed against the page, or null when it is not a non-empty URL. */
function parse(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const base = typeof location !== 'undefined' ? location.href : URL_BASE_FALLBACK;
        return new URL(value.trim(), base);
    } catch {
        return null;
    }
}

/** Is `value` an http(s) URL (absolute, or relative to the page)? */
export function isWebUrl(value) {
    const url = parse(value);
    return !!url && WEB_PROTOCOLS.includes(url.protocol);
}

/** Schemes that run script, never an image's. */
export const SCRIPT_SCHEMES = Object.freeze(['javascript', 'vbscript']);
const URL_SCHEME = /^([a-z][a-z\d+.-]*):/i;
// Enough of a URL's start for its scheme (no script scheme is longer), and for a data URL's type.
const URL_START_LENGTH = 64;

/**
 * A URL's start as a browser reads it before its scheme: control characters and spaces before it
 * dropped, and tabs and line breaks anywhere in it (`java\tscript:` is `javascript:`). Only the
 * start is read, so a data URL of megabytes is not copied for it.
 * @param {string} value
 * @param {number} [length]
 * @returns {string}
 */
export function urlStart(value, length = URL_START_LENGTH) {
    let i = 0;
    while (i < value.length && value.charCodeAt(i) <= 0x20) i += 1;
    let start = '';
    for (; i < value.length && start.length < length; i += 1) {
        const char = value[i];
        if (char !== '\t' && char !== '\n' && char !== '\r') start += char;
    }
    return start;
}

/**
 * A URL's scheme as a browser reads it, lowercased (`asset`, `https`), or null for a relative one.
 * @param {unknown} value
 * @returns {string | null}
 */
export function urlScheme(value) {
    if (typeof value !== 'string') return null;
    return URL_SCHEME.exec(urlStart(value))?.[1].toLowerCase() ?? null;
}

/**
 * May `value` be the src a host gives an image: a path relative to the document, or a URL of any
 * scheme but those that run script, a `data:` URL only when it is an image's? Wider than isImageUrl
 * (for what a reader types), as a host's own schemes (an app's file or asset URLs) are its own. The
 * scheme is read as a browser reads it, whether or not the rest of the URL parses.
 */
export function isImageSrc(value) {
    if (typeof value !== 'string') return false;
    const start = urlStart(value);
    if (!start) return false;
    const scheme = urlScheme(value);
    if (!scheme) return true;
    if (SCRIPT_SCHEMES.includes(scheme)) return false;
    return scheme !== 'data' || DATA_IMAGE.test(start);
}

/**
 * May a reader type `value` as an image's src, the image's src being `currentSrc`: an image URL, a
 * path relative to the document, or a URL of the scheme the image already has (a host's own, which
 * its image-file handler gave it), never a file on the reader's machine.
 * @param {unknown} value
 * @param {unknown} currentSrc
 */
export function isTypedImageSrc(value, currentSrc) {
    if (isImageUrl(value)) return true;
    if (!isImageSrc(value)) return false;
    const scheme = urlScheme(value);
    // A one-letter scheme is a drive (`C:\\…`), a file as much as `file:` is.
    return scheme === null || (scheme !== 'file' && scheme.length > 1 && scheme === urlScheme(currentSrc));
}

/** Is `value` something an image may load: http(s), blob, or a `data:image/…` URL? */
export function isImageUrl(value) {
    const url = parse(value);
    if (!url) return false;
    if (url.protocol === 'data:') return DATA_IMAGE.test(url.href);
    return IMAGE_PROTOCOLS.includes(url.protocol);
}
