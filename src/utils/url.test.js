import { describe, expect, it } from 'vitest';
import { IMAGE_PROTOCOLS, WEB_PROTOCOLS, isImageSrc, isImageUrl, isTypedImageSrc, isWebUrl, urlScheme } from './url.js';

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

describe('isImageSrc', () => {
    it('takes a relative path, an image URL and a host\'s own scheme', () => {
        for (const src of ['assets/a.png', './a b.png', '/img/a.png', 'https://example.com/a.png', 'blob:https://x/1', 'data:image/png;base64,AA==', 'asset://localhost/a.png', 'file:///tmp/a.png']) {
            expect(isImageSrc(src)).toBe(true);
        }
    });

    it('refuses script, a data URL that is not an image, and nothing', () => {
        for (const src of ['javascript:alert(1)', 'java\tscript:alert(1)', ' VBScript:x', 'javascript://[', 'JAVASCRIPT://%0a[alert(1)]', '\u0001javascript:x', 'data:text/html,<b>x</b>', 'da\nta:text/html,x', '', '   ', null, 5]) {
            expect(isImageSrc(src)).toBe(false);
        }
    });
});

describe('urlScheme', () => {
    it('reads a scheme as a browser does, and none for a relative URL', () => {
        expect(urlScheme('ASSET://localhost/a.png')).toBe('asset');
        expect(urlScheme(' java\tscript:x')).toBe('javascript');
        expect(urlScheme('assets/a.png')).toBeNull();
        expect(urlScheme(null)).toBeNull();
    });
});

describe('urlScheme and isImageSrc on long URLs', () => {
    it('read a scheme behind many tabs or spaces, and a long data URL by its start', () => {
        expect(urlScheme(`${' '.repeat(5000)}javascript:x`)).toBe('javascript');
        expect(isImageSrc(`j${'\t'.repeat(5000)}avascript:x`)).toBe(false);
        expect(isImageSrc(`data:image/png;base64,${'A'.repeat(1_000_000)}`)).toBe(true);
    });
});

describe('isTypedImageSrc', () => {
    it('takes an image URL, a relative path, or the image\'s own scheme; never a file', () => {
        expect(isTypedImageSrc('https://example.com/a.png', 'asset://x/a.png')).toBe(true);
        expect(isTypedImageSrc('uploads/b.png', 'https://example.com/a.png')).toBe(true);
        expect(isTypedImageSrc('asset://x/b.png', 'asset://x/a.png')).toBe(true);
        expect(isTypedImageSrc('asset://x/b.png', 'https://example.com/a.png')).toBe(false);
        expect(isTypedImageSrc('file:///pictures/b.png', 'file:///pictures/a.png')).toBe(false);
        expect(isTypedImageSrc('javascript:alert(1)', 'javascript:x')).toBe(false);
        expect(isTypedImageSrc('C:\\Windows\\x.png', 'C:\\pictures\\a.png')).toBe(false);
    });
});
