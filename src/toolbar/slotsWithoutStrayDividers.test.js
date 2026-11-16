import { describe, expect, it } from 'vitest';
import { slotsWithoutStrayDividers } from './slotsWithoutStrayDividers.js';

const D = '|';
const shows = id => id !== 'kbd' && id !== 'details';
describe('slotsWithoutStrayDividers', () => {
    it('leaves out tools not shown, and the divider of each group that leaves empty', () => {
        expect(slotsWithoutStrayDividers(['bold', D, 'kbd', D, 'code', 'details'], shows)).toEqual(['bold', D, 'code']);
        expect(slotsWithoutStrayDividers(['kbd', D, 'bold'], shows)).toEqual(['bold']);
        expect(slotsWithoutStrayDividers(['bold', D, 'kbd'], shows)).toEqual(['bold']);
        expect(slotsWithoutStrayDividers(['kbd', D, 'details', D, 'bold'], shows)).toEqual(['bold']);
        expect(slotsWithoutStrayDividers(['bold', D, 'kbd', D, 'details', D, 'code'], shows)).toEqual(['bold', D, 'code']);
        expect(slotsWithoutStrayDividers(['kbd'], shows)).toEqual([]);
        expect(slotsWithoutStrayDividers([D, 'kbd', D], shows)).toEqual([]);
        expect(slotsWithoutStrayDividers(['details', D, D, 'bold'], shows)).toEqual(['bold']);
        expect(slotsWithoutStrayDividers(['bold', D, D, 'kbd'], shows)).toEqual(['bold']);
    });

    it('keeps the dividers the layout itself places, at an end or side by side', () => {
        const layout = [D, 'bold', D, D, 'italic', D];
        expect(slotsWithoutStrayDividers(layout, () => true)).toEqual(layout);
        expect(slotsWithoutStrayDividers([D, 'kbd', D, 'bold'], shows)).toEqual([D, 'bold']);
        expect(slotsWithoutStrayDividers(['bold', D, 'kbd', D, D, 'code'], shows)).toEqual(['bold', D, D, 'code']);
    });
});
