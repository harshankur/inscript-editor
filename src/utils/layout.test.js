import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT_ALIGN, DEFAULT_LAYOUT_WIDTH, LAYOUT_ALIGNMENTS, cssLength, layoutAlign } from './layout.js';

describe('cssLength', () => {
    it.each([['50%', '50%'], ['320px', '320px'], ['12.5rem', '12.5rem'], ['30em', '30em'], ['80vw', '80vw'], ['60ch', '60ch'], ['300', '300px'], [300, '300px'], [' 25% ', '25%']])('reads %j as %j', (value, expected) => {
        expect(cssLength(value)).toBe(expected);
    });

    it.each(['1px; outline-style: dotted', 'url(x)', 'calc(100% - 1px)', '-5px', 'auto', '', null, undefined, {}])('falls back for %j', (value) => {
        expect(cssLength(value)).toBe(DEFAULT_LAYOUT_WIDTH);
        expect(cssLength(value, '40%')).toBe('40%');
    });
});

describe('layoutAlign', () => {
    it.each(LAYOUT_ALIGNMENTS)('keeps %s', (align) => {
        expect(layoutAlign(align)).toBe(align);
        expect(layoutAlign(` ${align.toUpperCase()} `)).toBe(align);
    });

    it.each(['justify', 'left; color: red', '', null, 3])('falls back for %j', (value) => {
        expect(layoutAlign(value)).toBe(DEFAULT_LAYOUT_ALIGN);
    });
});
