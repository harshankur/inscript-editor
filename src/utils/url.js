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

/** Is `value` something an image may load: http(s), blob, or a `data:image/…` URL? */
export function isImageUrl(value) {
    const url = parse(value);
    if (!url) return false;
    if (url.protocol === 'data:') return DATA_IMAGE.test(url.href);
    return IMAGE_PROTOCOLS.includes(url.protocol);
}
