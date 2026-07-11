import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AlignCenter, AlignJustify, AlignLeft, AlignRight,
    Bold, ChevronsRight, Code, Heading1, Heading2, Heading3, Pilcrow,
    Highlighter, Image as ImageIcon, Italic, List, ListOrdered,
    Palette, Quote, Redo, Strikethrough,
    Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
    Tag, Underline as UnderlineIcon, Undo,
    Youtube as YoutubeIcon, Table as TableIcon,
    SquareCheck, BookType, MessageSquareQuote, Link2, Workflow, Sigma,
    Info, Lightbulb, CircleAlert, TriangleAlert, OctagonAlert, TextSelect,
} from 'lucide-react';
import { ToolbarButton, TOOLBAR_SIZES } from './ToolbarButton.jsx';
import { ToolbarDropdown } from './ToolbarDropdown.jsx';
import { ColorSelector } from './ColorSelector.jsx';
import { FontSizeSelector } from './FontSizeSelector.jsx';
import { LinkSelector } from './LinkSelector.jsx';
import { useInscriptEditorTranslations } from '../hooks/useInscriptEditorTranslations.js';

// Width of a ToolbarDropdown (primary btn + divider + chevron)
const DROPDOWN_WIDTH = TOOLBAR_SIZES.BUTTON + 14 + 1;

