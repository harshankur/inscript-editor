/**
 * Built-in toolbar presets for common writer archetypes.
 *
 * Each preset is a plain serializable array of tool IDs and '|' dividers.
 * Consumers can store this array (localStorage, backend, etc.) and pass it
 * back to ResponsiveToolbar as the `toolbarConfig` prop.
 *
 * These presets are opinionated defaults — consumers can derive from them
 * or build entirely custom configs using ALL_TOOL_IDS from toolRegistry.js.
 */
import { DIVIDER } from './toolRegistry.js';

const D = DIVIDER; // Shorthand

export const TOOLBAR_PRESETS = {
    /**
     * Full — every available tool. Good as a starting point for customization.
     */
    full: [
        'undo', 'redo', D,
        'h1', 'h2', 'h3', D,
        'bold', 'italic', 'underline', 'strike', 'sub', 'sup', 'abbreviation', D,
        'fontSize', 'highlight', 'color', D,
        'link', 'wikilink', 'footnote', 'citation', D,
        'bullet', 'ordered', 'task', 'definition', D,
        'align', D,
        'code', 'quote', 'admonitions', D,
        'math', 'mermaid', D,
        'image', 'youtube', 'table', 'tags',
    ],

    /**
     * Blogger — focused on readable, visually rich content.
     * Emphasizes formatting, media, and simple structure.
     */
    blogger: [
        'undo', 'redo', D,
        'h1', 'h2', D,
        'bold', 'italic', 'underline', 'strike', D,
        'highlight', 'color', D,
        'link', D,
        'bullet', 'ordered', D,
        'align', D,
        'quote', D,
        'image', 'youtube', 'table', 'tags',
    ],

    /**
     * Technical Writer — documentation, APIs, dev guides.
     * Heavy on structure, code, wikilinks, admonitions, diagrams.
     */
    technical: [
        'undo', 'redo', D,
        'h1', 'h2', 'h3', D,
        'bold', 'italic', 'underline', 'strike', 'abbreviation', D,
        'link', 'wikilink', 'footnote', D,
        'bullet', 'ordered', 'task', 'definition', D,
        'align', D,
        'code', 'quote', 'admonitions', D,
        'mermaid', D,
        'image', 'table', 'tags',
    ],

    /**
     * Science / Academic — research papers, lab notes, formulas.
     * Emphasizes precision: math, footnotes, sub/superscript, citations.
     */
    science: [
        'undo', 'redo', D,
        'h1', 'h2', 'h3', D,
        'bold', 'italic', 'underline', 'strike', 'sub', 'sup', 'abbreviation', D,
        'link', 'footnote', 'citation', D,
        'bullet', 'ordered', 'task', D,
        'align', D,
        'code', 'quote', D,
        'math', 'mermaid', D,
        'image', 'table',
    ],
};

/** Human-readable label for each preset key (for display in the customizer UI). */
export const PRESET_LABELS = {
    full:      'Full',
    blogger:   'Blogger',
    technical: 'Technical Writer',
    science:   'Science / Academic',
};

export const BUBBLE_PRESETS = {
    full: [
        'bold', 'italic', 'underline', 'strike', 'sub', 'sup', D,
        'fontSize', 'highlight', 'color', D,
        'link', 'code', 'quote'
    ],
    blogger: [
        'bold', 'italic', 'underline', D,
        'highlight', 'color', D,
        'link', 'quote'
    ],
    technical: [
        'bold', 'italic', 'underline', D,
        'link', 'code', 'quote'
    ],
    science: [
        'bold', 'italic', 'underline', 'sub', 'sup', D,
        'link', 'code', 'quote'
    ],
};

// --- Canonical (doc-facing) aliases + defaults ---------------------------------
// The editor renders the `full` preset on each surface when its config prop is
// left undefined, so these are the source of truth for "is this the default?".

/** Alias of BUBBLE_PRESETS under the doc's canonical name. */
export const BUBBLE_MENU_PRESETS = BUBBLE_PRESETS;

/** Alias of PRESET_LABELS under the doc's canonical name. */
export const TOOLBAR_PRESET_LABELS = PRESET_LABELS;

/** What the main toolbar renders when `toolbarConfig` is undefined. */
export const DEFAULT_TOOLBAR_CONFIG = TOOLBAR_PRESETS.full;

/** What the bubble menu renders when `bubbleMenuConfig` is undefined. */
export const DEFAULT_BUBBLE_CONFIG = BUBBLE_PRESETS.full;
