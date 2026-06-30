import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CustomImage } from '../extensions/CustomImage.js';
import { CustomTable } from '../extensions/CustomTable.js';
import { FontSize } from '../extensions/FontSize.js';
import { Youtube } from '../extensions/Youtube.js';

/**
 * Core editor hook for Inscript. Manages TipTap editor instance, client-side
 * history stack, and dirty-tracking. Server sync logic remains in the consumer.
 *
 * @param {object} options
 * @param {string}   options.contentKey    - Changing this value recreates the editor (pass filename).
 * @param {string}   options.title         - Live title prop; mirrored to titleRef for onUpdate closure.
 * @param {string[]} options.tags          - Live tags prop; mirrored to tagsRef.
 * @param {string[]} options.categories    - Live categories prop; mirrored to categoriesRef.
 * @param {boolean}  options.isReadonly    - Disable editing when true.
 * @param {Function} options.onContentChange - Called with { html, title, tags, categories, timestamp } after debounce.
 */
export function useInscriptEditor({
    contentKey = '',
    title = '',
    tags = [],
    categories = [],
    isReadonly = false,
    onContentChange = null,
} = {}) {
    // --- Live-prop refs (prevent stale closures in onUpdate) ---
    const isReadonlyRef = useRef(isReadonly);
    const titleRef = useRef(title);
    const tagsRef = useRef(tags);
    const categoriesRef = useRef(categories);

    useEffect(() => { isReadonlyRef.current = isReadonly; }, [isReadonly]);
    useEffect(() => { titleRef.current = title; }, [title]);
    useEffect(() => { tagsRef.current = tags; }, [tags]);
    useEffect(() => { categoriesRef.current = categories; }, [categories]);

    // --- History state ---
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isDirty, setIsDirty] = useState(false);

    // Refs so onUpdate closure always reads latest values without re-creating the editor
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const historyDebounceRef = useRef(null);
    /** Set to true by the consumer before a server-side content set; prevents onUpdate push. */
    const isSyncingRef = useRef(false);
    /** Set to true by the consumer during initial post load; prevents onUpdate push. */
    const isLoadingRef = useRef(false);

    useEffect(() => {
        historyRef.current = history;
        historyIndexRef.current = historyIndex;
    }, [history, historyIndex]);

    // --- TipTap editor ---
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                history: false,
                link: false,
            }),
            Underline,
            CustomImage.configure({ allowBase64: true }),
            TextStyle,
            Color,
            FontSize,
            Highlight.configure({ multicolor: true }),
            Subscript,
            Superscript,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Youtube,
            CustomTable.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
            Link.configure({
                openOnClick: false,
                linkOnPaste: true,
                autolink: true,
                HTMLAttributes: {
                    class: 'text-emerald-500 underline underline-offset-4 cursor-pointer hover:text-emerald-400 transition-colors',
                },
            }),
        ],
        content: '',
        editable: !isReadonly,
        editorProps: {
            attributes: {
                class: 'prose dark:prose-invert prose-lg max-w-none focus:outline-none min-h-[calc(100vh-300px)]',
            },
        },
        onUpdate: ({ editor }) => {
            if (isReadonlyRef.current || isLoadingRef.current || isSyncingRef.current) return;

            if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);

            historyDebounceRef.current = setTimeout(() => {
                const newHtml = editor.getHTML();
                const newTitle = titleRef.current;
                const newTags = tagsRef.current;
                const newCategories = categoriesRef.current;

                const currentHist = historyRef.current;
                const currentIndex = historyIndexRef.current;
                const currentItem = currentHist[currentIndex];

                const changed = (
                    !currentItem ||
                    currentItem.html !== newHtml ||
                    currentItem.title !== newTitle ||
                    JSON.stringify(currentItem.tags) !== JSON.stringify(newTags) ||
                    JSON.stringify(currentItem.categories) !== JSON.stringify(newCategories)
                );

                if (changed) {
                    const newHistory = currentHist.slice(0, currentIndex + 1);
                    const newState = {
                        html: newHtml,
                        title: newTitle,
                        tags: newTags,
                        categories: newCategories,
                        timestamp: new Date().toISOString(),
                    };
                    newHistory.push(newState);

                    setHistory(newHistory);
                    setHistoryIndex(newHistory.length - 1);
                    setIsDirty(true);

                    if (onContentChange) onContentChange(newState);
                }
            }, 1000);
        },
    }, [contentKey]);

    // Sync editable state when isReadonly changes without recreating the editor
    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            editor.setEditable(!isReadonly);
        }
    }, [editor, isReadonly]);

    /**
     * Restore editor content to a history entry without triggering an onUpdate push.
     * The consumer is responsible for updating title/tags/categories from the history entry.
     */
    const restoreVersion = useCallback((index) => {
        const target = historyRef.current[index];
        if (!target || !editor || editor.isDestroyed) return;
        isSyncingRef.current = true;
        editor.commands.setContent(target.html);
        setHistoryIndex(index);
        setTimeout(() => { isSyncingRef.current = false; }, 100);
    }, [editor]);

    /** Reset the dirty flag after a successful save. */
    const markSaved = useCallback(() => setIsDirty(false), []);

    return {
        editor,
        history,
        setHistory,
        historyIndex,
        setHistoryIndex,
        isDirty,
        setIsDirty,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        restoreVersion,
        markSaved,
        // Refs consumed directly by App.jsx for server-sync locking and title integrity
        titleRef,
        historyRef,
        historyDebounceRef,
        isSyncingRef,
        isLoadingRef,
    };
}
