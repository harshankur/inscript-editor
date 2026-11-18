import { describe, expect, it } from 'vitest';
import { lowerBound } from './lowerBound.js';

describe('lowerBound', () => {
    it('gives the first index at or after a position', () => {
        expect(lowerBound([2, 5, 9], 0)).toBe(0);
        expect(lowerBound([2, 5, 9], 5)).toBe(1);
        expect(lowerBound([2, 5, 9], 6)).toBe(2);
        expect(lowerBound([2, 5, 9], 10)).toBe(3);
        expect(lowerBound([], 1)).toBe(0);
    });

    it('reads positions through a function', () => {
        expect(lowerBound([{ pos: 1 }, { pos: 4 }], 3, item => item.pos)).toBe(1);
    });
});
