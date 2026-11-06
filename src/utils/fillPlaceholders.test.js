import { describe, expect, it } from 'vitest';
import { fillPlaceholders } from './fillPlaceholders.js';

describe('fillPlaceholders', () => {
    it('fills every placeholder, each as often as it appears', () => {
        expect(fillPlaceholders('{{name}}: {{color}} ({{color}})', { name: 'Text Color', color: '#f00' })).toBe('Text Color: #f00 (#f00)');
    });
    it('fills a nested name and a formatted placeholder', () => {
        expect(fillPlaceholders('Go to {{link.target}}', { link: { target: 'Home' } })).toBe('Go to Home');
        expect(fillPlaceholders('Version {{n, number}}', { n: 3 })).toBe('Version 3');
        expect(fillPlaceholders('{{a.b}}', { a: {} })).toBe('{{a.b}}');
    });

    it('leaves an unknown placeholder and already filled text alone', () => {
        expect(fillPlaceholders('Font Size {{size}} {{unit}}', { size: 18 })).toBe('Font Size 18 {{unit}}');
        expect(fillPlaceholders('Font Size 18', { size: 18 })).toBe('Font Size 18');
    });
});
