import { forwardRef, useImperativeHandle } from 'react';
import { EditorContent } from '@tiptap/react';
import { ResponsiveToolbar } from './components/ResponsiveToolbar.jsx';
import { HistoryView } from './components/HistoryView.jsx';
import { TextBubbleMenu } from './components/bubble-menus/TextBubbleMenu.jsx';
import { TableBubbleMenu } from './components/bubble-menus/TableBubbleMenu.jsx';
import { ImageBubbleMenu } from './components/bubble-menus/ImageBubbleMenu.jsx';
import { YoutubeBubbleMenu } from './components/bubble-menus/YoutubeBubbleMenu.jsx';
import { SlashCommandMenu } from './components/SlashCommandMenu.jsx';
import { useInscriptEditorTranslations } from './hooks/useInscriptEditorTranslations.js';

/**
 * Top-level editor rendering component. Composes toolbar, bubble menus,
 * EditorContent, and HistoryView into a single element.
 *
 * Exposes an imperative ref handle: { getHTML, getText, setContent, restoreVersion, markSaved }.
 */
export const InscriptEditor = forwardRef(function InscriptEditor({
    editor,
    isReadonly = false,
    showDiff = false,
    focusMode = false,
    history = [],
    historyIndex = -1,
    originalContent = { html: '', title: '', tags: [], categories: [] },
    canUndo = false,
    canRedo = false,
    onHistoryUndo,
    onHistoryRedo,
    onShowMetadataModal,
    hasMetadata = false,
    showMetadataActive = false,
    onShowMediaLibrary,
    onAddYoutube,
    onHistorySelect,
    restoreVersion,
    markSaved,
    toolbarConfig,
    onToolbarConfigChange,
}, ref) {
    useInscriptEditorTranslations();

    useImperativeHandle(ref, () => ({
        getHTML: () => editor?.getHTML() ?? '',
        getText: () => editor?.getText() ?? '',
        setContent: (html) => editor?.commands.setContent(html),
        restoreVersion: (index) => restoreVersion?.(index),
        markSaved: () => markSaved?.(),
        toggleFocusMode: () => { /* host app manages this prop usually, but we could provide a local override if we tracked it locally */ },
    }), [editor, restoreVersion, markSaved]);

    if (!editor) return null;

    return (
        <>
            {/* Toolbar */}
            {!isReadonly && !showDiff && !focusMode && (
                <ResponsiveToolbar
                    editor={editor}
                    onHistoryUndo={onHistoryUndo}
                    onHistoryRedo={onHistoryRedo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onShowMetadataModal={onShowMetadataModal}
                    hasMetadata={hasMetadata}
                    showMetadataActive={showMetadataActive}
                    onShowMediaLibrary={onShowMediaLibrary}
                    onAddYoutube={onAddYoutube}
                    toolbarConfig={toolbarConfig}
                    onToolbarConfigChange={onToolbarConfigChange}
                />
            )}

            {/* Content area */}
            <div className="flex-1 overflow-y-auto relative bg-white dark:bg-zinc-950">
                {showDiff ? (
                    <HistoryView
                        history={history}
                        originalHtml={originalContent.html}
                        originalTitle={originalContent.title}
                        originalTags={originalContent.tags}
                        originalCategories={originalContent.categories}
                        current={editor.getHTML()}
                        currentIndex={historyIndex}
                        onSelect={onHistorySelect}
                    />
                ) : (
                    <div className={`mx-auto px-2 pt-3 pb-[57px] md:px-8 md:pt-12 md:pb-[57px] flex flex-col min-h-full ${focusMode ? 'max-w-3xl focus-mode' : 'max-w-6xl'}`}>
                        <TextBubbleMenu editor={editor} isReadonly={isReadonly} />
                        <TableBubbleMenu editor={editor} isReadonly={isReadonly} />
                        <ImageBubbleMenu editor={editor} isReadonly={isReadonly} />
                        <YoutubeBubbleMenu editor={editor} isReadonly={isReadonly} />
                        <SlashCommandMenu isReadonly={isReadonly} />
                        <EditorContent editor={editor} />
                    </div>
                )}
            </div>
        </>
    );
});
