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
    ref?: Ref<InscriptEditorRefHandle>;
}

export const InscriptEditor: (props: InscriptEditorProps) => ReactNode;

// --- Extensions ---
export const Youtube: import('@tiptap/core').Node;
export const FontSize: import('@tiptap/core').Mark;
export const CustomTable: import('@tiptap/core').Node;
export const CustomImage: import('@tiptap/core').Node;

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
}
export const ResponsiveToolbar: (props: ResponsiveToolbarProps) => ReactNode;

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

export const TextBubbleMenu: (props: { editor: Editor | null; isReadonly?: boolean }) => ReactNode;
export const TableBubbleMenu: (props: { editor: Editor | null; isReadonly?: boolean }) => ReactNode;
export const ImageBubbleMenu: (props: { editor: Editor | null; isReadonly?: boolean }) => ReactNode;
export const YoutubeBubbleMenu: (props: { editor: Editor | null; isReadonly?: boolean }) => ReactNode;
