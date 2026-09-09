import type { ReactNode, Ref } from 'react';
import type { Editor } from '@tiptap/core';

export interface HistoryEntry {
    html: string;
    title: string;
    tags: string[];
    categories: string[];
    timestamp: string;
    isOriginal?: boolean;
}

export interface WikilinkResolution {
    exists: boolean;
    href: string;
    onNavigate?: ((page: string) => void) | null;
}

/** Options threaded to buildExtensions to toggle opt-in features per editor. */
export interface EditorBuildOptions {
    taskList?: boolean;
    admonition?: boolean;
    footnote?: boolean;
    definitionList?: boolean;
    abbreviation?: boolean;
    mermaid?: boolean;
    math?: boolean;
    citation?: boolean;
    /** Generic third-party embeds (on by default). `false` disables; an object configures trust. */
    embed?: boolean | { isTrusted?: (src: string) => boolean; trustedEmbedHosts?: string[] };
    /** Host-supplied embed trust (alternative to the object form of `embed`). */
    isEmbedTrusted?: (src: string) => boolean;
    trustedEmbedHosts?: string[];
    /** YouTube node options, e.g. `{ facade: true }` for thumbnail-then-load. */
    youtube?: { facade?: boolean };
    wikilink?: { enabled?: boolean; resolver?: (page: string) => WikilinkResolution | null };
    /** Link behavior: turn typed/pasted URLs into links (both default true). */
    link?: { autolink?: boolean; linkOnPaste?: boolean };
    /** The "/" command menu. `false` disables it entirely. */
    slashCommand?: boolean;
    /** Custom slash-command registry entries (replaces the default set when provided). */
    slashCommands?: unknown[];
    [key: string]: unknown;
}

export interface UseInscriptEditorOptions {
    /** Changing this value recreates the editor (pass a filename or document id). */
    contentKey?: string;
    /** Live title prop; read inside the debounced onUpdate closure without recreating the editor. */
    title?: string;
    /** Live tags prop; read inside the debounced onUpdate closure. */
    tags?: string[];
    /** Live categories prop; read inside the debounced onUpdate closure. */
    categories?: string[];
    /** Disables editing when true. */
    isReadonly?: boolean;
    /** Called with the new history entry after the 1000ms debounce settles. */
    onContentChange?: ((entry: HistoryEntry) => void) | null;
    /** Feature toggles/callbacks passed to buildExtensions (changing this recreates the editor). */
    editorOptions?: EditorBuildOptions;
    /** Browser spellcheck underlines in the editor (default true). Applied live, no editor recreation. */
    spellcheck?: boolean;
}

export interface UseInscriptEditorResult {
    editor: Editor | null;
    history: HistoryEntry[];
    setHistory: (history: HistoryEntry[]) => void;
    historyIndex: number;
    setHistoryIndex: (index: number) => void;
    isDirty: boolean;
    setIsDirty: (dirty: boolean) => void;
    canUndo: boolean;
    canRedo: boolean;
    /** Restores editor content to a history entry without emitting an onUpdate/history push. */
    restoreVersion: (index: number) => void;
    /** Clears the dirty flag after a successful save. */
    markSaved: () => void;
    /** Refs exposed for consumers that need to coordinate with server-sync/save flows directly. */
    titleRef: { current: string };
    historyRef: { current: HistoryEntry[] };
    historyDebounceRef: { current: ReturnType<typeof setTimeout> | null };
    isSyncingRef: { current: boolean };
    isLoadingRef: { current: boolean };
}

export function useInscriptEditor(options?: UseInscriptEditorOptions): UseInscriptEditorResult;

export interface InscriptEditorRefHandle {
    getHTML: () => string;
    getText: () => string;
    setContent: (html: string) => void;
    restoreVersion: (index: number) => void;
    markSaved: () => void;
    toggleFocusMode: () => void;
}

export interface OriginalContent {
    html: string;
    title: string;
    tags: string[];
    categories: string[];
}

