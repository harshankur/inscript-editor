import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AlignCenter, AlignJustify, AlignLeft, AlignRight,
    Bold, ChevronsRight, Code, SquareCode, Minus, RemoveFormatting, Heading1, Heading2, Heading3,
    Highlighter, Image as ImageIcon, Italic, List, ListOrdered,
    Palette, Quote, Redo, Strikethrough,
    Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
    Tag, Underline as UnderlineIcon, Undo,
    Youtube as YoutubeIcon, Table as TableIcon,
    SquareCheck, BookType, MessageSquareQuote, Link2, Workflow, Sigma, BookOpen,
    Info, Lightbulb, CircleAlert, TriangleAlert, OctagonAlert, TextSelect,
    SlidersHorizontal,
} from 'lucide-react';
import { ToolbarButton, TOOLBAR_SIZES } from './ToolbarButton.jsx';
import { ToolbarDropdown } from './ToolbarDropdown.jsx';
import { ToolbarCustomizer } from './ToolbarCustomizer.jsx';
import { ColorSelector } from './ColorSelector.jsx';
import { FontSizeSelector } from './FontSizeSelector.jsx';
import { LinkSelector } from './LinkSelector.jsx';
import { useInscriptEditorTranslations } from '../hooks/useInscriptEditorTranslations.js';
import { DIVIDER } from '../toolbar/toolRegistry.js';
import { TOOLBAR_PRESETS } from '../toolbar/presets.js';

// Width of a ToolbarDropdown (primary btn + divider + chevron)
const DROPDOWN_WIDTH = TOOLBAR_SIZES.BUTTON + 14 + 1;

/**
 * Builds the full map of tool ID → tool slot descriptor.
 * This needs the editor instance + callbacks, so it's a function not a constant.
 */
