import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '@tiptap/react';
import { buildExtensions } from '../extensions/index.js';
import { viewDom } from '../utils/editorView.js';

/**
 * Core editor hook for Inscript. Manages TipTap editor instance, client-side
 * history stack, and dirty-tracking. Server sync logic remains in the consumer.
 *
 * @param {object} options
 * @param {string}   options.contentKey    - Changing this value recreates the editor (pass filename).
 * @param {string}   options.title         - Live title prop; mirrored to titleRef for the commit closure.
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
    spellcheck = true,
} = {}) {
    // --- Live-prop refs (prevent stale closures in the commit) ---
    const isReadonlyRef = useRef(isReadonly);
    const titleRef = useRef(title);
    const tagsRef = useRef(tags);
    const categoriesRef = useRef(categories);

    useEffect(() => { isReadonlyRef.current = isReadonly; }, [isReadonly]);
    useEffect(() => { titleRef.current = title; }, [title]);
    useEffect(() => { tagsRef.current = tags; }, [tags]);
    useEffect(() => { categoriesRef.current = categories; }, [categories]);

    // Host-owned insert handlers (onAddCitation/onAddYoutube/onShowMediaLibrary/
    // onAddWikilink/onAddAbbreviation), passed once via editorOptions and shared with both
    // the slash menu (built at editor construction) and the toolbar/bubble (read at render
    // via the HostBridge extension), so callback identity never recreates the editor.
    //
    // Assigned DURING render, not in a post-commit effect: useEditor creates the editor
    // synchronously on the first render (immediatelyRender defaults to true), so the ref
    // must already hold the handlers before <InscriptEditor> reads them on that same first
    // render. An effect would leave the first paint wired to the prompt fallback until a
    // later re-render. This is the "latest value ref" pattern (safe: it is not read to
    // produce this render's own output, only by the child during its render and by handlers
    // on user interaction).
    const hostHandlersRef = useRef({});
    hostHandlersRef.current = {
        onAddCitation: editorOptions.onAddCitation,
        onAddYoutube: editorOptions.onAddYoutube,
        onShowMediaLibrary: editorOptions.onShowMediaLibrary,
        onAddWikilink: editorOptions.onAddWikilink,
        onAddAbbreviation: editorOptions.onAddAbbreviation,
    };

    // --- History state ---
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isDirty, setIsDirty] = useState(false);

    // Refs so the commit closure always reads latest values without re-creating the editor
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const historyDebounceRef = useRef(null);
    /** Set to true by the consumer before a server-side content set; prevents a commit. */
    const isSyncingRef = useRef(false);
    /** Set to true by the consumer during initial post load; prevents a commit. */
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
        extensions: buildExtensions({ ...editorOptions, hostHandlersRef }),
        content: '',
        editable: !isReadonly,
        editorProps: {
            attributes: {
                // Height and all content styling come from the .ProseMirror rules
                // (token-driven, see src/styles/index.css); min-height is the
                // --inscript-min-height token. The old `prose*` classes were dead
                // (no @tailwindcss/typography dependency) and are dropped.
                class: 'focus:outline-none',
                spellcheck: String(spellcheck),
            },
        },
        // Both editor content edits (here) AND metadata edits (title/tags/categories,
        // see the effect below) funnel through the same debounced commit, so a
        // title-only change is recorded/saved just like a content change.
        onUpdate: () => scheduleCommit(),
    }, [contentKey]);

    // Live-toggle spellcheck on the editor DOM so the host's setting flips without recreating the
    // editor (which would lose the undo stack and cursor).
    useEffect(() => {
        const dom = viewDom(editor);
        if (dom) dom.setAttribute('spellcheck', String(spellcheck));
    }, [editor, spellcheck]);

    // The commit itself — pushes a new history entry (and fires onContentChange)
    // when the current html/title/tags/categories differ from the head entry.
    // Kept in a ref so the once-bound onUpdate and the metadata effect always run
    // the latest closure (fresh editor + onContentChange) without rebinding.
    const commitRef = useRef(null);
    commitRef.current = () => {
        if (!editor || editor.isDestroyed) return;
        // Re-check guards at fire time: a debounce armed while unguarded must still
        // be dropped if loading/syncing/readonly flipped on before it fires.
        if (isReadonlyRef.current || isLoadingRef.current || isSyncingRef.current) return;
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
        if (!changed) return;

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
    };

    // Debounced arming, shared by content and metadata edits. Guards mirror the
    // old onUpdate guard so nothing commits while readonly / loading / syncing.
    // References only refs, so it is safe to bind into onUpdate once.
    function scheduleCommit() {
        if (isReadonlyRef.current || isLoadingRef.current || isSyncingRef.current) return;
        if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
        historyDebounceRef.current = setTimeout(() => {
            if (commitRef.current) commitRef.current();
        }, 1000);
    }

    // Record title/tags/categories edits even when the editor content is untouched.
    // Skip the initial mount and any change that coincides with a document switch
    // (contentKey change) — that is a load, not an edit.
    // Compare tags/categories by value: the `[]` defaults (and fresh arrays from a
    // consumer) change reference every render, which would otherwise re-run this
    // effect on every render instead of only on real metadata edits.
    const tagsKey = JSON.stringify(tags);
    const categoriesKey = JSON.stringify(categories);
    const didMountRef = useRef(false);
    const lastContentKeyRef = useRef(contentKey);
    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            lastContentKeyRef.current = contentKey;
            return;
        }
        if (lastContentKeyRef.current !== contentKey) {
            lastContentKeyRef.current = contentKey;
            return;
        }
        scheduleCommit();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, tagsKey, categoriesKey, contentKey]);

    // Sync editable state when isReadonly changes without recreating the editor
    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            editor.setEditable(!isReadonly);
        }
    }, [editor, isReadonly]);

    // Clear the pending debounced commit whenever the editor identity changes
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
     * Restore editor content to a history entry without triggering a commit.
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
