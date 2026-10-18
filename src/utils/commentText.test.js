import { describe, expect, it } from 'vitest';
import { decodeCommentText, encodeCommentText } from './commentText.js';

describe('encodeCommentText', () => {
    it('neutralizes what would close the comment early', () => {
        expect(encodeCommentText(' a --> b --!> c ')).toBe(' a --&gt; b --!&gt; c ');
        expect(encodeCommentText('> x')).toBe('&gt; x');
        expect(encodeCommentText('-> x')).toBe('-&gt; x');
    });

    it('writes every line break as a reference by default', () => {
        expect(encodeCommentText('a\nb\r\nc\rd')).toBe('a&#10;b&#10;c&#10;d');
    });

    it('keeps line breaks for a comment standing alone', () => {
        expect(encodeCommentText('a\n\nb', { keepLineBreaks: true })).toBe('a\n\nb');
    });

    it('treats a missing text as empty', () => {
        expect(encodeCommentText(undefined)).toBe('');
        expect(encodeCommentText(null)).toBe('');
    });
});

describe('decodeCommentText', () => {
    it.each([
        ' a --> b --!> c ',
        '> x',
        '-> x',
        'a\nb',
        'a\n\nb',
        ' plain ',
    ])('reads back what encodeCommentText wrote (%j)', (text) => {
        expect(decodeCommentText(encodeCommentText(text))).toBe(text);
    });

    it('passes other comments through', () => {
        expect(decodeCommentText(' hand-written ')).toBe(' hand-written ');
        expect(decodeCommentText(undefined)).toBe('');
    });
});
