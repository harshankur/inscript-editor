import { describe, expect, it } from 'vitest';
import { TOOLBAR_PRESETS, BUBBLE_PRESETS } from './presets.js';
import { TOOLBAR_PRESET_HISTORY, BUBBLE_PRESET_HISTORY, toolbarPresetOf, upgradeToolbarConfig } from './presetHistory.js';

const SURFACES = [['toolbar', TOOLBAR_PRESETS, TOOLBAR_PRESET_HISTORY], ['bubble', BUBBLE_PRESETS, BUBBLE_PRESET_HISTORY]];

describe('preset history', () => {
    // A release that changes a preset adds its new shape at the end of the history (and keeps every
    // old one): this fails until it does, so a layout saved as the old shape keeps following it.
    it.each(SURFACES)('ends, for every %s preset, with today\'s shape', (_surface, presets, history) => {
        expect(Object.keys(history).sort()).toEqual(Object.keys(presets).sort());
        for (const [name, shapes] of Object.entries(history)) {
            expect(shapes.at(-1).tools, `${name}: add today's shape to the history`).toEqual(presets[name]);
        }
    });

    it.each(SURFACES)('holds every %s shape once, owned by one preset only', (_surface, _presets, history) => {
        const owner = new Map();
        for (const [name, shapes] of Object.entries(history)) {
            for (const { tools } of shapes) {
                const key = JSON.stringify(tools);
                expect(owner.get(key) ?? name, `a shape both ${owner.get(key)} and ${name} had`).toBe(name);
                owner.set(key, name);
            }
        }
    });

    it('keeps the shapes releases shipped (0.1.0 onward)', () => {
        expect(TOOLBAR_PRESET_HISTORY.full.map(shape => shape.since)).toEqual(['0.1.0', '0.2.9', '0.3.1', '0.10.0', '0.11.0']);
        expect(TOOLBAR_PRESET_HISTORY.full[0].tools).toContain('wikilink');
    });
});

describe('upgradeToolbarConfig and toolbarPresetOf', () => {
    it('read a layout saved as a past shape as its preset, today\'s shape', () => {
        const before = TOOLBAR_PRESET_HISTORY.full.find(shape => shape.since === '0.10.0').tools;
        expect(toolbarPresetOf([...before])).toBe('full');
        const upgraded = upgradeToolbarConfig([...before]);
        expect(upgraded).toEqual(TOOLBAR_PRESETS.full);
        expect(upgraded).not.toBe(TOOLBAR_PRESETS.full);
        expect(upgradeToolbarConfig([...BUBBLE_PRESET_HISTORY.technical[0].tools], 'bubble')).toEqual(BUBBLE_PRESETS.technical);
    });

    it('leave a layout of its own as it is', () => {
        const custom = ['bold', 'italic'];
        expect(toolbarPresetOf(custom)).toBeNull();
        expect(upgradeToolbarConfig(custom)).toBe(custom);
        expect(upgradeToolbarConfig(undefined)).toBeUndefined();
        // A selection-menu shape is no toolbar preset, and the other way round.
        expect(toolbarPresetOf([...BUBBLE_PRESETS.full])).toBeNull();
    });
});

describe('matching a saved layout, told more', () => {
    it('savedWith: only the shape a preset had then counts, so a layout of its own stays the reader\'s', () => {
        const full010 = TOOLBAR_PRESET_HISTORY.full.find(shape => shape.since === '0.10.0').tools;
        // Saved with 0.10.x, it was Full then: brought up to date.
        expect(upgradeToolbarConfig([...full010], 'toolbar', { savedWith: '0.10.3' })).toEqual(TOOLBAR_PRESETS.full);
        // Saved with 0.11.0 (Full had Inline Math then): Full without it is the reader's own.
        const custom = [...full010];
        expect(toolbarPresetOf(custom, 'toolbar', { savedWith: '0.11.0' })).toBeNull();
        expect(upgradeToolbarConfig(custom, 'toolbar', { savedWith: 'v0.12.0' })).toBe(custom);
    });

    it('unavailable: a preset saved without the tools the host turned off is still that preset', async () => {
        const { slotsWithoutStrayDividers } = await import('./slotsWithoutStrayDividers.js');
        const off = ['math', 'mathInline', 'mermaid'];
        const without = slotsWithoutStrayDividers(TOOLBAR_PRESET_HISTORY.science[0].tools, id => !off.includes(id));
        expect(toolbarPresetOf(without)).toBeNull();
        expect(toolbarPresetOf(without, 'toolbar', { unavailable: off })).toBe('science');
        expect(upgradeToolbarConfig(without, 'toolbar', { unavailable: off })).toEqual(slotsWithoutStrayDividers(TOOLBAR_PRESETS.science, id => !off.includes(id)));
    });

    it('the history cannot be changed by a host', () => {
        expect(() => TOOLBAR_PRESET_HISTORY.full.at(-1).tools.push('x')).toThrow();
        expect(TOOLBAR_PRESET_HISTORY.full.at(-1).tools).toEqual(TOOLBAR_PRESETS.full);
    });
});

