import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    TOOL_REGISTRY, ALL_TOOL_IDS, TOOLBAR_TOOL_IDS, BUBBLE_ALLOWED_TOOL_IDS,
    TOOLBAR_TOOLS, TOOL_GROUPS, TOOLBAR_DIVIDER, DIVIDER, sanitizeToolConfig,
} from './toolRegistry.js';
import {
    TOOLBAR_PRESETS, BUBBLE_PRESETS, BUBBLE_MENU_PRESETS, PRESET_LABELS,
    TOOLBAR_PRESET_LABELS, DEFAULT_TOOLBAR_CONFIG, DEFAULT_BUBBLE_CONFIG,
} from './presets.js';

describe('toolbar registry exports', () => {
    it('exposes every tool id on the toolbar surface', () => {
        expect(TOOLBAR_TOOL_IDS).toEqual(ALL_TOOL_IDS);
        expect(TOOLBAR_TOOL_IDS.length).toBeGreaterThan(20);
    });

    it('bubble-allowed is a strict subset excluding block/media tools', () => {
        expect(BUBBLE_ALLOWED_TOOL_IDS.every(id => ALL_TOOL_IDS.includes(id))).toBe(true);
        expect(BUBBLE_ALLOWED_TOOL_IDS.length).toBeLessThan(ALL_TOOL_IDS.length);
        expect(BUBBLE_ALLOWED_TOOL_IDS).toContain('bold');
        expect(BUBBLE_ALLOWED_TOOL_IDS).not.toContain('table');
        expect(BUBBLE_ALLOWED_TOOL_IDS).not.toContain('h1');
    });

    it('TOOLBAR_TOOLS annotates each tool with its permitted surfaces', () => {
        expect(TOOLBAR_TOOLS.length).toBe(ALL_TOOL_IDS.length);
        expect(TOOLBAR_TOOLS.find(t => t.id === 'bold').surfaces).toContain('bubble');
        expect(TOOLBAR_TOOLS.find(t => t.id === 'table').surfaces).toEqual(['toolbar']);
    });

    it('TOOL_GROUPS covers every group referenced in the registry', () => {
        const groupIds = new Set(TOOL_GROUPS.map(g => g.id));
        for (const id of ALL_TOOL_IDS) {
            expect(groupIds.has(TOOL_REGISTRY[id].group)).toBe(true);
        }
    });

    it('canonical aliases and default configs line up with the built-ins', () => {
        expect(TOOLBAR_DIVIDER).toBe(DIVIDER);
        expect(BUBBLE_MENU_PRESETS).toBe(BUBBLE_PRESETS);
        expect(TOOLBAR_PRESET_LABELS).toBe(PRESET_LABELS);
        expect(DEFAULT_TOOLBAR_CONFIG).toEqual(TOOLBAR_PRESETS.full);
        expect(DEFAULT_BUBBLE_CONFIG).toEqual(BUBBLE_PRESETS.full);
    });
});

describe('sanitizeToolConfig', () => {
    afterEach(() => vi.restoreAllMocks());

    it('keeps valid ids and dividers unchanged', () => {
        const cfg = ['bold', DIVIDER, 'italic', 'h1'];
        expect(sanitizeToolConfig(cfg, 'toolbar')).toEqual(cfg);
    });

    it('drops unknown ids', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(sanitizeToolConfig(['bold', 'nope', 'italic'], 'toolbar')).toEqual(['bold', 'italic']);
    });

    it('drops duplicate tool ids but keeps repeated dividers', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(sanitizeToolConfig(['bold', 'bold', DIVIDER, DIVIDER], 'toolbar')).toEqual(['bold', DIVIDER, DIVIDER]);
    });

    it('drops tools not permitted on the bubble surface', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(sanitizeToolConfig(['bold', 'table', 'h1', 'italic'], 'bubble')).toEqual(['bold', 'italic']);
    });

    it('returns [] for a non-array input', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(sanitizeToolConfig(null, 'toolbar')).toEqual([]);
    });
});
