const YOUTUBE_ID_PATTERN = '[a-zA-Z0-9_-]{11}';

// Known YouTube URL shapes only — no generic path-segment fallback, since that
// would match any 11-char segment on an arbitrary URL (e.g. example.com/abcdefghijk).
const YOUTUBE_URL_PATTERNS = [
    new RegExp(`(?:youtube\\.com|youtube-nocookie\\.com)/(?:watch\\?(?:.*&)?v=|embed/|shorts/|vi/|v/)(${YOUTUBE_ID_PATTERN})`),
    new RegExp(`youtu\\.be/(${YOUTUBE_ID_PATTERN})`),
];

const BARE_ID_PATTERN = new RegExp(`^${YOUTUBE_ID_PATTERN}$`);

/**
 * Extract a YouTube video ID from a URL, or from a bare 11-char ID string.
 * Returns null if no valid YouTube ID can be determined.
 */
export function extractYoutubeId(input) {
    if (!input || typeof input !== 'string') return null;
    const value = input.trim();
    if (!value) return null;

    for (const pattern of YOUTUBE_URL_PATTERNS) {
        const match = value.match(pattern);
        if (match) return match[1];
    }

    return BARE_ID_PATTERN.test(value) ? value : null;
}
