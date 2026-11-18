/**
 * Every shape each built-in preset has had, release by release, oldest first: the last is today's
 * (TOOLBAR_PRESETS, BUBBLE_PRESETS). A layout a host saved as one of a preset's shapes is that preset
 * (see toolbarPresetOf and upgradeToolbarConfig), so a saved layout follows its preset when a release
 * changes it. When a release changes a preset, its new shape is added at the end here and no shape is
 * ever removed: a test fails until it is.
 */
import { BUBBLE_PRESETS, TOOLBAR_PRESETS } from './presets.js';
import { slotsWithoutStrayDividers } from './slotsWithoutStrayDividers.js';
import { DIVIDER, sanitizeToolConfig } from './toolRegistry.js';

const D = DIVIDER; // Shorthand

/** Frozen through: a host can read the history, never change what every editor on the page matches against. */
const frozen = history => Object.freeze(Object.fromEntries(Object.entries(history).map(([name, shapes]) => [
    name, Object.freeze(shapes.map(({ since, tools }) => Object.freeze({ since, tools: Object.freeze([...tools]) }))),
])));

/** The main toolbar's presets, every shape each has had (`since`: the release it first shipped in). */
export const TOOLBAR_PRESET_HISTORY = frozen({
    full: [
        { since: '0.1.0', tools: [
            'undo', 'redo', D, 'h1', 'h2', 'h3', D, 'bold', 'italic', 'underline', 'strike', 'sub',
            'sup', 'abbreviation', D, 'fontSize', 'highlight', 'color', D, 'link', 'wikilink',
            'footnote', 'citation', D, 'bullet', 'ordered', 'task', 'definition', D, 'align', D, 'code',
            'quote', 'admonitions', D, 'math', 'mermaid', D, 'image', 'youtube', 'table', 'tags',
        ] },
        { since: '0.2.9', tools: [
            'undo', 'redo', D, 'h1', 'h2', 'h3', D, 'bold', 'italic', 'underline', 'strike',
            'inlineCode', 'sub', 'sup', 'abbreviation', 'clearFormat', D, 'fontSize', 'highlight',
            'color', D, 'link', 'wikilink', 'footnote', 'citation', D, 'bullet', 'ordered', 'task',
            'definition', D, 'align', D, 'code', 'quote', 'admonitions', 'hr', D, 'math', 'mermaid', D,
            'image', 'youtube', 'table', 'tags',
        ] },
        { since: '0.3.1', tools: [
            'undo', 'redo', D, 'h1', 'h2', 'h3', D, 'bold', 'italic', 'underline', 'strike',
            'inlineCode', 'sub', 'sup', 'abbreviation', 'clearFormat', D, 'fontSize', 'highlight',
            'color', D, 'link', 'footnote', 'citation', D, 'bullet', 'ordered', 'task', 'definition', D,
            'align', D, 'code', 'quote', 'admonitions', 'hr', D, 'math', 'mermaid', D, 'image',
            'youtube', 'table', 'tags',
        ] },
        { since: '0.10.0', tools: [
            'undo', 'redo', D, 'h1', 'h2', 'h3', D, 'bold', 'italic', 'underline', 'strike',
            'inlineCode', 'kbd', 'sub', 'sup', 'abbreviation', 'clearFormat', D, 'fontSize',
            'highlight', 'color', D, 'link', 'footnote', 'citation', D, 'bullet', 'ordered', 'task',
            'definition', D, 'align', D, 'code', 'quote', 'admonitions', 'details', 'hr', D, 'math',
            'mermaid', D, 'image', 'youtube', 'table', 'tags',
        ] },
        { since: '0.11.0', tools: [
            'undo', 'redo', D, 'h1', 'h2', 'h3', D, 'bold', 'italic', 'underline', 'strike',
            'inlineCode', 'kbd', 'sub', 'sup', 'abbreviation', 'clearFormat', D, 'fontSize',
            'highlight', 'color', D, 'link', 'footnote', 'citation', D, 'bullet', 'ordered', 'task',
            'definition', D, 'align', D, 'code', 'quote', 'admonitions', 'details', 'hr', D, 'math',
            'mathInline', 'mermaid', D, 'image', 'youtube', 'table', 'tags',
        ] },
    ],
    blogger: [
        { since: '0.1.0', tools: [
            'undo', 'redo', D, 'h1', 'h2', D, 'bold', 'italic', 'underline', 'strike', D, 'highlight',
            'color', D, 'link', D, 'bullet', 'ordered', D, 'align', D, 'quote', D, 'image', 'youtube',
            'table', 'tags',
        ] },
        { since: '0.2.9', tools: [
            'undo', 'redo', D, 'h1', 'h2', D, 'bold', 'italic', 'underline', 'strike', 'clearFormat', D,
            'highlight', 'color', D, 'link', D, 'bullet', 'ordered', D, 'align', D, 'quote', 'hr', D,
            'image', 'youtube', 'table', 'tags',
        ] },
    ],
    technical: [
        { since: '0.1.0', tools: [
            'undo', 'redo', D, 'h1', 'h2', 'h3', D, 'bold', 'italic', 'underline', 'strike',
            'abbreviation', D, 'link', 'wikilink', 'footnote', D, 'bullet', 'ordered', 'task',
            'definition', D, 'align', D, 'code', 'quote', 'admonitions', D, 'mermaid', D, 'image',
            'table', 'tags',
        ] },
        { since: '0.2.9', tools: [
            'undo', 'redo', D, 'h1', 'h2', 'h3', D, 'bold', 'italic', 'underline', 'strike',
            'inlineCode', 'abbreviation', D, 'link', 'wikilink', 'footnote', D, 'bullet', 'ordered',
            'task', 'definition', D, 'align', D, 'code', 'quote', 'admonitions', 'hr', D, 'mermaid', D,
            'image', 'table', 'tags',
        ] },
        { since: '0.3.1', tools: [
            'undo', 'redo', D, 'h1', 'h2', 'h3', D, 'bold', 'italic', 'underline', 'strike',
            'inlineCode', 'abbreviation', D, 'link', 'footnote', D, 'bullet', 'ordered', 'task',
            'definition', D, 'align', D, 'code', 'quote', 'admonitions', 'hr', D, 'mermaid', D, 'image',
            'table', 'tags',
        ] },
        { since: '0.10.0', tools: [
            'undo', 'redo', D, 'h1', 'h2', 'h3', D, 'bold', 'italic', 'underline', 'strike',
            'inlineCode', 'kbd', 'abbreviation', D, 'link', 'footnote', D, 'bullet', 'ordered', 'task',
            'definition', D, 'align', D, 'code', 'quote', 'admonitions', 'details', 'hr', D, 'mermaid',
            D, 'image', 'table', 'tags',
        ] },
    ],
    science: [
        { since: '0.1.0', tools: [
            'undo', 'redo', D, 'h1', 'h2', 'h3', D, 'bold', 'italic', 'underline', 'strike', 'sub',
            'sup', 'abbreviation', D, 'link', 'footnote', 'citation', D, 'bullet', 'ordered', 'task', D,
            'align', D, 'code', 'quote', D, 'math', 'mermaid', D, 'image', 'table',
        ] },
        { since: '0.2.9', tools: [
            'undo', 'redo', D, 'h1', 'h2', 'h3', D, 'bold', 'italic', 'underline', 'strike',
            'inlineCode', 'sub', 'sup', 'abbreviation', D, 'link', 'footnote', 'citation', D, 'bullet',
            'ordered', 'task', D, 'align', D, 'code', 'quote', 'hr', D, 'math', 'mermaid', D, 'image',
            'table',
        ] },
        { since: '0.11.0', tools: [
            'undo', 'redo', D, 'h1', 'h2', 'h3', D, 'bold', 'italic', 'underline', 'strike',
            'inlineCode', 'sub', 'sup', 'abbreviation', D, 'link', 'footnote', 'citation', D, 'bullet',
            'ordered', 'task', D, 'align', D, 'code', 'quote', 'hr', D, 'math', 'mathInline', 'mermaid',
            D, 'image', 'table',
        ] },
    ],
});

