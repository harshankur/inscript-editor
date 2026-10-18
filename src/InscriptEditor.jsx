import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { ResponsiveToolbar } from './components/ResponsiveToolbar.jsx';
import { HistoryView } from './components/HistoryView.jsx';
import { TextBubbleMenu } from './components/bubble-menus/TextBubbleMenu.jsx';
import { TableBubbleMenu } from './components/bubble-menus/TableBubbleMenu.jsx';
import { ImageBubbleMenu } from './components/bubble-menus/ImageBubbleMenu.jsx';
import { YoutubeBubbleMenu } from './components/bubble-menus/YoutubeBubbleMenu.jsx';
import { EmbedBubbleMenu } from './components/bubble-menus/EmbedBubbleMenu.jsx';
import { SlashCommandMenu } from './components/SlashCommandMenu.jsx';
import { useInscriptEditorTranslations } from './hooks/useInscriptEditorTranslations.js';
import { buildThemeVars } from './utils/theme.js';
import { getHostHandlers, setExternalOpener, setHostHandlerProps } from './extensions/HostBridge.js';

const EMPTY_ORIGINAL = { html: '', title: '', tags: [], categories: [] };

/**
 * Top-level editor rendering component. Composes toolbar, bubble menus,
 * EditorContent, and HistoryView into a single element.
 *
 * Spread the hook's result into it (`<InscriptEditor {...api} />`) and the toolbar's Undo/Redo
 * and the history panel's Restore work with no further wiring; any `onHistory*` prop overrides.
 *
 * Exposes an imperative ref handle: { getHTML, getText, setContent, loadContent, flush, undo,
 * redo, restoreVersion, markSaved }.
 */
