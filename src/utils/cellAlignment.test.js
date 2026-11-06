import { describe, expect, it } from 'vitest';
import { columnAlignOf, readingAlign } from './cellAlignment.js';

describe('readingAlign', () => {
    it('lets the paragraph win, falls back to the cell, and reads start as left', () => {
        expect(readingAlign('right', 'center')).toBe('center');
        expect(readingAlign('right', null)).toBe('right');
        expect(readingAlign(undefined, undefined)).toBe(null);
        expect(readingAlign('start', null)).toBe('left');
        expect(readingAlign(null, 'start')).toBe('left');
        expect(readingAlign(null, 'justify')).toBe('justify');
    });
});

const body = align => ({ align, isHeader: false });
const head = align => ({ align, isHeader: true });

describe('columnAlignOf', () => {
    it('is the alignment every cell reads, centre and right needing all of them', () => {
        expect(columnAlignOf([head('center'), body('center')])).toBe('center');
        expect(columnAlignOf([head('right'), body('right'), body(null)])).toBeUndefined();
        expect(columnAlignOf([head(null), body(null)])).toBe(null);
    });
    it('takes body cells reading left or none as alike, and lets the header decide', () => {
        expect(columnAlignOf([head('left'), body(null), body('left')])).toBe('left');
        expect(columnAlignOf([head(null), body('left')])).toBe(null);
        // With no header nobody aligned the column: none.
        expect(columnAlignOf([body(null), body('left')])).toBe(null);
        expect(columnAlignOf([body('left'), body('left')])).toBe('left');
        expect(columnAlignOf([head('center'), body(null)])).toBeUndefined();
    });
    it('is undefined for a justified cell, a cell whose paragraphs differ, or no cells', () => {
        expect(columnAlignOf([head('justify'), body('justify')])).toBeUndefined();
        expect(columnAlignOf([head(null), body(undefined)])).toBeUndefined();
        expect(columnAlignOf([])).toBeUndefined();
    });
});
