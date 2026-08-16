/**
 * Tool Registry — all metadata about every possible toolbar tool.
 * Contains labels, icons, and group categorization.
 * Tool ACTIONS are NOT here — those require an editor instance and live in
 * ResponsiveToolbar.jsx. This file is the serialization-safe half.
 *
 * The serializable config format is an array of tool IDs or the divider
 * sentinel string '|'. Example:
 *   ['undo', 'redo', '|', 'bold', 'italic', '|', 'h1', 'h2']
 */
import {
    Undo, Redo, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    Heading1, Heading2, Heading3,
    Subscript as SubscriptIcon, Superscript as SuperscriptIcon, TextSelect,
    Highlighter, Palette,
    Link, Link2, MessageSquareQuote,
    List, ListOrdered, SquareCheck, BookType, BookOpen,
    AlignLeft,
    Code, Quote,
    Info,
    Sigma, Workflow,
    Image as ImageIcon, Youtube as YoutubeIcon, Table as TableIcon, Tag,
} from 'lucide-react';

/** Sentinel value used to represent a divider in a serialized config. */
export const DIVIDER = '|';

/**
 * Full registry of all available toolbar tools.
 * id must be unique and stable — it is used in serialized configs.
 */
export const TOOL_REGISTRY = {
    // History
    undo:        { id: 'undo',        label: 'Undo',              icon: Undo,             group: 'history'    },
    redo:        { id: 'redo',        label: 'Redo',              icon: Redo,             group: 'history'    },

    // Structure
    h1:          { id: 'h1',          label: 'Heading 1',         icon: Heading1,         group: 'structure'  },
    h2:          { id: 'h2',          label: 'Heading 2',         icon: Heading2,         group: 'structure'  },
    h3:          { id: 'h3',          label: 'Heading 3',         icon: Heading3,         group: 'structure'  },

    // Inline formatting
    bold:        { id: 'bold',        label: 'Bold',              icon: Bold,             group: 'formatting' },
    italic:      { id: 'italic',      label: 'Italic',            icon: Italic,           group: 'formatting' },
    underline:   { id: 'underline',   label: 'Underline',         icon: UnderlineIcon,    group: 'formatting' },
    strike:      { id: 'strike',      label: 'Strikethrough',     icon: Strikethrough,    group: 'formatting' },
    sub:         { id: 'sub',         label: 'Subscript',         icon: SubscriptIcon,    group: 'formatting' },
    sup:         { id: 'sup',         label: 'Superscript',       icon: SuperscriptIcon,  group: 'formatting' },
    abbreviation:{ id: 'abbreviation',label: 'Abbreviation',      icon: TextSelect,       group: 'formatting' },

    // Styling
    fontSize:    { id: 'fontSize',    label: 'Font Size',         icon: null,             group: 'styling'    },
    highlight:   { id: 'highlight',   label: 'Highlight Color',   icon: Highlighter,      group: 'styling'    },
    color:       { id: 'color',       label: 'Text Color',        icon: Palette,          group: 'styling'    },

    // Links & references
    link:        { id: 'link',        label: 'Link',              icon: Link,             group: 'links'      },
    wikilink:    { id: 'wikilink',    label: 'Wikilink',          icon: Link2,            group: 'links'      },
    footnote:    { id: 'footnote',    label: 'Footnote',          icon: MessageSquareQuote, group: 'links'    },
    citation:    { id: 'citation',    label: 'Citation',          icon: BookOpen,         group: 'links'      },

    // Lists
    bullet:      { id: 'bullet',      label: 'Bullet List',       icon: List,             group: 'lists'      },
    ordered:     { id: 'ordered',     label: 'Numbered List',     icon: ListOrdered,      group: 'lists'      },
    task:        { id: 'task',        label: 'Task List',         icon: SquareCheck,      group: 'lists'      },
    definition:  { id: 'definition',  label: 'Definition List',   icon: BookType,         group: 'lists'      },

    // Alignment (dropdown)
    align:       { id: 'align',       label: 'Text Alignment',    icon: AlignLeft,        group: 'alignment'  },

    // Block types
    code:        { id: 'code',        label: 'Code Block',        icon: Code,             group: 'blocks'     },
    quote:       { id: 'quote',       label: 'Quote',             icon: Quote,            group: 'blocks'     },
    admonitions: { id: 'admonitions', label: 'Admonitions',       icon: Info,             group: 'blocks'     },

    // Advanced
    math:        { id: 'math',        label: 'Math Block',        icon: Sigma,            group: 'advanced'   },
    mermaid:     { id: 'mermaid',     label: 'Mermaid Diagram',   icon: Workflow,         group: 'advanced'   },

    // Media & meta
    image:       { id: 'image',       label: 'Image',             icon: ImageIcon,        group: 'media'      },
    youtube:     { id: 'youtube',     label: 'YouTube',           icon: YoutubeIcon,      group: 'media'      },
    table:       { id: 'table',       label: 'Table',             icon: TableIcon,        group: 'media'      },
    tags:        { id: 'tags',        label: 'Tags & Categories', icon: Tag,              group: 'meta'       },
};

