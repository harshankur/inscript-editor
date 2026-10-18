const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;
/** Hosts a YouTube video URL can be on (and their subdomains: www., m., music.). */
const YOUTUBE_HOSTS = ['youtube.com', 'youtube-nocookie.com'];
const SHORT_HOST = 'youtu.be';
/** Path prefixes followed by the video ID. */
const ID_PATH_PREFIXES = ['embed', 'shorts', 'vi', 'v', 'live'];
const WATCH_PATH = '/watch';
/** Longer than any real video URL: not parsed at all. */
const MAX_INPUT_LENGTH = 2048;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Is `value` an 11-character YouTube video ID? */
export function isYoutubeId(value) {
    return typeof value === 'string' && YOUTUBE_ID.test(value);
}

const onHost = (hostname, host) => hostname === host || hostname.endsWith(`.${host}`);

/**
 * Extract a YouTube video ID from a URL, or from a bare 11-char ID string.
 * Returns null if no valid YouTube ID can be determined. Known URL shapes only, read with the
 * URL parser (no pattern that backtracks over long input): watch?v=, embed/, shorts/, vi/, v/,
 * live/ on youtube.com or youtube-nocookie.com, and youtu.be/.
 */
export function extractYoutubeId(input) {
    if (!input || typeof input !== 'string') return null;
    const value = input.trim();
    if (!value || value.length > MAX_INPUT_LENGTH) return null;
    if (isYoutubeId(value)) return value;

    let url;
    try {
        url = new URL(HAS_SCHEME.test(value) ? value : `https://${value}`);
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const hostname = url.hostname.toLowerCase();
    const segments = url.pathname.split('/').filter(Boolean);
    let id = null;
    if (hostname === SHORT_HOST || hostname === `www.${SHORT_HOST}`) {
        id = segments[0];
    } else if (YOUTUBE_HOSTS.some(host => onHost(hostname, host))) {
        if (url.pathname === WATCH_PATH || url.pathname === `${WATCH_PATH}/`) id = url.searchParams.get('v');
        else if (ID_PATH_PREFIXES.includes(segments[0])) id = segments[1];
    }
    return isYoutubeId(id) ? id : null;
}

/** The host the YouTube player loads from: YouTube's own, official one. */
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube.com';

const EMBED_PATH = '/embed/';

/**
 * The player URL for a video ID, always on www.youtube.com, or null for anything that is not a
 * video ID (an ID with a path or a query in it would reach any youtube.com address).
 *
 * @param {string} id - An 11-character YouTube video ID.
 */
export function youtubeEmbedUrl(id) {
    return isYoutubeId(id) ? `${YOUTUBE_EMBED_ORIGIN}${EMBED_PATH}${id}` : null;
}
