import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AlignCenter, AlignJustify, AlignLeft, AlignRight,
    Bold, ChevronsRight, Code, Heading1, Heading2,
    Highlighter, Image as ImageIcon, Italic, List, ListOrdered,
    Palette, Quote, Redo, Strikethrough,
    Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
    Tag, Underline as UnderlineIcon, Undo,
    Youtube as YoutubeIcon, Table as TableIcon,
} from 'lucide-react';
import { ToolbarButton, TOOLBAR_SIZES } from './ToolbarButton.jsx';
import { ColorSelector } from './ColorSelector.jsx';
import { FontSizeSelector } from './FontSizeSelector.jsx';
import { LinkSelector } from './LinkSelector.jsx';

export const ResponsiveToolbar = ({ editor, onHistoryUndo, onHistoryRedo, canUndo, canRedo, onShowMetadataModal, hasMetadata, showMetadataActive, onShowMediaLibrary, onAddYoutube }) => {
    const { t } = useTranslation();
    const containerRef = useRef(null);
    const [visibleCount, setVisibleCount] = useState(100);
    const [showMore, setShowMore] = useState(false);

    // Tools Configuration
    const tools = useMemo(() => (!editor ? [] : [
        { id: 'undo', icon: Undo, action: onHistoryUndo, disabled: !canUndo, title: t('undo') },
        { id: 'redo', icon: Redo, action: onHistoryRedo, disabled: !canRedo, title: t('redo') },
        { type: 'divider' },
        { id: 'bold', icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
        { id: 'italic', icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
        { id: 'underline', icon: UnderlineIcon, action: () => editor.chain().focus().toggleUnderline().run(), active: editor?.isActive('underline') },
        { id: 'strike', icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor?.isActive('strike') },
        {
            id: 'link', type: 'custom', render: () => (
                <LinkSelector editor={editor} />
            )
        },
        { type: 'divider' },
        {
            id: 'fontSize', type: 'custom', render: () => (
                <FontSizeSelector editor={editor} />
            )
        },
        {
            id: 'highlight', type: 'custom', render: () => (
                <ColorSelector
                    icon={Highlighter}
                    title={t('highlightColor')}
                    activeColor={editor?.getAttributes('highlight').color}
                    onChange={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
                    onRemove={() => editor.chain().focus().unsetHighlight().run()}
                    presets={['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff', '#fed7aa', '#fecaca']} // Yellow, Green, Blue, Pink, Purple, Orange, Red (Tailwind 200 weights approx)
                    variant="highlight"
                />
            )
        },
        {
            id: 'color', type: 'custom', render: () => (
                <ColorSelector
                    icon={Palette}
                    title={t('textColor')}
                    activeColor={editor?.getAttributes('textStyle').color}
                    onChange={(color) => editor.chain().focus().setColor(color).run()}
                    onRemove={() => editor.chain().focus().unsetColor().run()}
                    presets={['#000000', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#71717a']} // Black, Blue, Red, Green, Amber, Purple, Zinc
                    variant="text"
                />
            )
        },
        { type: 'divider' },
        { id: 'h1', icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor?.isActive('heading', { level: 1 }) },
        { id: 'h2', icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive('heading', { level: 2 }) },
        { id: 'sub', icon: SubscriptIcon, action: () => editor.chain().focus().toggleSubscript().run(), active: editor?.isActive('subscript') },
        { id: 'sup', icon: SuperscriptIcon, action: () => editor.chain().focus().toggleSuperscript().run(), active: editor?.isActive('superscript') },
        { type: 'divider' },
        { id: 'bullet', icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
        { id: 'ordered', icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
        { type: 'divider' },
        { id: 'left', icon: AlignLeft, action: () => editor.chain().focus().setTextAlign('left').run(), active: editor?.isActive({ textAlign: 'left' }) },
        { id: 'center', icon: AlignCenter, action: () => editor.chain().focus().setTextAlign('center').run(), active: editor?.isActive({ textAlign: 'center' }) },
        { id: 'right', icon: AlignRight, action: () => editor.chain().focus().setTextAlign('right').run(), active: editor?.isActive({ textAlign: 'right' }) },
        { id: 'justify', icon: AlignJustify, action: () => editor.chain().focus().setTextAlign('justify').run(), active: editor?.isActive({ textAlign: 'justify' }) },
        { type: 'divider' },
        { id: 'code', icon: Code, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor?.isActive('codeBlock') },
        { id: 'quote', icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor?.isActive('blockquote') },
        { type: 'divider' },
        { id: 'image', icon: ImageIcon, action: onShowMediaLibrary, title: t('insertImage') },
        { id: 'youtube', icon: YoutubeIcon, action: onAddYoutube, title: t('embedYoutube') },
        { id: 'table', icon: TableIcon, action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), title: t('insertTable') },
        {
            id: 'tags', type: 'custom', render: () => (
                <ToolbarButton onClick={onShowMetadataModal} active={showMetadataActive} title={t('manageMetadata')} width={TOOLBAR_SIZES.CUSTOM}>
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
                    else if (tool.type === 'custom') {
                        // Special cases for custom tools if needed, or default to CUSTOM
                        toolWidth = TOOLBAR_SIZES.CUSTOM;
                    } else {
                        toolWidth = TOOLBAR_SIZES.BUTTON;
                    }

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
    // Be careful not to split dividers weirdly. but for now strict slicing is ok.
    const overflowTools = tools.slice(visibleCount);

    const renderTool = (tool, idx) => {
        if (tool.type === 'divider') return <div key={idx} style={{ width: `${TOOLBAR_SIZES.DIVIDER}px` }} className="h-6 flex items-center justify-center shrink-0"><div className="w-px h-full bg-zinc-100 dark:bg-zinc-800" /></div>;
        if (tool.type === 'custom') return <Fragment key={tool.id}>{tool.render()}</Fragment>;

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
                        title={t('moreTools')}
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