export interface InscriptEditorProps {
    editor: Editor | null;
    isReadonly?: boolean;
    showDiff?: boolean;
    /** Hides the toolbar and narrows/dims the column for distraction-free writing. */
    focusMode?: boolean;
    history?: HistoryEntry[];
    historyIndex?: number;
    originalContent?: OriginalContent;
    canUndo?: boolean;
    canRedo?: boolean;
    onHistoryUndo?: () => void;
    onHistoryRedo?: () => void;
    onShowMetadataModal?: () => void;
    hasMetadata?: boolean;
    showMetadataActive?: boolean;
    onShowMediaLibrary?: () => void;
    onAddYoutube?: () => void;
    onHistorySelect?: (index: number) => void;
    restoreVersion?: (index: number) => void;
    markSaved?: () => void;
    toolbarConfig?: string[];
    onToolbarConfigChange?: (newConfig: string[]) => void;
    bubbleMenuConfig?: string[];
    onBubbleMenuConfigChange?: (newConfig: string[]) => void;
    /** Consumer-supplied named presets for the main toolbar (arrays of tool ids + '|'). */
    toolbarPresets?: Record<string, string[]>;
    /** Consumer-supplied named presets for the selection bubble menu. */
    bubbleMenuPresets?: Record<string, string[]>;
    /** Display labels for the consumer preset keys. */
    toolbarPresetLabels?: Record<string, string>;
    /** Whether consumer presets replace the built-ins or extend them. Default 'merge'. */
    presetsMode?: 'replace' | 'merge';
    /**
     * DOM element to render the toolbar-customizer drawer into and scope it to
     * (position:absolute within it) instead of covering the viewport (the default,
     * position:fixed). The element should be position:relative + overflow:hidden.
     */
    customizerContainer?: HTMLElement | null;
    fontFamily?: string;
    /** Reading text size (any CSS length, e.g. '1.125rem'). Sets --inscript-font-size; headings scale
     *  in em off it. Omitted/empty keeps the 18px default. */
    fontSize?: string;
    maxWidth?: string;
    lineHeight?: string;
    /** Optional distinct heading font-family stack (--inscript-heading-font). Empty = same as body. */
    headingFontFamily?: string;
    /** Column width in focus mode (any CSS length). Empty = the 48rem default. */
    focusMaxWidth?: string;
    /** Dim non-focused paragraphs in focus mode (default true). False = narrow column only, no dimming. */
    focusDim?: boolean;
    /** Open an external URL (a media node's "open in new tab" action). Supply this on hosts where
     *  window.open is blocked/inert (e.g. a Tauri desktop webview) to route through the host's opener.
     *  When omitted, the editor falls back to window.open. */
    onOpenExternal?: (url: string) => void;
    ref?: Ref<InscriptEditorRefHandle>;
}

export const InscriptEditor: (props: InscriptEditorProps) => ReactNode;

// --- Toolbar registry & presets (single source of truth for consumer UIs) ---
export type ToolSurface = 'toolbar' | 'bubble';
export interface ToolMeta {
    id: string;
    label: string;
    icon: React.ComponentType<{ size?: number }> | null;
    group: string;
}
export interface ToolMetaWithSurfaces extends ToolMeta {
    surfaces: ToolSurface[];
}
export const TOOL_REGISTRY: Record<string, ToolMeta>;
export const DIVIDER: '|';
export const TOOLBAR_DIVIDER: '|';
export const ALL_TOOL_IDS: string[];
export const TOOLBAR_TOOL_IDS: string[];
export const BUBBLE_ALLOWED_TOOL_IDS: string[];
export const TOOLBAR_TOOLS: ToolMetaWithSurfaces[];
export const TOOL_GROUPS: Array<{ id: string; label: string }>;
/** Validate a serialized tool config for a surface; drops invalid ids, never throws. */
export function sanitizeToolConfig(config: unknown, surface?: ToolSurface): string[];
export const TOOLBAR_PRESETS: Record<string, string[]>;
export const BUBBLE_PRESETS: Record<string, string[]>;
export const BUBBLE_MENU_PRESETS: Record<string, string[]>;
export const PRESET_LABELS: Record<string, string>;
export const TOOLBAR_PRESET_LABELS: Record<string, string>;
export const DEFAULT_TOOLBAR_CONFIG: string[];
export const DEFAULT_BUBBLE_CONFIG: string[];

// --- Extensions ---
export const Youtube: import('@tiptap/core').Node;
export const FontSize: import('@tiptap/core').Mark;
export const CustomTable: import('@tiptap/core').Node;
export const CustomImage: import('@tiptap/core').Node;
export const Citation: import('@tiptap/core').Node;
export const Embed: import('@tiptap/core').Node;

// --- Table utils ---
export interface TableNodeResult {
    node: { attrs: Record<string, unknown> };
    pos: number;
}

export function getTableNode(state: import('@tiptap/pm/state').EditorState): TableNodeResult | null;
export function isHeaderRowActive(editor: Editor): boolean;
export function isHeaderColumnActive(editor: Editor): boolean;
export function setTableLayout(editor: Editor, attrs: Record<string, unknown>): boolean;

// --- Other utils ---
export function getTextContent(html: string): string;
export function extractYoutubeId(input: string): string | null;
export interface HeadingEntry { level: number; text: string; pos: number; }
/** Walks the document for heading nodes; shared by DocumentOutline and MiniMap. */
export function extractHeadings(editor: Editor): HeadingEntry[];
/** Registers inscript-editor's custom-node preservation rules on a TurndownService. */
export function applyInscriptEditorTurndownRules(turndownService: { addRule: (key: string, rule: unknown) => unknown }): void;

// --- UI components ---
export interface ToolbarButtonProps {
    onClick?: () => void;
    active?: boolean;
    disabled?: boolean;
    title?: string;
    width?: number;
    className?: string;
    children?: ReactNode;
}
export const ToolbarButton: (props: ToolbarButtonProps) => ReactNode;
export const TOOLBAR_SIZES: { BUTTON: number; CUSTOM: number; DIVIDER: number; GAP: number };

