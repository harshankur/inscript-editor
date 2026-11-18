// A saved layout that was a preset follows that preset when the host says which release it was saved with.
import { describe, expect, it } from 'vitest';
import { INSCRIPT_EDITOR_VERSION, TOOLBAR_PRESETS, BUBBLE_PRESETS } from '../src/index.js';
import { TOOLBAR_PRESET_HISTORY, BUBBLE_PRESET_HISTORY, currentLayout } from '../src/toolbar/presetHistory.js';
import pkg from '../package.json';

describe('saved layouts', () => {
    it('INSCRIPT_EDITOR_VERSION is the package\'s version', () => {
        expect(INSCRIPT_EDITOR_VERSION).toBe(pkg.version);
    });

    it('are shown as their preset is today when the release they were saved with is given', () => {
        const old = [...TOOLBAR_PRESET_HISTORY.full.find(shape => shape.since === '0.10.0').tools];
        expect(currentLayout(old, 'toolbar', { savedWith: '0.10.0' })).toEqual(TOOLBAR_PRESETS.full);
        expect(currentLayout([...BUBBLE_PRESET_HISTORY.technical[0].tools], 'bubble', { savedWith: '0.1.0' })).toEqual(BUBBLE_PRESETS.technical);
    });

    it('are shown as they are without it, or when they were the reader\'s own then', () => {
        const old = [...TOOLBAR_PRESET_HISTORY.full.find(shape => shape.since === '0.10.0').tools];
        expect(currentLayout(old, 'toolbar', {})).toBe(old);
        expect(currentLayout(old, 'toolbar', { savedWith: '0.12.0' })).toBe(old);
        expect(currentLayout(undefined, 'toolbar', { savedWith: '0.10.0' })).toBeUndefined();
    });

    it('match a layout the customizer saved from a preset without the tools this editor cannot show', async () => {
        const { slotsWithoutStrayDividers } = await import('../src/toolbar/slotsWithoutStrayDividers.js');
        const off = ['youtube'];
        const saved = slotsWithoutStrayDividers(TOOLBAR_PRESET_HISTORY.full.find(shape => shape.since === '0.10.0').tools, id => !off.includes(id));
        expect(currentLayout(saved, 'toolbar', { savedWith: '0.10.0', unavailable: off })).toEqual(slotsWithoutStrayDividers(TOOLBAR_PRESETS.full, id => !off.includes(id)));
    });
});