function buildToolMap(editor, { onHistoryUndo, onHistoryRedo, canUndo, canRedo, onShowMetadataModal, hasMetadata, showMetadataActive, onShowMediaLibrary, onAddYoutube, t }) {
    return {
        undo: { id: 'undo', icon: Undo, action: onHistoryUndo, disabled: !canUndo, title: t('undo', 'Undo') },
        redo: { id: 'redo', icon: Redo, action: onHistoryRedo, disabled: !canRedo, title: t('redo', 'Redo') },

        // Structure
        h1: { id: 'h1', icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }), title: t('heading1', 'Heading 1') },
        h2: { id: 'h2', icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), title: t('heading2', 'Heading 2') },
        h3: { id: 'h3', icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }), title: t('heading3', 'Heading 3') },

        // Inline formatting
        bold:        { id: 'bold',        icon: Bold,             action: () => editor.chain().focus().toggleBold().run(),         active: editor.isActive('bold'),         title: t('bold', 'Bold') },
        italic:      { id: 'italic',      icon: Italic,           action: () => editor.chain().focus().toggleItalic().run(),       active: editor.isActive('italic'),       title: t('italic', 'Italic') },
        underline:   { id: 'underline',   icon: UnderlineIcon,    action: () => editor.chain().focus().toggleUnderline().run(),    active: editor.isActive('underline'),    title: t('underline', 'Underline') },
        strike:      { id: 'strike',      icon: Strikethrough,    action: () => editor.chain().focus().toggleStrike().run(),       active: editor.isActive('strike'),       title: t('strike', 'Strikethrough') },
        inlineCode:  { id: 'inlineCode',  icon: Code,             action: () => editor.chain().focus().toggleCode().run(),         active: editor.isActive('code'),         title: t('inlineCode', 'Inline Code') },
        sub:         { id: 'sub',         icon: SubscriptIcon,    action: () => editor.chain().focus().toggleSubscript().run(),    active: editor.isActive('subscript'),    title: t('subscript', 'Subscript') },
        sup:         { id: 'sup',         icon: SuperscriptIcon,  action: () => editor.chain().focus().toggleSuperscript().run(),  active: editor.isActive('superscript'),  title: t('superscript', 'Superscript') },
        abbreviation:{ id: 'abbreviation',icon: TextSelect,       action: () => editor.chain().focus().setAbbreviation().run(),    active: editor.isActive('abbreviation'), title: t('abbreviation', 'Abbreviation') },
        clearFormat: { id: 'clearFormat', icon: RemoveFormatting, action: () => editor.chain().focus().unsetAllMarks().clearNodes().run(), title: t('clearFormat', 'Clear Formatting') },

        // Styling — these are custom-rendered, so we mark them
        fontSize: {
            id: 'fontSize', type: 'custom',
            width: TOOLBAR_SIZES.CUSTOM,
            render: () => <FontSizeSelector editor={editor} />
        },
        highlight: {
            id: 'highlight', type: 'custom',
            width: TOOLBAR_SIZES.CUSTOM,
            render: () => (
                <ColorSelector
                    icon={Highlighter}
                    title={t('highlightColor', 'Highlight Color')}
                    activeColor={editor?.getAttributes('highlight').color}
                    onChange={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
                    onRemove={() => editor.chain().focus().unsetHighlight().run()}
                    presets={['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff', '#fed7aa', '#fecaca']}
                    variant="highlight"
                />
            )
        },
        color: {
            id: 'color', type: 'custom',
            width: TOOLBAR_SIZES.CUSTOM,
            render: () => (
                <ColorSelector
                    icon={Palette}
                    title={t('textColor', 'Text Color')}
                    activeColor={editor?.getAttributes('textStyle').color}
                    onChange={(color) => editor.chain().focus().setColor(color).run()}
                    onRemove={() => editor.chain().focus().unsetColor().run()}
                    presets={['#000000', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#71717a']}
                    variant="text"
                />
            )
        },

        // Links & references
        link: {
            id: 'link', type: 'custom',
            width: TOOLBAR_SIZES.CUSTOM,
            render: () => <LinkSelector editor={editor} />
        },
        wikilink: {
            id: 'wikilink', icon: Link2,
            action: () => {
                const target = window.prompt(t('wikilinkPrompt', 'Enter wiki page name:'));
                if (target) editor.chain().focus().insertWikilink({ target, alias: target }).run();
            },
            title: t('insertWikilink', 'Wikilink')
        },
        footnote: { id: 'footnote', icon: MessageSquareQuote, action: () => editor.chain().focus().insertFootnote().run(), title: t('footnote', 'Footnote') },
        citation: {
            id: 'citation',
            icon: BookOpen,
            action: () => {
                const key = window.prompt(t('citationKeyPrompt', 'Enter citation key (e.g. author2026):'));
                if (key) {
                    const label = window.prompt(t('citationLabelPrompt', 'Enter inline label (e.g. Author, 2026):'), key);
                    const title = window.prompt(t('citationTitlePrompt', 'Enter bibliography entry details:'), '');
                    editor.chain().focus().insertCitation({ key, label: label || key, title: title || '' }).run();
                }
            },
            title: t('citation', 'Citation')
        },

        // Lists
        bullet:     { id: 'bullet',     icon: List,          action: () => editor.chain().focus().toggleBulletList().run(),      active: editor.isActive('bulletList'),    title: t('bulletList', 'Bullet List') },
        ordered:    { id: 'ordered',    icon: ListOrdered,   action: () => editor.chain().focus().toggleOrderedList().run(),     active: editor.isActive('orderedList'),   title: t('orderedList', 'Numbered List') },
        task:       { id: 'task',       icon: SquareCheck,   action: () => editor.chain().focus().toggleTaskList().run(),        active: editor.isActive('taskList'),      title: t('taskList', 'Task List') },
        definition: { id: 'definition', icon: BookType,      action: () => editor.chain().focus().toggleDefinitionList().run(),  active: editor.isActive('definitionList'),title: t('definitionList', 'Definition List') },

        // Alignment dropdown
        align: {
            id: 'align', type: 'dropdown',
            width: DROPDOWN_WIDTH,
            activeId: editor.isActive({ textAlign: 'center' }) ? 'center'
                : editor.isActive({ textAlign: 'right' }) ? 'right'
                    : editor.isActive({ textAlign: 'justify' }) ? 'justify'
                        : 'left',
            title: t('textAlign', 'Text Alignment'),
            items: [
                { id: 'left',    icon: AlignLeft,    label: t('alignLeft', 'Align Left'),     action: () => editor.chain().focus().setTextAlign('left').run(),    active: editor.isActive({ textAlign: 'left' }) },
                { id: 'center',  icon: AlignCenter,  label: t('alignCenter', 'Align Center'), action: () => editor.chain().focus().setTextAlign('center').run(),  active: editor.isActive({ textAlign: 'center' }) },
                { id: 'right',   icon: AlignRight,   label: t('alignRight', 'Align Right'),   action: () => editor.chain().focus().setTextAlign('right').run(),   active: editor.isActive({ textAlign: 'right' }) },
                { id: 'justify', icon: AlignJustify, label: t('alignJustify', 'Justify'),     action: () => editor.chain().focus().setTextAlign('justify').run(), active: editor.isActive({ textAlign: 'justify' }) },
            ]
        },

        // Blocks
        code:  { id: 'code',  icon: SquareCode, action: () => editor.chain().focus().toggleCodeBlock().run(),  active: editor.isActive('codeBlock'),  title: t('codeBlock', 'Code Block') },
        quote: { id: 'quote', icon: Quote,      action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), title: t('quote', 'Quote') },
        hr:    { id: 'hr',    icon: Minus,      action: () => editor.chain().focus().setHorizontalRule().run(), title: t('horizontalRule', 'Divider') },

        // Admonitions dropdown
        admonitions: {
            id: 'admonitions', type: 'dropdown',
            width: DROPDOWN_WIDTH,
            activeId: editor.isActive('admonition', { type: 'tip' }) ? 'admonitionTip'
                : editor.isActive('admonition', { type: 'important' }) ? 'admonitionImportant'
                    : editor.isActive('admonition', { type: 'warning' }) ? 'admonitionWarning'
                        : editor.isActive('admonition', { type: 'caution' }) ? 'admonitionCaution'
                            : editor.isActive('admonition') ? 'admonitionNote'
                                : null,
            title: t('admonitions', 'Admonitions'),
            items: [
                { id: 'admonitionNote',      icon: Info,          label: t('admonitionNote', 'Note'),           action: () => editor.chain().focus().setAdmonition('note').run(),      active: editor.isActive('admonition', { type: 'note' }) },
                { id: 'admonitionTip',       icon: Lightbulb,     label: t('admonitionTip', 'Tip'),             action: () => editor.chain().focus().setAdmonition('tip').run(),       active: editor.isActive('admonition', { type: 'tip' }) },
                { id: 'admonitionImportant', icon: CircleAlert,   label: t('admonitionImportant', 'Important'), action: () => editor.chain().focus().setAdmonition('important').run(), active: editor.isActive('admonition', { type: 'important' }) },
                { id: 'admonitionWarning',   icon: TriangleAlert, label: t('admonitionWarning', 'Warning'),     action: () => editor.chain().focus().setAdmonition('warning').run(),   active: editor.isActive('admonition', { type: 'warning' }) },
                { id: 'admonitionCaution',   icon: OctagonAlert,  label: t('admonitionCaution', 'Caution'),     action: () => editor.chain().focus().setAdmonition('caution').run(),   active: editor.isActive('admonition', { type: 'caution' }) },
            ]
        },

        // Advanced blocks
        math:    { id: 'math',    icon: Sigma,    action: () => editor.chain().focus().insertContent({ type: 'mathBlock' }).run(), active: editor.isActive('mathBlock'), title: t('slash.math', 'Math Block') },
        mermaid: { id: 'mermaid', icon: Workflow, action: () => editor.chain().focus().insertContent({ type: 'mermaid' }).run(),   active: editor.isActive('mermaid'),   title: t('slash.mermaid', 'Mermaid Diagram') },

        // Media & metadata
        image: { id: 'image', icon: ImageIcon,  action: onShowMediaLibrary, title: t('insertImage', 'Insert Image') },
        youtube: { id: 'youtube', icon: YoutubeIcon, action: onAddYoutube, title: t('embedYoutube', 'Embed YouTube Video') },
        table: { id: 'table', icon: TableIcon, action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), title: t('insertTable', 'Insert Table') },
        tags: {
            id: 'tags', type: 'custom',
            width: TOOLBAR_SIZES.CUSTOM,
            render: () => (
                <ToolbarButton onClick={onShowMetadataModal} active={showMetadataActive} title={t('manageMetadata', 'Manage Tags & Categories')} width={TOOLBAR_SIZES.CUSTOM}>
                    <div className="relative flex items-center justify-center">
                        <Tag size={18} />
                        {hasMetadata && <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />}
                    </div>
                </ToolbarButton>
            )
        },
    };
}