describe('upgradeToolbarConfig with the host\'s own presets', () => {
    it('brings a layout that was a built-in preset up as the host\'s preset of that name', () => {
        const old = [...TOOLBAR_PRESET_HISTORY.full[0].tools];
        const mine = ['bold', 'italic', '|', 'link'];
        expect(upgradeToolbarConfig(old, 'toolbar', { presets: { full: mine } })).toEqual(mine);
        // A preset the host did not replace comes up as the built-in one.
        expect(upgradeToolbarConfig([...TOOLBAR_PRESET_HISTORY.blogger[0].tools], 'toolbar', { presets: { full: mine } })).toEqual(TOOLBAR_PRESETS.blogger);
    });
});

describe('matching with tools turned off', () => {
    it('matches a layout saved before a tool was turned off (it still holds the tool)', () => {
        const saved = [...TOOLBAR_PRESET_HISTORY.full.find(shape => shape.since === '0.3.1').tools];
        expect(toolbarPresetOf(saved, 'toolbar', { savedWith: '0.9.0', unavailable: ['mermaid'] })).toBe('full');
    });

    it('leaves a layout two presets have come to alike as it is (which was chosen cannot be told)', () => {
        const off = ['bold', 'italic', 'underline', 'strike', 'inlineCode', 'sub', 'sup', 'kbd', 'fontSize', 'highlight', 'color', 'quote', 'clearFormat'];
        // Every bubble preset comes to ['link'] with these off.
        expect(toolbarPresetOf(['link'], 'bubble', { unavailable: off })).toBeNull();
        expect(upgradeToolbarConfig(['link'], 'bubble', { unavailable: off })).toEqual(['link']);
    });
});

describe('upgradeToolbarConfig as the customizer offers presets', () => {
    it('in replace mode, a preset the host left out is no preset: the layout stays the reader\'s', () => {
        const old = [...TOOLBAR_PRESET_HISTORY.full[0].tools];
        expect(upgradeToolbarConfig(old, 'toolbar', { presets: { mine: ['bold'] }, presetsMode: 'replace' })).toBe(old);
    });

    it('gives the host\'s preset as the customizer checks it (unknown tools dropped)', () => {
        const old = [...TOOLBAR_PRESET_HISTORY.full[0].tools];
        expect(upgradeToolbarConfig(old, 'toolbar', { presets: { full: ['bold', 'notATool', 'italic'] } })).toEqual(['bold', 'italic']);
    });

    it('reads a prerelease as either side of its release', () => {
        const full010 = [...TOOLBAR_PRESET_HISTORY.full.find(shape => shape.since === '0.10.0').tools];
        // A prerelease of 0.11.0 may have had 0.10.0's shape or 0.11.0's own: either is Full.
        const full011 = [...TOOLBAR_PRESET_HISTORY.full.find(shape => shape.since === '0.11.0').tools];
        expect(toolbarPresetOf(full010, 'toolbar', { savedWith: '0.11.0-rc.1' })).toBe('full');
        expect(toolbarPresetOf(full011, 'toolbar', { savedWith: '0.11.0-rc.1' })).toBe('full');
        expect(toolbarPresetOf(full010, 'toolbar', { savedWith: '0.11.0' })).toBeNull();
    });
});

describe('upgradeToolbarConfig keeps what a shared layout holds', () => {
    it('gives today\'s preset whole when the layout held the tools this editor turned off', () => {
        const full = [...TOOLBAR_PRESETS.full];
        // Already today's shape, with math: given back as it is (never stripped of it).
        expect(upgradeToolbarConfig(full, 'toolbar', { savedWith: '0.12.0', unavailable: ['math', 'mathInline'] })).toBe(full);
    });

    it('in replace mode with no host presets for the surface, upgrades to the built-in one', () => {
        const old = [...BUBBLE_PRESET_HISTORY.technical[1].tools];
        expect(upgradeToolbarConfig(old, 'bubble', { savedWith: '0.5.0', presetsMode: 'replace' })).toEqual(BUBBLE_PRESETS.technical);
    });
});

describe('upgradeToolbarConfig and tools turned off since', () => {
    it('leaves out tools the host turned off that the saved layout never held', () => {
        const technical031 = [...TOOLBAR_PRESET_HISTORY.technical.find(shape => shape.since === '0.3.1').tools];
        const upgraded = upgradeToolbarConfig(technical031, 'toolbar', { savedWith: '0.3.1', unavailable: ['kbd', 'details'] });
        expect(upgraded).not.toContain('kbd');
        expect(upgraded).not.toContain('details');
        expect(toolbarPresetOf(upgraded, 'toolbar', { unavailable: ['kbd', 'details'] })).toBe('technical');
    });
});

describe('preset functions given no options', () => {
    it('take null as none', () => {
        const old = [...TOOLBAR_PRESET_HISTORY.full[0].tools];
        expect(toolbarPresetOf(old, 'toolbar', null)).toBe('full');
        expect(upgradeToolbarConfig(old, 'toolbar', null)).toEqual(TOOLBAR_PRESETS.full);
    });
});
