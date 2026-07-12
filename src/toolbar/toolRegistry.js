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
