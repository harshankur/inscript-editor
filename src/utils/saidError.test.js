import { describe, expect, it } from 'vitest';
import { saidError } from './saidError.js';

describe('saidError', () => {
    it('gives a library\'s message as it is, and one of the editor\'s own in its t', () => {
        expect(saidError('Parse error', () => 'x')).toBe('Parse error');
        expect(saidError({ say: t => t('k', 'Default') }, (key, fallback) => `${key}:${fallback}`)).toBe('k:Default');
        expect(saidError(null, () => 'x')).toBeNull();
    });
});