/** The selection menu's presets, every shape each has had. */
export const BUBBLE_PRESET_HISTORY = frozen({
    full: [
        { since: '0.1.0', tools: [
            'bold', 'italic', 'underline', 'strike', 'sub', 'sup', D, 'fontSize', 'highlight', 'color',
            D, 'link', 'code', 'quote',
        ] },
        { since: '0.2.9', tools: [
            'bold', 'italic', 'underline', 'strike', 'inlineCode', 'sub', 'sup', D, 'fontSize',
            'highlight', 'color', D, 'link', 'quote', 'clearFormat',
        ] },
    ],
    blogger: [
        { since: '0.1.0', tools: [
            'bold', 'italic', 'underline', D, 'highlight', 'color', D, 'link', 'quote',
        ] },
        { since: '0.2.9', tools: [
            'bold', 'italic', 'underline', D, 'highlight', 'color', D, 'link', 'quote', 'clearFormat',
        ] },
    ],
    technical: [
        { since: '0.1.0', tools: [
            'bold', 'italic', 'underline', D, 'link', 'code', 'quote',
        ] },
        { since: '0.2.9', tools: [
            'bold', 'italic', 'underline', 'inlineCode', D, 'link', 'quote',
        ] },
        { since: '0.10.0', tools: [
            'bold', 'italic', 'underline', 'inlineCode', 'kbd', D, 'link', 'quote',
        ] },
    ],
    science: [
        { since: '0.1.0', tools: [
            'bold', 'italic', 'underline', 'sub', 'sup', D, 'link', 'code', 'quote',
        ] },
        { since: '0.2.9', tools: [
            'bold', 'italic', 'underline', 'inlineCode', 'sub', 'sup', D, 'link', 'quote',
        ] },
    ],
});

