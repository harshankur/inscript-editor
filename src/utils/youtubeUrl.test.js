import { describe, expect, it } from 'vitest';
import { extractYoutubeId } from './youtubeUrl.js';

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
