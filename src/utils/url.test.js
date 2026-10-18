import { describe, expect, it } from 'vitest';
import { IMAGE_PROTOCOLS, WEB_PROTOCOLS, isImageUrl, isWebUrl } from './url.js';

describe('isWebUrl', () => {
    it.each(['https://example.com/a', 'http://example.com', '/relative/path', 'page.html', '//cdn.example.com/x', '  https://example.com  '])('accepts %j', (value) => {
        expect(isWebUrl(value)).toBe(true);
    });

    it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', ' \u0001javascript:x', 'vbscript:x', 'data:text/html,x', 'blob:https://e.com/1', 'mailto:a@b.c', '', '   ', null, undefined, 42])('refuses %j', (value) => {
        expect(isWebUrl(value)).toBe(false);
    });

    it('lists the web schemes', () => {
        expect(WEB_PROTOCOLS).toEqual(['http:', 'https:']);
    });
});

describe('isImageUrl', () => {
    it.each(['https://e.com/a.png', '/a.png', 'blob:https://e.com/1', 'data:image/png;base64,AAAA', 'DATA:image/svg+xml,<svg/>'])('accepts %j', (value) => {
        expect(isImageUrl(value)).toBe(true);
    });

    it.each(['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', '', null])('refuses %j', (value) => {
        expect(isImageUrl(value)).toBe(false);
    });

    it('lists the image schemes', () => {
        expect(IMAGE_PROTOCOLS).toEqual(['http:', 'https:', 'blob:']);
    });
});
