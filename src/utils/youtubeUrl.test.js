import { describe, expect, it } from 'vitest';
import { extractYoutubeId, isYoutubeId, youtubeEmbedUrl, YOUTUBE_EMBED_ORIGIN } from './youtubeUrl.js';

describe('extractYoutubeId', () => {
    const VALID_ID = 'dQw4w9WgXcQ';

    const cases = [
        ['watch?v= URL', `https://www.youtube.com/watch?v=${VALID_ID}`, VALID_ID],
        ['watch?v= URL with extra query params after', `https://www.youtube.com/watch?v=${VALID_ID}&list=PL123&index=2`, VALID_ID],
        ['watch?v= URL with params before v=', `https://www.youtube.com/watch?list=PL123&v=${VALID_ID}`, VALID_ID],
        ['youtu.be short URL', `https://youtu.be/${VALID_ID}`, VALID_ID],
        ['youtu.be short URL with query', `https://youtu.be/${VALID_ID}?t=30`, VALID_ID],
        ['embed URL', `https://www.youtube.com/embed/${VALID_ID}`, VALID_ID],
        ['shorts URL', `https://www.youtube.com/shorts/${VALID_ID}`, VALID_ID],
        ['vi/ URL', `https://www.youtube.com/vi/${VALID_ID}/default.jpg`, VALID_ID],
        ['v/ URL', `https://www.youtube.com/v/${VALID_ID}`, VALID_ID],
        ['youtube-nocookie.com embed URL', `https://www.youtube-nocookie.com/embed/${VALID_ID}`, VALID_ID],
        ['bare 11-char ID', VALID_ID, VALID_ID],
        ['bare ID with surrounding whitespace', `  ${VALID_ID}  `, VALID_ID],
    ];

    it.each(cases)('%s -> extracts the id', (_label, input, expected) => {
        expect(extractYoutubeId(input)).toBe(expected);
    });

    it('returns null for a 10-character garbage string (too short)', () => {
        expect(extractYoutubeId('abcdefghij')).toBeNull();
    });

    it('returns null for a non-YouTube URL with an 11-char path segment (regression for finding 3)', () => {
        expect(extractYoutubeId('https://example.com/abcdefghijk')).toBeNull();
    });

    it('returns null for empty/nullish input', () => {
        expect(extractYoutubeId('')).toBeNull();
        expect(extractYoutubeId(null)).toBeNull();
        expect(extractYoutubeId(undefined)).toBeNull();
    });

    it('returns null for non-string input', () => {
        expect(extractYoutubeId(12345)).toBeNull();
    });
});

describe('youtubeEmbedUrl', () => {
    const VALID_ID = 'dQw4w9WgXcQ';

    it('points at the official player on www.youtube.com', () => {
        expect(youtubeEmbedUrl(VALID_ID)).toBe(`https://www.youtube.com/embed/${VALID_ID}`);
    });

    it('names the one host', () => {
        expect(YOUTUBE_EMBED_ORIGIN).toBe('https://www.youtube.com');
    });

    it('builds a URL that extractYoutubeId reads back', () => {
        expect(extractYoutubeId(youtubeEmbedUrl(VALID_ID))).toBe(VALID_ID);
    });
});

describe('extractYoutubeId on hostile input', () => {
    it('stays fast on a long run of watch? prefixes', () => {
        const start = performance.now();
        expect(extractYoutubeId('youtube.com/watch?&'.repeat(10000))).toBeNull();
        expect(performance.now() - start).toBeLessThan(200);
    });

    it('ignores YouTube addresses inside another URL', () => {
        expect(extractYoutubeId('https://evil.example/?u=https://www.youtube.com/embed/dQw4w9WgXcQ')).toBeNull();
        expect(extractYoutubeId('https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    });

    it('reads subdomains, live/ and schemeless URLs', () => {
        expect(extractYoutubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
        expect(extractYoutubeId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
        expect(extractYoutubeId('youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('refuses an ID with a path or a query in it for the player URL', () => {
        expect(youtubeEmbedUrl('dQw4w9WgXcQ/../../x?y=1')).toBeNull();
        expect(isYoutubeId('dQw4w9WgXcQ')).toBe(true);
        expect(isYoutubeId('dQw4w9WgXc')).toBe(false);
    });
});
