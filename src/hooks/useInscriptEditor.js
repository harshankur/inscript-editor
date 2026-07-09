import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '@tiptap/react';
import { buildExtensions } from '../extensions/index.js';

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
    editorOptions = {},
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

    // Reset history/dirty state whenever the editor is recreated for a new document.
    // Without this, switching documents (contentKey change) keeps the previous
    // document's history stack alive on the new one.
    useEffect(() => {
        setHistory([]);
        setHistoryIndex(-1);
        setIsDirty(false);
    }, [contentKey]);

    // --- TipTap editor ---
    const editor = useEditor({
        extensions: buildExtensions(editorOptions),
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

    // Clear the pending debounced history push whenever the editor identity changes
    // (contentKey change) or unmounts.
    //
    // A freshly (re)created editor can dispatch its own doc-changing transaction as
    // part of @tiptap/react's own mount effects for that editor — which, since
    // useEditor() is called earlier in this hook than this effect, run *before* this
    // effect's body for the same `editor` value. So on mount/recreation this body
    // clears that spurious timer as soon as it exists, before it can survive to fire
    // a phantom history entry. The cleanup below additionally covers real unmount and
    // the *next* editor swap, in case a genuine user-triggered timer is still pending.
    useEffect(() => {
        if (historyDebounceRef.current) {
            clearTimeout(historyDebounceRef.current);
            historyDebounceRef.current = null;
        }
        return () => {
            if (historyDebounceRef.current) {
                clearTimeout(historyDebounceRef.current);
                historyDebounceRef.current = null;
            }
        };
    }, [editor]);

    /**
     * Restore editor content to a history entry without triggering an onUpdate push.
     * The consumer is responsible for updating title/tags/categories from the history entry.
     */
    const restoreVersion = useCallback((index) => {
        const target = historyRef.current[index];
        if (!target || !editor || editor.isDestroyed) return;
        editor.commands.setContent(target.html, { emitUpdate: false });
        setHistoryIndex(index);
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