const HISTORIES = Object.freeze({ toolbar: TOOLBAR_PRESET_HISTORY, bubble: BUBBLE_PRESET_HISTORY });
const sameTools = (config, tools) => Array.isArray(config) && config.length === tools.length && config.every((tool, index) => tool === tools[index]);

/**
 * A release's version as numbers (`0.10.0` is [0, 10, 0]) and whether it is a prerelease
 * (`0.11.0-rc.1`), for comparing: a prerelease comes before its release.
 */
const versionOf = version => {
    const [core, prerelease] = String(version).replace(/^v/, '').split('-', 2);
    return { parts: core.split('.').map(part => Number.parseInt(part, 10) || 0), prerelease: prerelease !== undefined };
};
const versionAtLeast = (version, since) => {
    const [a, b] = [versionOf(version), versionOf(since)];
    for (let index = 0; index < 3; index++) {
        if ((a.parts[index] ?? 0) !== (b.parts[index] ?? 0)) return (a.parts[index] ?? 0) > (b.parts[index] ?? 0);
    }
    // The same release: a prerelease of it is not yet it.
    return !a.prerelease || b.prerelease;
};

/**
 * The shapes of a preset a saved layout may be: every shape it had, or (`savedWith`, the release the
 * layout was saved with) only the one it had then (for a prerelease, `0.13.0-rc.1`, the one before its
 * release or the release's own: a prerelease may already ship it). Each as it is, and with the tools the host turned
 * off taken out, as the customizer saves a preset (`unavailable`): a layout saved before a tool was
 * turned off still holds it. A preset saved while a tool was off, matched while it is off, is not once
 * the tool is back: without the tool, it cannot be told from a layout the reader made without it.
 */
function shapesOf(shapes, { savedWith, unavailable } = {}) {
    let candidates = shapes;
    if (savedWith) {
        const currentAt = version => shapes.filter(shape => versionAtLeast(version, shape.since)).at(-1);
        const release = versionOf(savedWith).parts.join('.');
        candidates = [...new Set([currentAt(savedWith), currentAt(release)])].filter(Boolean);
    }
    const off = new Set(unavailable ?? []);
    // Each as { tools, stripped }: whether it is the shape with the tools turned off taken out.
    return candidates.flatMap(shape => [
        { tools: shape.tools, stripped: false },
        ...(off.size ? [{ tools: slotsWithoutStrayDividers(shape.tools, id => !off.has(id)), stripped: true }] : []),
    ]);
}

/**
 * The one built-in preset a saved layout is, and whether it is to be given without the tools turned off
 * (`stripped`), or null (none, or two presets left alike by the tools turned off: which the
 * reader chose cannot be told).
 */
