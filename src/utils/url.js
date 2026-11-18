// Which URLs from a document or an input may be used for what. Parsed the way browsers parse them
// (the WHATWG URL parser drops tabs, newlines and leading control characters, so `java\tscript:`
// is `javascript:`), relative to the page.

/** Schemes a link to a web page may use. */
export const WEB_PROTOCOLS = Object.freeze(['http:', 'https:']);
/** Schemes an image may load from (besides `data:image/…`). */
export const IMAGE_PROTOCOLS = Object.freeze(['http:', 'https:', 'blob:']);
const DATA_IMAGE = /^data:image\//i;
const URL_BASE_FALLBACK = 'https://localhost/';

/** The page an address is read against: the current one, or a stand-in with none (on a server). */
const pageBase = () => (typeof location !== 'undefined' ? location.href : URL_BASE_FALLBACK);

/** `value` read as a browser reads it, against `base` when given (absolute only, without), or null. */
function readUrl(value, base) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        return base === undefined ? new URL(value) : new URL(value, base);
    } catch {
        return null;
    }
}

/** `value`, trimmed, parsed against the page, or null when it is not a non-empty URL. */
const parse = value => (typeof value === 'string' ? readUrl(value.trim(), pageBase()) : null);

/**
 * `value` read as a browser reads it (as given: a caller trims it when it uses it trimmed), against
 * `base` when given (absolute only, without), and kept only when it is an http(s) address: the one
 * rule the web-address checks below share (webHref, followedHref, isWebUrl).
 * @returns {URL | null}
 */
function webUrl(value, base) {
    const url = readUrl(value, base);
    return url && WEB_PROTOCOLS.includes(url.protocol) ? url : null;
}

/**
 * `value` as an absolute http(s) URL, normalized as a browser reads it, or null: what may be opened
 * outside the editor or loaded in a frame. Never a relative one (it would be the host's own page), a
 * path, a share (`\\host\share`) or another scheme.
 * @param {unknown} value
 * @returns {string | null}
 */
export function webHref(value) {
    if (typeof value !== 'string') return null;
    // A protocol-relative address (`//host/x`, as embed codes give) is a web address over https.
    const url = webUrl(protocolRelativeAsWeb(value.trim()));
    return url?.host ? url.href : null;
}

/**
 * Whether `value` starts with two slashes or backslashes, which may name another machine: a share
 * path (`\\host\share`) always, and two slashes (`//host/share`) on a page opened from a file, where
 * it is a share fetched with the reader's credentials. Which page that is cannot be known here (an
 * editor may be drawn in a frame or window other than the one its code runs in), so two slashes are
 * refused too, unless read as a web address first (see protocolRelativeAsWeb).
 * @param {unknown} value
 */
export function namesAnotherMachine(value) {
    return /^[\\/]{2}/.test(urlStart(String(value ?? '')));
}

/**
 * A protocol-relative address (`//host/x`, two slashes) as the web address its author meant
 * (`https://host/x`), whatever page the editor is on (on one opened from a file it would otherwise
 * name a share on another machine); anything else as it is.
 * @param {unknown} value
 */
export function protocolRelativeAsWeb(value) {
    if (typeof value !== 'string') return value;
    if (!/^\/\/[^\\/]/.test(urlStart(value))) return value;
    // Without what a browser drops around an address (leading and trailing controls and spaces), so the
    // result is the address it reads.
    return `https:${value.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '')}`;
}

/**
 * `value` as a link's href the editor shows for a host (a wikilink's page): a path or anchor on the
 * host's own site, or an http(s) URL; null for anything else (another scheme, a share: `\\host`).
 * @param {unknown} value
 * @returns {string | null}
 */
export function pageHref(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    // A protocol-relative one as the web address it means (see protocolRelativeAsWeb).
    value = protocolRelativeAsWeb(value);
    // Another machine's share (see namesAnotherMachine).
    if (namesAnotherMachine(value)) return null;
    const scheme = urlScheme(value);
    // Exactly what was checked (trimming more than a browser does could make a scheme of it).
    return scheme === null || WEB_PROTOCOLS.includes(`${scheme}:`) ? value : null;
}

/**
 * A link's href as the browser would follow it from a page at `base`: its absolute http(s) address,
 * or null (an anchor in the page, another scheme, nothing). Relative and protocol-relative ones
 * (`//host`, `\\host`) resolve as a browser resolves them.
 * @param {unknown} value
 * @param {string} base
 * @returns {string | null}
 */
export function followedHref(value, base) {
    if (typeof value !== 'string' || urlStart(value).startsWith('#')) return null;
    return webUrl(value, base)?.href ?? null;
}

/** Is `value`, trimmed (as its callers use it), an http(s) URL (absolute, or relative to the page)? */
export function isWebUrl(value) {
    return typeof value === 'string' && webUrl(value.trim(), pageBase()) !== null;
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
 * May a document's image have `value` as its src: what isImageSrc takes, but never a share on another
 * machine (`\\host\share\…`, `file://host/…`), which a desktop app's page would fetch with the
 * reader's credentials.
 * @param {unknown} value
 */
export function isDocumentImageSrc(value) {
    return isImageSrc(value) && !isShareAddress(value);
}

/**
 * A document's image src as the editor keeps it: a protocol-relative one read as the web address it
 * means (see protocolRelativeAsWeb), then checked (see isDocumentImageSrc); null when refused. Every
 * image src the editor reads, writes, takes from a host or shows goes through this.
 * @param {unknown} value
 * @returns {string | null}
 */
export function documentImageSrc(value) {
    const src = protocolRelativeAsWeb(value);
    return isDocumentImageSrc(src) ? src : null;
}

/**
 * Whether `value` names a share on another machine: a `\\host\share` path, a `//host` one on a page
 * opened from a file (see namesAnotherMachine), or a `file:` URL with a host (`file://host/x`,
 * `file:////host/x`), which a desktop app's page would fetch with the reader's credentials.
 * @param {unknown} value
 */
export function isShareAddress(value) {
    if (typeof value !== 'string') return false;
    if (namesAnotherMachine(value)) return true;
    if (urlScheme(value) !== 'file') return false;
    try {
        const { hostname, pathname } = new URL(value.trim());
        return !((!hostname || hostname === 'localhost') && !/^[\\/]{2}/.test(pathname));
    } catch {
        return true;
    }
}

/**
 * May a reader type `value` as an image's src, the image's src being `currentSrc`: an image URL, a
 * path relative to the document, or a URL of the scheme the image already has (a host's own, which
 * its image-file handler gave it), never a file on the reader's machine.
 * @param {unknown} value
 * @param {unknown} currentSrc
 */
export function isTypedImageSrc(value, currentSrc) {
    if (documentImageSrc(value) === null) return false;
    if (isImageUrl(value)) return true;
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
