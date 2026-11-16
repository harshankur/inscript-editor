import { describe, expect, it } from 'vitest';
import { isOwnSummary, summaryChild } from './summaryChild.js';

const details = html => { const el = document.createElement('details'); el.innerHTML = html; return el; };

describe('summaryChild', () => {
    it('finds the first child summary, wherever it sits, and only a child', () => {
        expect(summaryChild(details('<summary>A</summary><p>x</p>')).textContent).toBe('A');
        expect(summaryChild(details('<p>x</p><summary>B</summary>')).textContent).toBe('B');
        expect(summaryChild(details('<div><summary>nested</summary></div>'))).toBeNull();
        expect(summaryChild(details('<p>x</p>'))).toBeNull();
    });
});

describe('isOwnSummary', () => {
    it('is the first summary child of a details, nothing else', () => {
        const el = details('<summary>A</summary><summary>B</summary><div><summary>C</summary></div>');
        const [a, b, c] = el.querySelectorAll('summary');
        expect([a, b, c].map(isOwnSummary)).toEqual([true, false, false]);
        expect(isOwnSummary(document.createElement('summary'))).toBe(false);
        expect(isOwnSummary(el)).toBe(false);
        expect(isOwnSummary(null)).toBe(false);
    });
});