function presetMatch(config, surface, options) {
    options = options ?? {};
    const names = Object.entries(HISTORIES[surface] ?? {})
        .filter(([, shapes]) => shapesOf(shapes, options).some(shape => sameTools(config, shape.tools)))
        .map(([name]) => name);
    if (names.length !== 1) return null;
    // Saved without the tools turned off unless it holds one of them (a layout shared with an editor
    // that has them): as the customizer saves a preset here.
    const off = new Set(options.unavailable ?? []);
    return { name: names[0], stripped: !config.some(id => off.has(id)) };
}

/**
 * The built-in preset a saved layout is, today's shape or any it had before, or null when it is a
 * layout of its own (Custom).
 * @param {unknown} config - A saved layout: tool ids and dividers.
 * @param {'toolbar' | 'bubble'} [surface] - The main toolbar's (default) or the selection menu's.
 * @param {{ savedWith?: string, unavailable?: string[] }} [options] - `savedWith`: the inscript-editor
 *   release the layout was saved with, so only the shape each preset had then counts (a layout of its
 *   own that happens to equal an older shape stays the reader's). `unavailable`: tools the host turned
 *   off, which the customizer leaves out of a preset it saves.
 * @returns {string | null} The preset's key (`full`, `blogger`, …).
 */
export function toolbarPresetOf(config, surface = 'toolbar', options = {}) {
    return presetMatch(config, surface, options)?.name ?? null;
}

/**
 * A saved layout brought up to date: one that is a built-in preset's (today's shape or a past one) is
 * that preset as it is today (a copy, without the tools the host turned off), so a release that adds a
 * tool to a preset shows it to every reader who chose that preset. A layout of its own is given back as
 * it is.
 * @param {unknown} config - A saved layout: tool ids and dividers.
 * @param {'toolbar' | 'bubble'} [surface] - The main toolbar's (default) or the selection menu's.
 * @param {{ savedWith?: string, unavailable?: string[], presets?: Record<string, string[]>, presetsMode?: 'merge' | 'replace' }} [options] -
 *   As toolbarPresetOf's, and the presets you give the customizer, as you give them (`presets`: your
 *   `toolbarPresets` or `bubbleMenuPresets`; `presetsMode`: its `presetsMode`), so a layout that was a
 *   built-in preset comes up as the customizer offers that preset: yours of that name where you
 *   replaced it, and as a layout of its own where your presets leave it out (`replace`).
 */
export function upgradeToolbarConfig(config, surface = 'toolbar', options = {}) {
    options = options ?? {};
    const match = presetMatch(config, surface, options);
    if (!match) return config;
    const { name, stripped } = match;
    const builtIn = surface === 'bubble' ? BUBBLE_PRESETS : TOOLBAR_PRESETS;
    // The host's preset of that name, as the customizer reads it (checked, whatever was given).
    const own = options.presets && Object.hasOwn(options.presets, name) ? sanitizeToolConfig(options.presets[name], surface) : null;
    // In replace mode the customizer offers the host's presets only (when it has any for this surface).
    if (!own && options.presetsMode === 'replace' && options.presets) return config;
    const today = own ?? builtIn[name];
    if (!today) return config;
    // As it was saved: without the tools turned off only when it was saved without them (a layout
    // shared with an editor that has them keeps them).
    const off = new Set(options.unavailable ?? []);
    const shown = stripped && off.size ? slotsWithoutStrayDividers(today, id => !off.has(id)) : [...today];
    return sameTools(config, shown) ? config : shown;
}

/**
 * The layout to show for one a host saved: brought up to date (see upgradeToolbarConfig) when the host
 * says which release it was saved with (`savedWith`), as given otherwise (which preset an older shape
 * was cannot be told for sure without it).
 * @param {unknown} config
 * @param {'toolbar' | 'bubble'} surface
 * @param {{ savedWith?: string | null, unavailable?: string[], presets?: Record<string, string[]>, presetsMode?: 'merge' | 'replace' }} options
 *   As upgradeToolbarConfig's (`unavailable`: the tools this editor cannot show, which the customizer
 *   leaves out of a preset it saves).
 */
export function currentLayout(config, surface, { savedWith, unavailable, presets, presetsMode } = {}) {
    if (!savedWith || !Array.isArray(config)) return config;
    return upgradeToolbarConfig(config, surface, { savedWith, unavailable, presets, presetsMode });
}