/** Ordered list of all tool IDs (excludes dividers) */
export const ALL_TOOL_IDS = Object.keys(TOOL_REGISTRY);

/** Canonical alias for the divider sentinel (doc-facing name). */
export const TOOLBAR_DIVIDER = DIVIDER;

/**
 * The subset of tools valid in the text-selection bubble menu. The bubble menu
 * holds only inline/selection-relevant tools — block/structural/media tools
 * (headings, lists, tables, image, …) have no meaning mid-selection.
 */
const BUBBLE_ALLOWED = new Set([
    'bold', 'italic', 'underline', 'strike', 'sub', 'sup', 'abbreviation',
    'fontSize', 'highlight', 'color', 'link', 'code', 'quote',
]);

/** Every tool that may appear in the main toolbar (all of them). */
export const TOOLBAR_TOOL_IDS = ALL_TOOL_IDS;

/** The tools permitted in the bubble menu (a subset of the main toolbar). */
export const BUBBLE_ALLOWED_TOOL_IDS = ALL_TOOL_IDS.filter(id => BUBBLE_ALLOWED.has(id));

/**
 * The ordered master registry as an array, each entry annotated with the
 * surfaces it is permitted on ('toolbar' always; 'bubble' for the subset).
 * Lets a consumer build custom presets while knowing "what can go where".
 */
export const TOOLBAR_TOOLS = ALL_TOOL_IDS.map(id => ({
    ...TOOL_REGISTRY[id],
    surfaces: BUBBLE_ALLOWED.has(id) ? ['toolbar', 'bubble'] : ['toolbar'],
}));

/** Ordered tool groups with display labels, so a custom UI can group the same way. */
export const TOOL_GROUPS = [
    { id: 'history',    label: 'History'            },
    { id: 'structure',  label: 'Structure'          },
    { id: 'formatting', label: 'Formatting'         },
    { id: 'styling',    label: 'Styling'            },
    { id: 'links',      label: 'Links & References' },
    { id: 'lists',      label: 'Lists'              },
    { id: 'alignment',  label: 'Alignment'          },
    { id: 'blocks',     label: 'Blocks'             },
    { id: 'advanced',   label: 'Advanced'           },
    { id: 'media',      label: 'Media'              },
    { id: 'meta',       label: 'Meta'               },
];

// Dev-only warning. Read NODE_ENV dynamically off globalThis so a library
// bundler doesn't statically strip it at build time, and so it stays quiet in a
// production consumer build (and harmlessly warns where NODE_ENV is unset).
function devWarn(msg) {
    let env;
    try { env = globalThis.process && globalThis.process.env && globalThis.process.env.NODE_ENV; } catch { env = undefined; }
    if (env !== 'production') console.warn(`[inscript-editor] ${msg}`);
}

/**
 * Validate a serialized tool config for a surface ('toolbar' | 'bubble').
 * Unknown ids, duplicates, and tools not permitted on the surface are dropped
 * with a dev-only warning — never thrown. A bad consumer list degrades to fewer
 * tools, never a broken editor. The DIVIDER sentinel is always kept (may repeat).
 */
export function sanitizeToolConfig(config, surface = 'toolbar') {
    if (!Array.isArray(config)) {
        devWarn(`toolbar config must be an array; got ${typeof config}`);
        return [];
    }
    const allowed = surface === 'bubble' ? new Set(BUBBLE_ALLOWED_TOOL_IDS) : new Set(TOOLBAR_TOOL_IDS);
    const seen = new Set();
    const out = [];
    for (const id of config) {
        if (id === DIVIDER) { out.push(id); continue; }
        if (!TOOL_REGISTRY[id]) { devWarn(`unknown tool id "${id}" dropped`); continue; }
        if (!allowed.has(id)) { devWarn(`tool "${id}" is not allowed on the ${surface} surface; dropped`); continue; }
        if (seen.has(id)) { devWarn(`duplicate tool id "${id}" dropped`); continue; }
        seen.add(id);
        out.push(id);
    }
    return out;
}