export const ColorSelector: (props: {
    icon: React.ComponentType<{ size?: number }>;
    title: string;
    activeColor?: string;
    onChange: (color: string) => void;
    onRemove: () => void;
    presets: string[];
    variant?: 'text' | 'highlight';
}) => ReactNode;

export const FontSizeSelector: (props: { editor: Editor | null }) => ReactNode;
export const LinkSelector: (props: { editor: Editor | null }) => ReactNode;

export interface ResponsiveToolbarProps {
    editor: Editor | null;
    onHistoryUndo?: () => void;
    onHistoryRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onShowMetadataModal?: () => void;
    hasMetadata?: boolean;
    showMetadataActive?: boolean;
    onShowMediaLibrary?: () => void;
    onAddYoutube?: () => void;
    toolbarConfig?: string[];
    onToolbarConfigChange?: (newConfig: string[]) => void;
    bubbleMenuConfig?: string[];
    onBubbleMenuConfigChange?: (newConfig: string[]) => void;
    toolbarPresets?: Record<string, string[]>;
    bubbleMenuPresets?: Record<string, string[]>;
    toolbarPresetLabels?: Record<string, string>;
    presetsMode?: 'replace' | 'merge';
    customizerContainer?: HTMLElement | null;
}
export const ResponsiveToolbar: (props: ResponsiveToolbarProps) => ReactNode;

export const ToolbarDropdown: (props: {
    items?: Array<{ id: string; label?: string; icon?: React.ComponentType<{ size?: number }>; onClick?: () => void }>;
    title?: string;
    activeId?: string;
}) => ReactNode;

export interface ToolbarCustomizerProps {
    currentConfig?: string[];
    onSave: (config: string[]) => void;
    onClose: () => void;
    currentBubbleConfig?: string[];
    onSaveBubble?: (config: string[]) => void;
    toolbarPresets?: Record<string, string[]>;
    bubbleMenuPresets?: Record<string, string[]>;
    toolbarPresetLabels?: Record<string, string>;
    presetsMode?: 'replace' | 'merge';
    /** Render into + scope to this element (absolute) instead of the viewport (fixed). */
    container?: HTMLElement | null;
}
export const ToolbarCustomizer: (props: ToolbarCustomizerProps) => ReactNode;

export interface LibraryImage {
    url: string;
    name: string;
}
export const ImageSelectorModal: (props: {
    isOpen: boolean;
    onClose: () => void;
    images: LibraryImage[];
    onSelect: (url: string) => void;
    onUpload: (file: File) => Promise<void>;
}) => ReactNode;

export interface YoutubeSearchResult {
    url: string;
    title: string;
    thumbnail: string;
    uploaderName?: string;
    duration?: number;
    views?: number;
}
export const YoutubeEmbedModal: (props: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (id: string) => void;
    onSearch?: (query: string) => Promise<YoutubeSearchResult[]>;
}) => ReactNode;

export const HistoryView: (props: {
    history: HistoryEntry[];
    originalHtml: string;
    originalTitle: string;
    originalTags?: string[];
    originalCategories?: string[];
    current: string;
    currentIndex: number;
    onSelect: (index: number) => void;
}) => ReactNode;

export const DocumentOutline: (props: { editor: Editor | null }) => ReactNode;
export const MiniMap: (props: {
    editor: Editor | null;
    /** CSS width for the expanded panel (default 9rem); applied as an inline style. */
    width?: string;
    /** Extra classes appended to the root, e.g. `border-l-0` to drop the built-in border. */
    className?: string;
    /** Render readable heading labels at their true positions (default true).
     *  When false, headings collapse to level ticks only. */
    showHeadingText?: boolean;
}) => ReactNode;
export const BibliographyPanel: (props: { editor: Editor | null }) => ReactNode;
export const TextBubbleMenu: (props: { editor: Editor | null; isReadonly?: boolean; bubbleMenuConfig?: string[] }) => ReactNode;
export const TableBubbleMenu: (props: { editor: Editor | null; isReadonly?: boolean }) => ReactNode;
export const ImageBubbleMenu: (props: { editor: Editor | null; isReadonly?: boolean }) => ReactNode;
export const YoutubeBubbleMenu: (props: { editor: Editor | null; isReadonly?: boolean; onOpenExternal?: (url: string) => void }) => ReactNode;
export const EmbedBubbleMenu: (props: { editor: Editor | null; isReadonly?: boolean; onOpenExternal?: (url: string) => void }) => ReactNode;
/** Compact, editable URL/source field used inside bubble menus (see + replace a node's source). */
export const SourceField: (props: {
    value?: string;
    onApply: (value: string) => void;
    validate?: (value: string) => boolean;
    placeholder?: string;
    label?: string;
    icon?: ReactNode;
    inputClassName?: string;
}) => ReactNode;
