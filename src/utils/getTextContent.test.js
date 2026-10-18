import { describe, expect, it, vi } from 'vitest';
import { getTextContent } from './getTextContent.js';

describe('getTextContent', () => {
    it('strips nested markup down to text', () => {
        expect(getTextContent('<p>Hello <strong>bold <em>italic</em></strong> world</p>')).toBe('Hello bold italic world');
    });

    it('decodes HTML entities', () => {
        expect(getTextContent('<p>Tom &amp; Jerry &mdash; 5 &gt; 3</p>')).toBe('Tom & Jerry — 5 > 3');
    });

    it('returns an empty string for empty input', () => {
        expect(getTextContent('')).toBe('');
    });

    it('falls back to a regex strip when DOMParser is unavailable (SSR)', () => {
        const original = globalThis.DOMParser;
        // @ts-expect-error simulate SSR/Node environment
        delete globalThis.DOMParser;
        try {
            expect(getTextContent('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
            expect(getTextContent('')).toBe('');
        } finally {
            globalThis.DOMParser = original;
        }
    });

    it('keeps an unclosed "<" and what follows as text, and stays fast on many of them (SSR)', () => {
        const original = globalThis.DOMParser;
        // @ts-expect-error simulate SSR/Node environment
        delete globalThis.DOMParser;
        try {
            expect(getTextContent('a < b <i>c</i>')).toBe('a c'); // as the pattern did: "< b <i>" is one tag
            expect(getTextContent('x <b')).toBe('x <b');
            const many = '<'.repeat(100000);
            const start = performance.now();
            expect(getTextContent(many)).toBe(many);
            expect(performance.now() - start).toBeLessThan(500);
        } finally {
            globalThis.DOMParser = original;
        }
    });
});
