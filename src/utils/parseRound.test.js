import { describe, expect, it } from 'vitest';
import { beginParse, parseRound } from './parseRound.js';

describe('parseRound', () => {
    it('is the same within a parse, and new for the next one or the next microtask', async () => {
        const first = parseRound();
        expect(parseRound()).toBe(first);
        beginParse();
        const second = parseRound();
        expect(second).not.toBe(first);
        await Promise.resolve();
        expect(parseRound()).not.toBe(second);
    });
});
