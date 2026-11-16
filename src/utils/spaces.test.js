import { describe, expect, it } from 'vitest';
import { runSpacesTogether } from './spaces.js';

describe('runSpacesTogether', () => {
    it('makes each run of spaces, no-break spaces and line breaks one space', () => {
        expect(runSpacesTogether(' Ctrl\n  S  ')).toBe(' Ctrl S ');
        expect(runSpacesTogether('a')).toBe('a');
    });
});