export const ResponsiveToolbar = ({ editor, onHistoryUndo, onHistoryRedo, canUndo, canRedo, onShowMetadataModal, hasMetadata, showMetadataActive, onShowMediaLibrary, onAddYoutube }) => {
    useInscriptEditorTranslations();
    const { t } = useTranslation('inscript-editor');
    const containerRef = useRef(null);
    const [visibleCount, setVisibleCount] = useState(100);
    const [showMore, setShowMore] = useState(false);

    // Tools Configuration
    const tools = useMemo(() => (!editor ? [] : [
        // ── History ───────────────────────────────────────────────────────────
        { id: 'undo', icon: Undo, action: onHistoryUndo, disabled: !canUndo, title: t('undo', 'Undo') },
        { id: 'redo', icon: Redo, action: onHistoryRedo, disabled: !canRedo, title: t('redo', 'Redo') },

        { type: 'divider' },

        // ── Headings (split dropdown: paragraph, H1, H2, H3) ─────────────────
        {
            id: 'headings', type: 'dropdown',
            width: DROPDOWN_WIDTH,
            activeId: editor.isActive('heading', { level: 1 }) ? 'h1'
                : editor.isActive('heading', { level: 2 }) ? 'h2'
                    : editor.isActive('heading', { level: 3 }) ? 'h3'
                        : 'paragraph',
            title: t('headings', 'Heading'),
            items: [
                { id: 'paragraph', icon: Pilcrow, label: t('paragraph', 'Paragraph'), action: () => editor.chain().focus().setParagraph().run(), active: !editor.isActive('heading') },
                { id: 'h1', icon: Heading1, label: t('heading1', 'Heading 1'), action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
                { id: 'h2', icon: Heading2, label: t('heading2', 'Heading 2'), action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
                { id: 'h3', icon: Heading3, label: t('heading3', 'Heading 3'), action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
            ]
        },

        { type: 'divider' },

        // ── Inline formatting ─────────────────────────────────────────────────
        { id: 'bold', icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor?.isActive('bold'), title: t('bold', 'Bold') },
        { id: 'italic', icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor?.isActive('italic'), title: t('italic', 'Italic') },
        { id: 'underline', icon: UnderlineIcon, action: () => editor.chain().focus().toggleUnderline().run(), active: editor?.isActive('underline'), title: t('underline', 'Underline') },
        { id: 'strike', icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor?.isActive('strike'), title: t('strike', 'Strikethrough') },
        { id: 'sub', icon: SubscriptIcon, action: () => editor.chain().focus().toggleSubscript().run(), active: editor?.isActive('subscript'), title: t('subscript', 'Subscript') },
        { id: 'sup', icon: SuperscriptIcon, action: () => editor.chain().focus().toggleSuperscript().run(), active: editor?.isActive('superscript'), title: t('superscript', 'Superscript') },
        { id: 'abbreviation', icon: TextSelect, action: () => editor.chain().focus().setAbbreviation().run(), active: editor?.isActive('abbreviation'), title: t('abbreviation', 'Abbreviation') },

        { type: 'divider' },

        // ── Styling ───────────────────────────────────────────────────────────
        {
            id: 'fontSize', type: 'custom', render: () => (
                <FontSizeSelector editor={editor} />
            )
        },
        {
            id: 'highlight', type: 'custom', render: () => (
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
        {
            id: 'color', type: 'custom', render: () => (
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

        { type: 'divider' },

        // ── Links & references ────────────────────────────────────────────────
        {
            id: 'link', type: 'custom', render: () => (
                <LinkSelector editor={editor} />
            )
        },
        {
            id: 'wikilink', icon: Link2,
            action: () => {
                const target = window.prompt(t('wikilinkPrompt', 'Enter wiki page name:'));
                if (target) editor.chain().focus().insertWikilink({ target, alias: target }).run();
            },
            title: t('insertWikilink', 'Wikilink')
        },
        { id: 'footnote', icon: MessageSquareQuote, action: () => editor.chain().focus().insertFootnote().run(), title: t('footnote', 'Footnote') },

        { type: 'divider' },

        // ── Lists ─────────────────────────────────────────────────────────────
        { id: 'bullet', icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList'), title: t('bulletList', 'Bullet List') },
        { id: 'ordered', icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList'), title: t('orderedList', 'Numbered List') },
        { id: 'task', icon: SquareCheck, action: () => editor.chain().focus().toggleTaskList().run(), active: editor?.isActive('taskList'), title: t('taskList', 'Task List') },
        { id: 'definition', icon: BookType, action: () => editor.chain().focus().toggleDefinitionList().run(), active: editor?.isActive('definitionList'), title: t('definitionList', 'Definition List') },

        { type: 'divider' },

        // ── Alignment (split dropdown) ────────────────────────────────────────
        {
            id: 'align', type: 'dropdown',
            width: DROPDOWN_WIDTH,
            activeId: editor.isActive({ textAlign: 'center' }) ? 'center'
                : editor.isActive({ textAlign: 'right' }) ? 'right'
                    : editor.isActive({ textAlign: 'justify' }) ? 'justify'
                        : 'left',
            title: t('textAlign', 'Text Alignment'),
            items: [
                { id: 'left', icon: AlignLeft, label: t('alignLeft', 'Align Left'), action: () => editor.chain().focus().setTextAlign('left').run(), active: editor.isActive({ textAlign: 'left' }) },
                { id: 'center', icon: AlignCenter, label: t('alignCenter', 'Align Center'), action: () => editor.chain().focus().setTextAlign('center').run(), active: editor.isActive({ textAlign: 'center' }) },
                { id: 'right', icon: AlignRight, label: t('alignRight', 'Align Right'), action: () => editor.chain().focus().setTextAlign('right').run(), active: editor.isActive({ textAlign: 'right' }) },
                { id: 'justify', icon: AlignJustify, label: t('alignJustify', 'Justify'), action: () => editor.chain().focus().setTextAlign('justify').run(), active: editor.isActive({ textAlign: 'justify' }) },
            ]
        },

        { type: 'divider' },

        // ── Blocks ────────────────────────────────────────────────────────────
        { id: 'code', icon: Code, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor?.isActive('codeBlock'), title: t('codeBlock', 'Code Block') },
        { id: 'quote', icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor?.isActive('blockquote'), title: t('quote', 'Quote') },

        { type: 'divider' },

        // ── Admonitions (split dropdown) ──────────────────────────────────────
        {
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
                { id: 'admonitionNote', icon: Info, label: t('admonitionNote', 'Note'), action: () => editor.chain().focus().setAdmonition('note').run(), active: editor.isActive('admonition', { type: 'note' }) },
                { id: 'admonitionTip', icon: Lightbulb, label: t('admonitionTip', 'Tip'), action: () => editor.chain().focus().setAdmonition('tip').run(), active: editor.isActive('admonition', { type: 'tip' }) },
                { id: 'admonitionImportant', icon: CircleAlert, label: t('admonitionImportant', 'Important'), action: () => editor.chain().focus().setAdmonition('important').run(), active: editor.isActive('admonition', { type: 'important' }) },
                { id: 'admonitionWarning', icon: TriangleAlert, label: t('admonitionWarning', 'Warning'), action: () => editor.chain().focus().setAdmonition('warning').run(), active: editor.isActive('admonition', { type: 'warning' }) },
                { id: 'admonitionCaution', icon: OctagonAlert, label: t('admonitionCaution', 'Caution'), action: () => editor.chain().focus().setAdmonition('caution').run(), active: editor.isActive('admonition', { type: 'caution' }) },
            ]
        },

        { type: 'divider' },

        // ── Advanced blocks ───────────────────────────────────────────────────
        { id: 'math', icon: Sigma, action: () => editor.chain().focus().insertContent({ type: 'mathBlock' }).run(), active: editor?.isActive('mathBlock'), title: t('slash.math', 'Math Block') },
        { id: 'mermaid', icon: Workflow, action: () => editor.chain().focus().insertContent({ type: 'mermaid' }).run(), active: editor?.isActive('mermaid'), title: t('slash.mermaid', 'Mermaid Diagram') },

        { type: 'divider' },

        // ── Media & metadata ──────────────────────────────────────────────────
        { id: 'image', icon: ImageIcon, action: onShowMediaLibrary, title: t('insertImage', 'Insert Image') },
        { id: 'youtube', icon: YoutubeIcon, action: onAddYoutube, title: t('embedYoutube', 'Embed YouTube Video') },
        { id: 'table', icon: TableIcon, action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), title: t('insertTable', 'Insert Table') },
        {
            id: 'tags', type: 'custom', render: () => (
                <ToolbarButton onClick={onShowMetadataModal} active={showMetadataActive} title={t('manageMetadata', 'Manage Tags & Categories')} width={TOOLBAR_SIZES.CUSTOM}>
                    <div className="relative flex items-center justify-center">
                        <Tag size={18} />
                        {hasMetadata && <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />}
                    </div>
                </ToolbarButton>
            )
        },
    ]), [editor, onHistoryUndo, onHistoryRedo, canUndo, canRedo, onShowMetadataModal, hasMetadata, showMetadataActive, onShowMediaLibrary, onAddYoutube, t]);

    // Mirror `tools` into a ref so the resize handler (registered once, deps: [])
    // always reads the latest tool list instead of closing over a stale one.
    const toolsRef = useRef(tools);
    useEffect(() => { toolsRef.current = tools; }, [tools]);

    // Precise resize logic using source of truth widths
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                const currentTools = toolsRef.current;
                const containerWidth = containerRef.current.clientWidth - 50; // Reserve space for "More" button
                let currentTotal = 0;
                let count = 0;

                for (let i = 0; i < currentTools.length; i++) {
                    const tool = currentTools[i];
                    let toolWidth = 0;
                    if (tool.type === 'divider') toolWidth = TOOLBAR_SIZES.DIVIDER;
                    else if (tool.type === 'dropdown') toolWidth = tool.width ?? DROPDOWN_WIDTH;
                    else if (tool.type === 'custom') toolWidth = TOOLBAR_SIZES.CUSTOM;
                    else toolWidth = TOOLBAR_SIZES.BUTTON;

                    if (currentTotal + toolWidth + TOOLBAR_SIZES.GAP > containerWidth) {
                        break;
                    }
                    currentTotal += toolWidth + TOOLBAR_SIZES.GAP;
                    count++;
                }

                setVisibleCount(Math.max(2, count));
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        const observer = new ResizeObserver(handleResize);
        if (containerRef.current) observer.observe(containerRef.current);

        return () => {
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        }
    }, []);

    if (!editor) return null;

    const visibleTools = tools.slice(0, visibleCount);
    const overflowTools = tools.slice(visibleCount);

    const renderTool = (tool, idx) => {
        if (tool.type === 'divider') return <div key={idx} style={{ width: `${TOOLBAR_SIZES.DIVIDER}px` }} className="h-6 flex items-center justify-center shrink-0"><div className="w-px h-full bg-zinc-100 dark:bg-zinc-800" /></div>;
        if (tool.type === 'custom') return <Fragment key={tool.id}>{tool.render()}</Fragment>;
        if (tool.type === 'dropdown') return (
            <ToolbarDropdown
                key={tool.id}
                items={tool.items}
                title={tool.title}
                activeId={tool.activeId}
            />
        );

        const Icon = tool.icon;
        if (!Icon) return null;

        return (
            <ToolbarButton
                key={tool.id}
                onClick={tool.action}
                active={tool.active}
                disabled={tool.disabled}
                title={tool.title}
            >
                <Icon size={18} />
            </ToolbarButton>
        );
    };

    return (
        <div ref={containerRef} className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1 bg-zinc-50 dark:bg-zinc-900/20 w-full relative">
            {visibleTools.map((t, i) => renderTool(t, i))}

            {overflowTools.length > 0 && (
                <div className="relative ml-auto">
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
                            <div className="absolute right-0 top-full mt-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-xl p-2 z-[60] flex flex-col gap-1 min-w-[150px] animate-in slide-in-from-top-2 fade-in">
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                    {overflowTools.map((t, i) => renderTool(t, i))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