export const InscriptEditor = forwardRef(function InscriptEditor({
    editor,
    isReadonly = false,
    showDiff = false,
    focusMode = false,
    history = [],
    historyIndex = -1,
    originalContent,
    canUndo = false,
    canRedo = false,
    onHistoryUndo,
    onHistoryRedo,
    onShowMetadataModal,
    hasMetadata = false,
    showMetadataActive = false,
    onShowMediaLibrary,
    onAddYoutube,
    onAddCitation,
    onAddWikilink,
    onAddAbbreviation,
    onHistorySelect,
    restoreVersion,
    loadContent,
    flush,
    undo,
    redo,
    markSaved,
    toolbarConfig,
    onToolbarConfigChange,
    bubbleMenuConfig,
    onBubbleMenuConfigChange,
    toolbarPresets,
    bubbleMenuPresets,
    toolbarPresetLabels,
    presetsMode,
    customizerContainer,
    theme,
    fontFamily = '',
    fontSize = '',
    maxWidth = '',
    lineHeight = '',
    headingFontFamily = '',
    focusMaxWidth = '',
    focusDim = true,
    onOpenExternal,
}, ref) {
    useInscriptEditorTranslations();

    // All appearance tokens (colors, surfaces, borders, radii, spacing, fonts)
    // resolve to --inscript-* custom properties on the .inscript-editor scope so
    // they reach both the toolbar and the content. The legacy flat props
    // (fontFamily/fontSize/lineHeight/headingFontFamily) still work as fallbacks.
    const themeVars = buildThemeVars(theme, { fontFamily, fontSize, lineHeight, headingFontFamily });
    // max-width is resolved separately: focus mode overrides it with focusMaxWidth.
    const resolvedMaxWidth = focusMode
        ? (theme?.focusMaxWidth || focusMaxWidth || '48rem')
        : (theme?.maxWidth || maxWidth || undefined);

    // Selection menus are attached to the editor's root, outside the scrolling content area (which
    // clipped them), and follow that area as it scrolls (see menuOptions.js).
    const [scrollContainer, setScrollContainer] = useState(null);
    const [menuContainer, setMenuContainer] = useState(null);

    useImperativeHandle(ref, () => ({
        getHTML: () => editor?.getHTML() ?? '',
        getText: () => editor?.getText() ?? '',
        // Records an edit (a version, onContentChange). To open a document, use loadContent.
        // The content is taken as given: plain-text URLs in it are not turned into links.
        setContent: (html) => editor?.chain()
            .command(({ tr }) => { tr.setMeta('preventAutolink', true); return true; })
            .setContent(html)
            .run(),
        loadContent: (html, options) => loadContent?.(html, options) ?? false,
        flush: () => flush?.() ?? { history, historyIndex },
        undo: () => undo?.() ?? false,
        redo: () => redo?.() ?? false,
        restoreVersion: (index, options) => (options === undefined ? restoreVersion?.(index) : restoreVersion?.(index, options)),
        markSaved: () => markSaved?.(),
        toggleFocusMode: () => { /* host app manages this prop usually, but we could provide a local override if we tracked it locally */ },
    }), [editor, restoreVersion, loadContent, flush, undo, redo, markSaved, history, historyIndex]);

    // The slash menu (built with the editor) honours the insert-handler props too: published on the
    // editor, where it reads them when it opens.
    useEffect(() => {
        setHostHandlerProps(editor, { onAddCitation, onAddYoutube, onShowMediaLibrary, onAddWikilink, onAddAbbreviation });
        return () => setHostHandlerProps(editor, {});
    }, [editor, onAddCitation, onAddYoutube, onShowMediaLibrary, onAddWikilink, onAddAbbreviation]);

    // Node views (a YouTube video's privacy link) open external links through this prop too.
    useEffect(() => {
        setExternalOpener(editor, onOpenExternal);
        return () => setExternalOpener(editor, null);
    }, [editor, onOpenExternal]);

    if (!editor) return null;

    // The diff reference defaults to the first version (the document as opened), so hosts
    // don't have to pass originalContent to get a meaningful comparison.
    const original = originalContent ?? history[0] ?? EMPTY_ORIGINAL;
    // History actions default to the hook's own (spread in with the rest of its result); a host
    // handler, when given, takes over. The panel's Restore appends a 'restored' version.
    const handleUndo = onHistoryUndo ?? undo;
    const handleRedo = onHistoryRedo ?? redo;
    const handleHistorySelect = onHistorySelect
        ?? (restoreVersion ? (index) => restoreVersion(index, { reason: 'restore' }) : undefined);

    // Host handlers resolve as `prop ?? editorOptions`: the editorOptions values
    // (the single source of truth, shared with the slash menu) reach us through the
    // HostBridge extension, and an explicit <InscriptEditor> prop overrides them per
    // call. So a host can pass each handler once, in editorOptions.
    const bridge = getHostHandlers(editor);
    const resolvedOnShowMediaLibrary = onShowMediaLibrary ?? bridge.onShowMediaLibrary;
    const resolvedOnAddYoutube = onAddYoutube ?? bridge.onAddYoutube;
    const resolvedOnAddCitation = onAddCitation ?? bridge.onAddCitation;
    const resolvedOnAddWikilink = onAddWikilink ?? bridge.onAddWikilink;
    const resolvedOnAddAbbreviation = onAddAbbreviation ?? bridge.onAddAbbreviation;
    const resolvedOnOpenExternal = onOpenExternal ?? bridge.onOpenExternal;

    return (
        // display:contents scope: carries the theme custom properties to the
        // toolbar + content without introducing a layout box, so the host's
        // surrounding flex layout is unchanged.
        <div ref={setMenuContainer} className="inscript-editor" style={{ display: 'contents', ...themeVars }}>
            {/* Toolbar */}
            {!isReadonly && !showDiff && !focusMode && (
                <ResponsiveToolbar
                    editor={editor}
                    onHistoryUndo={handleUndo}
                    onHistoryRedo={handleRedo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onShowMetadataModal={onShowMetadataModal}
                    hasMetadata={hasMetadata}
                    showMetadataActive={showMetadataActive}
                    onShowMediaLibrary={resolvedOnShowMediaLibrary}
                    onAddYoutube={resolvedOnAddYoutube}
                    onAddCitation={resolvedOnAddCitation}
                    onAddWikilink={resolvedOnAddWikilink}
                    onAddAbbreviation={resolvedOnAddAbbreviation}
                    toolbarConfig={toolbarConfig}
                    onToolbarConfigChange={onToolbarConfigChange}
                    bubbleMenuConfig={bubbleMenuConfig}
                    onBubbleMenuConfigChange={onBubbleMenuConfigChange}
                    toolbarPresets={toolbarPresets}
                    bubbleMenuPresets={bubbleMenuPresets}
                    toolbarPresetLabels={toolbarPresetLabels}
                    presetsMode={presetsMode}
                    customizerContainer={customizerContainer}
                />
            )}

            {/* Content area */}
            <div ref={setScrollContainer} className="flex-1 overflow-y-auto relative bg-[var(--inscript-color-surface)]">
                {showDiff ? (
                    <HistoryView
                        history={history}
                        originalHtml={original.html ?? ''}
                        originalTitle={original.title ?? ''}
                        originalTags={original.tags ?? []}
                        originalCategories={original.categories ?? []}
                        currentIndex={historyIndex}
                        onSelect={handleHistorySelect}
                    />
                ) : (
                    <div 
                        className={`mx-auto px-2 pt-3 pb-[57px] md:px-8 md:pt-12 md:pb-[57px] flex flex-col min-h-full inscript-editor-container w-full ${focusMode ? 'focus-mode' : ''} ${focusMode && focusDim ? 'focus-dim' : ''}`}
                        style={{ '--inscript-max-width': resolvedMaxWidth }}
                    >
                        {/* Mounted once the root they attach to exists: TipTap reads where a menu goes
                            when it registers it, and ignores the first change after that. */}
                        {menuContainer && (
                            <>
                                <TextBubbleMenu editor={editor} isReadonly={isReadonly} scrollContainer={scrollContainer} menuContainer={menuContainer} bubbleMenuConfig={bubbleMenuConfig} onAddAbbreviation={resolvedOnAddAbbreviation} />
                                <TableBubbleMenu editor={editor} isReadonly={isReadonly} scrollContainer={scrollContainer} menuContainer={menuContainer} />
                                <ImageBubbleMenu editor={editor} isReadonly={isReadonly} scrollContainer={scrollContainer} menuContainer={menuContainer} />
                                <YoutubeBubbleMenu editor={editor} isReadonly={isReadonly} scrollContainer={scrollContainer} menuContainer={menuContainer} onOpenExternal={resolvedOnOpenExternal} />
                                <EmbedBubbleMenu editor={editor} isReadonly={isReadonly} scrollContainer={scrollContainer} menuContainer={menuContainer} onOpenExternal={resolvedOnOpenExternal} />
                            </>
                        )}
                        <SlashCommandMenu editor={editor} isReadonly={isReadonly} />
                        <EditorContent editor={editor} />
                    </div>
                )}
            </div>
        </div>
    );
});
