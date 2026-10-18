import { describe, expect, it } from 'vitest';
import { normalizeForParse } from './parseDom.js';

const dom = html => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
};

describe('normalizeForParse', () => {
    it('returns the same DOM when nothing needs reshaping', () => {
        const input = dom('<p>a</p><ul><li><p>b</p></li></ul><p>x <img src="a.png"> y</p>');
        expect(normalizeForParse(input)).toBe(input);
    });

    it('turns real comments into comment spans, decoded, without touching the input', () => {
        const input = dom('<p>a <!-- x --&gt; y&#10;z --> b</p>');
        const out = normalizeForParse(input);
        expect(out).not.toBe(input);
        expect(input.innerHTML).toContain('<!--');
        const span = out.querySelector('span[data-html-comment]');
        expect(span.getAttribute('data-html-comment')).toBe(' x --> y\nz ');
    });

    it('unwraps a paragraph that holds only an image', () => {
        expect(normalizeForParse(dom('<p>a</p><p> <img src="a.png" alt="x"> </p>')).innerHTML).toBe('<p>a</p><img src="a.png" alt="x">');
    });

    it('keeps a paragraph holding an image and text as it is', () => {
        const input = dom('<p>Status: <img src="b.svg"> passing</p>');
        expect(normalizeForParse(input)).toBe(input);
    });

    it.each(['<img src="s.png">', '<pre><code>x</code></pre>', '<blockquote><p>q</p></blockquote>'])('gives a list item that opens with %s an empty first paragraph', (block) => {
        expect(normalizeForParse(dom(`<ul><li>${block}</li></ul>`)).innerHTML).toBe(`<ul><li><p></p>${block}</li></ul>`);
    });

    it('leaves task items and items that open with text alone', () => {
        const input = dom('<ul><li>text<pre>x</pre></li></ul><ul data-type="taskList"><li data-type="taskItem"><pre>x</pre></li></ul>');
        expect(normalizeForParse(input)).toBe(input);
    });

    it('passes through input with no document', () => {
        expect(normalizeForParse(null)).toBe(null);
        const fake = { ownerDocument: null };
        expect(normalizeForParse(fake)).toBe(fake);
    });
});