/**
 * Converts a serializable config array (IDs + '|' dividers) into renderable tool slots.
 * Unknown IDs are silently skipped.
 */
function configToSlots(config, toolMap) {
    return config.flatMap((entry, idx) => {
        if (entry === DIVIDER) return [{ type: 'divider', _key: `div-${idx}` }];
        const tool = toolMap[entry];
        if (!tool) return [];
        return [tool];
    });
}

/**
 * ResponsiveToolbar — renders the editor toolbar.
 *
 * Props:
 *   toolbarConfig          – Optional serializable config (array of tool IDs + '|' dividers).
 *                            If omitted, defaults to TOOLBAR_PRESETS.full.
 *   onToolbarConfigChange  – Optional. When provided, a settings ⚙ button appears at the far
 *                            right of the toolbar. Clicking it opens the ToolbarCustomizer drawer.
 *                            Called with the new config array when the user saves.
 *                            The CONSUMER is responsible for persisting and passing back the config.
 */
export const ResponsiveToolbar = ({ editor, onHistoryUndo, onHistoryRedo, canUndo, canRedo, onShowMetadataModal, hasMetadata, showMetadataActive, onShowMediaLibrary, onAddYoutube, toolbarConfig, onToolbarConfigChange, bubbleMenuConfig, onBubbleMenuConfigChange, toolbarPresets, bubbleMenuPresets, toolbarPresetLabels, presetsMode, customizerContainer }) => {
    useInscriptEditorTranslations();
    const { t } = useTranslation('inscript-editor');
    const containerRef = useRef(null);
    const [visibleCount, setVisibleCount] = useState(100);
    const [showMore, setShowMore] = useState(false);
    const [customizerOpen, setCustomizerOpen] = useState(false);

    const activeConfig = toolbarConfig ?? TOOLBAR_PRESETS.full;

    const tools = useMemo(() => {
        if (!editor) return [];
        const toolMap = buildToolMap(editor, {
            onHistoryUndo, onHistoryRedo, canUndo, canRedo,
            onShowMetadataModal, hasMetadata, showMetadataActive,
            onShowMediaLibrary, onAddYoutube, t
        });
        return configToSlots(activeConfig, toolMap);
    }, [editor, onHistoryUndo, onHistoryRedo, canUndo, canRedo, onShowMetadataModal, hasMetadata, showMetadataActive, onShowMediaLibrary, onAddYoutube, t, activeConfig]);

    // Mirror `tools` into a ref so the resize handler always reads the latest list.
    const toolsRef = useRef(tools);

    // Precise fit logic using source-of-truth widths. The settings gear (when present) is
    // always on the right; the ">>" overflow button is only reserved when tools actually
    // overflow — reserving it unconditionally would collapse ~one tool too early, leaving a
    // phantom ">>" with empty space beside it.
    const gearReserve = onToolbarConfigChange ? TOOLBAR_SIZES.BUTTON + TOOLBAR_SIZES.GAP : 0;
    const moreReserve = TOOLBAR_SIZES.BUTTON + TOOLBAR_SIZES.GAP;
    const recomputeVisible = useCallback(() => {
        if (!containerRef.current) return;
        const currentTools = toolsRef.current;
        const total = containerRef.current.clientWidth;
        const widthOf = (tool) => tool.type === 'divider' ? TOOLBAR_SIZES.DIVIDER : (tool.width || TOOLBAR_SIZES.BUTTON);
        const fitCount = (available) => {
            let used = 0;
            let n = 0;
            for (const tool of currentTools) {
                const w = widthOf(tool) + TOOLBAR_SIZES.GAP;
                if (used + w > available) break;
                used += w;
                n++;
            }
            return n;
        };
        // First see if EVERYTHING fits with only the gear reserved (no overflow button).
        if (fitCount(total - gearReserve) >= currentTools.length) {
            setVisibleCount(currentTools.length);
            return;
        }
        // It doesn't — a ">>" is needed, so reserve its width too and recount.
        setVisibleCount(Math.max(2, fitCount(total - gearReserve - moreReserve)));
    }, [gearReserve, moreReserve]);

    // Recompute whenever the TOOL SET changes (e.g. switching presets), not only on resize.
    // A preset swap changes the number of tools with no resize event, so without this the
    // count stays stale — leaving a phantom ">>" with empty space beside it.
    useEffect(() => {
        toolsRef.current = tools;
        recomputeVisible();
    }, [tools, recomputeVisible]);

    // Recompute on container/window resize. Depends on `editor` so the ResizeObserver
    // attaches once the toolbar container actually mounts (editor can be null on first render).
    useEffect(() => {
        recomputeVisible();
        window.addEventListener('resize', recomputeVisible);
        const observer = new ResizeObserver(recomputeVisible);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => { window.removeEventListener('resize', recomputeVisible); observer.disconnect(); };
    }, [recomputeVisible, editor]);

    if (!editor) return null;

    const visibleTools = tools.slice(0, visibleCount);
    const overflowTools = tools.slice(visibleCount);

    const renderTool = (tool, idx) => {
        if (tool.type === 'divider') {
            return (
                <div key={tool._key ?? idx} style={{ width: `${TOOLBAR_SIZES.DIVIDER}px` }} className="h-6 flex items-center justify-center shrink-0">
                    <div className="w-px h-full bg-zinc-100 dark:bg-zinc-800" />
                </div>
            );
        }
        if (tool.type === 'custom') return <Fragment key={tool.id}>{tool.render()}</Fragment>;
        if (tool.type === 'dropdown') return <ToolbarDropdown key={tool.id} items={tool.items} title={tool.title} activeId={tool.activeId} />;

        const Icon = tool.icon;
        if (!Icon) return null;
        return (
            <ToolbarButton key={tool.id} onClick={tool.action} active={tool.active} disabled={tool.disabled} title={tool.title}>
                <Icon size={18} />
            </ToolbarButton>
        );
    };

    return (
        <>
            <div ref={containerRef} className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1 bg-zinc-50 dark:bg-zinc-900/20 w-full relative">
                {visibleTools.map((tool, i) => renderTool(tool, i))}

                {/* Right-side cluster: overflow >> and optional settings gear */}
                <div className="ml-auto flex items-center gap-1 shrink-0">
                    {overflowTools.length > 0 && (
                        <div className="relative">
                            <button
                                onClick={() => setShowMore(!showMore)}
                                style={{ width: `${TOOLBAR_SIZES.BUTTON}px`, height: `${TOOLBAR_SIZES.BUTTON}px` }}
                                className={`flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors shrink-0 ${showMore ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : ''}`}
                                title={t('moreTools', 'More tools')}
                            >
                                <ChevronsRight size={18} />
                            </button>
                            {showMore && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
                                    <div className="absolute right-0 top-full mt-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-xl p-2 z-[60] flex flex-col gap-1 min-w-[150px]">
                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                            {overflowTools.map((tool, i) => renderTool(tool, i))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Settings gear — only rendered when consumer opts in via onToolbarConfigChange */}
                    {onToolbarConfigChange && (
                        <button
                            onClick={() => setCustomizerOpen(true)}
                            style={{ width: `${TOOLBAR_SIZES.BUTTON}px`, height: `${TOOLBAR_SIZES.BUTTON}px` }}
                            className={`flex items-center justify-center rounded transition-colors shrink-0 ${
                                customizerOpen
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                                    : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200'
                            }`}
                            title={t('customizeToolbar', 'Customize toolbar')}
                        >
                            <SlidersHorizontal size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Toolbar customizer drawer — portal-like, rendered outside the toolbar div */}
            {customizerOpen && onToolbarConfigChange && (
                <ToolbarCustomizer
                    currentConfig={toolbarConfig ?? TOOLBAR_PRESETS.full}
                    onSave={(newConfig) => onToolbarConfigChange(newConfig)}
                    currentBubbleConfig={bubbleMenuConfig}
                    onSaveBubble={onBubbleMenuConfigChange}
                    toolbarPresets={toolbarPresets}
                    bubbleMenuPresets={bubbleMenuPresets}
                    toolbarPresetLabels={toolbarPresetLabels}
                    presetsMode={presetsMode}
                    container={customizerContainer}
                    onClose={() => setCustomizerOpen(false)}
                />
            )}
        </>
    );
};
