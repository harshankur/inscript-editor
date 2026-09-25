import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import { buildExtensions } from '../extensions/index.js';
import { hasView, viewDom } from '../utils/editorView.js';
import {
    HISTORY_KINDS, DEFAULT_MAX_HISTORY, DEFAULT_MAX_HISTORY_BYTES,
    createEntry, sameMetadata, withIds, sanitizeHistory, capHistory, editorOptionsKey,
} from '../utils/history.js';

/**
 * Set the editor's content without it counting as an edit: no `update` event (so no history
 * commit and no onContentChange), and a fresh keystroke undo stack, so Cmd/Ctrl+Z can never
 * reach back across a load or a version jump (it would otherwise undo the load itself, or pull
 * the previous document's text into this one).
 */
function setContentQuiet(editor, html) {
    editor.chain()
        .command(({ tr }) => { tr.setMeta('addToHistory', false); return true; })
        .setContent(html ?? '', { emitUpdate: false })
        .run();
    const { state } = editor;
    editor.view.updateState(EditorState.create({ doc: state.doc, selection: state.selection, plugins: state.plugins }));
}

/**
 * Core editor hook for Inscript. Manages the TipTap editor instance, the client-side version
 * history, and dirty tracking. Server sync logic remains in the consumer.
 *
 * History model: an append-only list of versions and a pointer. Loading a document
 * (`loadContent`) seeds the baseline; edits append (debounced 1s); undo/redo move the pointer;
 * restoring a version from the panel appends a `restored` entry. Nothing is ever removed except
 * by the cap (oldest first, never the baseline or the active entry). Every change the user
 * causes reaches the host through `onContentChange(entry, { reason })`; loads never do.
 *
 * @param {object} options
 * @param {string}   options.contentKey    - Changing this value recreates the editor. Without a
 *                                           `documentKey` it also names the document (history resets).
 * @param {string}   [options.documentKey] - Names the document: history resets only when this changes,
 *                                           and recreating the editor (contentKey, editorOptions) keeps
 *                                           the document's content and history.
 * @param {string}   options.title         - Live title prop; mirrored to titleRef for the commit closure.
 * @param {string[]} options.tags          - Live tags prop; mirrored to tagsRef.
 * @param {string[]} options.categories    - Live categories prop; mirrored to categoriesRef.
 * @param {boolean}  options.isReadonly    - Disable editing when true.
 * @param {Function} options.onContentChange - `(entry, { reason })`, reason 'edit' | 'undo' | 'redo' | 'restore'.
 * @param {string}   [options.initialContent]  - The document's HTML, set when an editor is created for
 *                                           it (and seeded as its baseline version). The way to load a
 *                                           document without an effect, when the editor is created
 *                                           per document (contentKey = its id).
 * @param {number}   [options.maxHistory]      - Most versions kept (default 200).
 * @param {number}   [options.maxHistoryBytes] - Most HTML kept across versions, in characters (default ~20 MB).
 */
export function useInscriptEditor({
    contentKey = '',
    documentKey,
    title = '',
    tags = [],
    categories = [],
    isReadonly = false,
    onContentChange = null,
    editorOptions = {},
    spellcheck = true,
    initialContent,
    maxHistory = DEFAULT_MAX_HISTORY,
    maxHistoryBytes = DEFAULT_MAX_HISTORY_BYTES,
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

    // "Latest value" refs, assigned during render (read later by handlers and callbacks, never to
    // produce this render's output).
    const onContentChangeRef = useRef(onContentChange);
    onContentChangeRef.current = onContentChange;
    const limitsRef = useRef({ maxHistory, maxHistoryBytes });
    limitsRef.current = { maxHistory, maxHistoryBytes };

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
    // The other function-valued options (wikilink resolver, embed trust, custom slash items) are
    // read live through this ref too, so a new function identity never needs a new editor.
    const liveOptionsRef = useRef(editorOptions);
    liveOptionsRef.current = editorOptions;

    // Which document this is. With a documentKey, only that names the document; without one,
    // contentKey does (the pre-0.4 behaviour, kept exactly for existing hosts).
    const docIdentity = documentKey !== undefined && documentKey !== null
        ? `doc:${documentKey}`
        : `content:${contentKey}`;
    const docIdentityRef = useRef(docIdentity);
    docIdentityRef.current = docIdentity;
    /** The identity whose history is currently held (updated when the reset effect runs). */
    const committedIdentityRef = useRef(docIdentity);

    // --- History state ---
    // One state object so the list and the pointer always change together.
    const [historyState, setHistoryState] = useState({ history: [], index: -1 });
    const [isDirty, setIsDirty] = useState(false);
    const { history, index: historyIndex } = historyState;

    // Refs mirror the state synchronously (see applyHistory), so a commit or restore that runs
    // right after another mutation never reads a stale stack.
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const historyDebounceRef = useRef(null);
    /** Set to true by the consumer before a server-side content set; prevents a commit. */
    const isSyncingRef = useRef(false);
    /** Set to true by the consumer during initial post load; prevents a commit. */
    const isLoadingRef = useRef(false);
    /**
     * The editor's HTML right after the last history sync (load, commit, undo/redo/restore,
     * re-seed). Commits compare against it rather than against the stored entry, whose HTML may
     * not be byte-identical to what the editor normalizes it to (a host-seeded '' vs '<p></p>'),
     * which used to record a phantom version.
     */
    const lastSyncedHtmlRef = useRef(null);
    /** HTML carried from an editor being recreated for the same document to its replacement. */
    const carryHtmlRef = useRef(null);
    const mountedRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    /** The single path for every history mutation: caps, then updates refs and state together. */
    const applyHistory = useCallback((nextHistory, nextIndex) => {
        const capped = capHistory(nextHistory, nextIndex, limitsRef.current);
        historyRef.current = capped.history;
        historyIndexRef.current = capped.index;
        setHistoryState({ history: capped.history, index: capped.index });
        return capped;
    }, []);

    const clearPending = useCallback(() => {
        if (historyDebounceRef.current) {
            clearTimeout(historyDebounceRef.current);
            historyDebounceRef.current = null;
        }
    }, []);

    // --- TipTap editor ---
    // editorOptions apply at construction (extensions can't be swapped on a live editor), so a
    // change to their serializable part recreates the editor; that keeps the document (see
    // onDestroy below). buildExtensions runs only when the editor is actually (re)built.
    const optionsKey = editorOptionsKey(editorOptions);
    const extensions = useMemo(
        () => buildExtensions({ ...editorOptions, hostHandlersRef, liveOptionsRef }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [contentKey, optionsKey],
    );

    const handleDestroyRef = useRef(null);
    const hasInitialContent = typeof initialContent === 'string';
    const editor = useEditor({
        extensions,
        // Read when an editor is created: a new document's editor starts with its content, which
        // then becomes the baseline version (see the editor effect). No load from an effect needed.
        content: hasInitialContent ? initialContent : '',
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
        // Fires while the outgoing editor can still be read (TipTap emits 'destroy' before it
        // tears the view down).
        onDestroy: () => handleDestroyRef.current?.(),
    }, [contentKey, optionsKey]);

    // Live-toggle spellcheck on the editor DOM so the host's setting flips without recreating the
    // editor (which would lose the undo stack and cursor).
    useEffect(() => {
        const dom = viewDom(editor);
        if (dom) dom.setAttribute('spellcheck', String(spellcheck));
    }, [editor, spellcheck]);

    // The commit itself: appends a new version (and fires onContentChange) when the current
    // html/title/tags/categories differ from the active entry. Kept in a ref so the once-bound
    // onUpdate and the metadata effect always run the latest closure without rebinding.
    const commitRef = useRef(null);
    commitRef.current = () => {
        historyDebounceRef.current = null;
        if (!hasView(editor)) return;
        // Re-check guards at fire time: a debounce armed while unguarded must still
        // be dropped if loading/syncing/readonly flipped on before it fires.
        if (isReadonlyRef.current || isLoadingRef.current || isSyncingRef.current) return;
        const html = editor.getHTML();
        const meta = { title: titleRef.current, tags: tagsRef.current, categories: categoriesRef.current };

        const currentHist = historyRef.current;
        const currentIndex = historyIndexRef.current;
        const head = currentHist[currentIndex];
        const baseHtml = lastSyncedHtmlRef.current ?? head?.html;
        if (head && html === baseHtml && sameMetadata(head, meta)) return;

        // Append-only: an edit made after undo (pointer not at the end) is added at the end,
        // recording where it branched from, instead of deleting the undone versions.
        const branched = head && currentIndex < currentHist.length - 1;
        const entry = createEntry('edited', { html, ...meta, parentId: branched ? head.id : undefined });
        applyHistory([...currentHist, entry], currentHist.length);
        lastSyncedHtmlRef.current = html;
        setIsDirty(true);
        onContentChangeRef.current?.(entry, { reason: 'edit' });
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

    /** Commit a pending (debounced) edit right now, so a history jump never drops typing. */
    const flushPending = () => {
        if (!historyDebounceRef.current) return;
        clearPending();
        commitRef.current?.();
    };

    // The editor is being destroyed: either the component unmounts, the document changes, or
    // the editor is recreated for the same document (contentKey with a documentKey, or an
    // editorOptions change). Only in that last case is the work carried over: a pending edit is
    // committed now, and the content is handed to the replacement editor.
    handleDestroyRef.current = () => {
        const sameDocument = mountedRef.current && docIdentityRef.current === committedIdentityRef.current;
        if (!sameDocument) {
            clearPending();
            carryHtmlRef.current = null;
            return;
        }
        flushPending();
        try { carryHtmlRef.current = editor.getHTML(); } catch { carryHtmlRef.current = null; }
    };

    // Record title/tags/categories edits even when the editor content is untouched.
    // Skip the initial mount and any change that coincides with a document switch:
    // that is a load, not an edit.
    // Compare tags/categories by value: the `[]` defaults (and fresh arrays from a
    // consumer) change reference every render, which would otherwise re-run this
    // effect on every render instead of only on real metadata edits.
    const tagsKey = JSON.stringify(tags);
    const categoriesKey = JSON.stringify(categories);
    const didMountRef = useRef(false);
    const lastMetaIdentityRef = useRef(docIdentity);
    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            lastMetaIdentityRef.current = docIdentity;
            return;
        }
        if (lastMetaIdentityRef.current !== docIdentity) {
            lastMetaIdentityRef.current = docIdentity;
            return;
        }
        scheduleCommit();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, tagsKey, categoriesKey, docIdentity]);

    // A different document: drop the previous one's history, dirty flag and pending edit.
    useEffect(() => {
        if (committedIdentityRef.current === docIdentity) return;
        committedIdentityRef.current = docIdentity;
        clearPending();
        carryHtmlRef.current = null;
        lastSyncedHtmlRef.current = null;
        applyHistory([], -1);
        setIsDirty(false);
    }, [docIdentity, applyHistory, clearPending]);

    // Sync editable state when isReadonly changes without recreating the editor
    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            editor.setEditable(!isReadonly);
        }
    }, [editor, isReadonly]);

    // Whenever the editor identity changes (creation, recreation) or unmounts.
    //
    // A freshly (re)created editor can dispatch its own doc-changing transaction as
    // part of @tiptap/react's own mount effects for that editor — which, since
    // useEditor() is called earlier in this hook than this effect, run *before* this
    // effect's body for the same `editor` value. So on mount/recreation this body
    // clears that spurious timer as soon as it exists, before it can survive to fire
    // a phantom history entry. The cleanup below additionally covers real unmount and
    // the *next* editor swap, in case a genuine user-triggered timer is still pending.
    //
    // A replacement editor for the same document then gets the outgoing editor's content,
    // quietly (no phantom version, no onContentChange), so the host doesn't reload anything.
    //
    // An editor created for a document with `initialContent` (first mount, or a new document)
    // seeds that content as the baseline version.
    const hasInitialContentRef = useRef(hasInitialContent);
    hasInitialContentRef.current = hasInitialContent;
    useEffect(() => {
        clearPending();
        const carried = carryHtmlRef.current;
        carryHtmlRef.current = null;
        if (carried !== null && hasView(editor)) {
            setContentQuiet(editor, carried);
            lastSyncedHtmlRef.current = editor.getHTML();
        } else if (hasInitialContentRef.current && hasView(editor) && historyRef.current.length === 0) {
            const html = editor.getHTML();
            lastSyncedHtmlRef.current = html;
            applyHistory([createEntry('opened', {
                html, title: titleRef.current, tags: tagsRef.current, categories: categoriesRef.current,
            })], 0);
            setIsDirty(false);
        }
        return clearPending;
    }, [editor, clearPending, applyHistory]);

    /**
     * Load a document: the one way to put content into the editor that is NOT an edit. It
     * becomes the baseline version ("Opened"), the dirty flag clears, onContentChange is not
     * called, a pending edit is dropped, and keystroke undo can't reach back across it.
     *
     * @param {string} html
     * @param {object} [options]
     * @param {string}   [options.title], [options.tags], [options.categories] - The document's metadata
     *                   (default: the hook's current title/tags/categories).
     * @param {string}   [options.kind]        - 'opened' (default) | 'imported' | 'external'.
     * @param {boolean}  [options.keepHistory] - true: the same document changed elsewhere; append an
     *                                           entry (kind 'external' by default) and keep the rest.
     * @param {object[]} [options.history]     - A persisted stack for this document (validated; the
     *                                           loaded content is appended unless it matches).
     * @param {number}   [options.historyIndex] - The persisted stack's active entry (default: last).
     * @returns {boolean} false when there is no live editor yet.
     */
    const loadContent = useCallback((html, options = {}) => {
        if (!hasView(editor)) return false;
        const { kind, keepHistory = false, history: persisted, historyIndex: persistedIndex } = options;
        clearPending();
        setContentQuiet(editor, html);
        const normalized = editor.getHTML();
        lastSyncedHtmlRef.current = normalized;

        if (options.title !== undefined) titleRef.current = options.title;
        if (options.tags !== undefined) tagsRef.current = options.tags;
        if (options.categories !== undefined) categoriesRef.current = options.categories;
        const meta = { title: titleRef.current, tags: tagsRef.current, categories: categoriesRef.current };

        let base = [];
        let baseIndex = -1;
        if (persisted !== undefined) {
            ({ history: base, index: baseIndex } = sanitizeHistory(persisted, persistedIndex));
        } else if (keepHistory) {
            base = historyRef.current;
            baseIndex = historyIndexRef.current;
        }
        const head = base[baseIndex];
        if (head && head.html === normalized && sameMetadata(head, meta)) {
            applyHistory(base, baseIndex);
        } else {
            const resolvedKind = HISTORY_KINDS.includes(kind) ? kind : (base.length ? 'external' : 'opened');
            applyHistory([...base, createEntry(resolvedKind, { html: normalized, ...meta })], base.length);
        }
        setIsDirty(false);
        return true;
    }, [editor, applyHistory, clearPending]);

    // Put a version's content in the editor and point at it (undo/redo), telling the host.
    const moveTo = (index, reason) => {
        if (!hasView(editor)) return false;
        flushPending();
        const target = historyRef.current[index];
        if (!target) return false;
        if (index === historyIndexRef.current && editor.getHTML() === lastSyncedHtmlRef.current) return false;
        const resolvedReason = reason ?? (index < historyIndexRef.current ? 'undo' : 'redo');
        setContentQuiet(editor, target.html);
        lastSyncedHtmlRef.current = editor.getHTML();
        applyHistory(historyRef.current, index);
        setIsDirty(true);
        onContentChangeRef.current?.(target, { reason: resolvedReason });
        return true;
    };

    // Restore a version as a NEW entry at the end (the history panel's "Restore Version").
    const restoreAsNewVersion = (index) => {
        if (!hasView(editor)) return false;
        flushPending();
        const currentHist = historyRef.current;
        const target = currentHist[index];
        if (!target) return false;
        if (index === historyIndexRef.current && editor.getHTML() === lastSyncedHtmlRef.current) return false;
        setContentQuiet(editor, target.html);
        const html = editor.getHTML();
        lastSyncedHtmlRef.current = html;
        const entry = createEntry('restored', {
            html, title: target.title, tags: target.tags, categories: target.categories, restoredFrom: target.id,
        });
        applyHistory([...currentHist, entry], currentHist.length);
        setIsDirty(true);
        onContentChangeRef.current?.(entry, { reason: 'restore' });
        return true;
    };

    // undo/redo/restoreVersion are stable callbacks that run the latest closures.
    const flushPendingRef = useRef(flushPending);
    flushPendingRef.current = flushPending;
    const moveToRef = useRef(moveTo);
    moveToRef.current = moveTo;
    const restoreAsNewRef = useRef(restoreAsNewVersion);
    restoreAsNewRef.current = restoreAsNewVersion;

    /** Step back one version (commits pending typing first, so it can be redone). */
    const undo = useCallback(() => {
        flushPendingRef.current();
        const index = historyIndexRef.current;
        return index > 0 ? moveToRef.current(index - 1, 'undo') : false;
    }, []);

    /** Step forward one version. */
    const redo = useCallback(() => {
        flushPendingRef.current();
        const index = historyIndexRef.current;
        return index < historyRef.current.length - 1 ? moveToRef.current(index + 1, 'redo') : false;
    }, []);

    /**
     * Put a version back in the editor. `reason: 'restore'` (what the history panel does)
     * appends a `restored` entry; `'undo'`/`'redo'` move the pointer. Without a reason it moves
     * the pointer (the pre-0.4 behaviour hosts wire their undo/redo to), and the reason reported
     * to the host follows the direction. The consumer applies the entry's title/tags/categories
     * if it keeps metadata in history (onContentChange hands it the entry).
     */
    const restoreVersion = useCallback((index, options = {}) => {
        if (options.reason === 'restore') return restoreAsNewRef.current(index);
        return moveToRef.current(index, options.reason === 'undo' || options.reason === 'redo' ? options.reason : undefined);
    }, []);

    /** Reset the dirty flag after a successful save. */
    const markSaved = useCallback(() => setIsDirty(false), []);

    /** @deprecated Use loadContent. Replaces the list (entries get ids); the pointer is clamped. */
    const setHistory = useCallback((next) => {
        const value = typeof next === 'function' ? next(historyRef.current) : next;
        const list = withIds(Array.isArray(value) ? value : []);
        lastSyncedHtmlRef.current = null;
        applyHistory(list, Math.min(historyIndexRef.current, list.length - 1));
    }, [applyHistory]);

    /** @deprecated Use loadContent / undo / redo / restoreVersion. Moves the pointer (clamped). */
    const setHistoryIndex = useCallback((next) => {
        const value = typeof next === 'function' ? next(historyIndexRef.current) : next;
        const last = historyRef.current.length - 1;
        const index = Number.isInteger(value) ? Math.max(-1, Math.min(value, last)) : -1;
        lastSyncedHtmlRef.current = null;
        applyHistory(historyRef.current, index);
    }, [applyHistory]);

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
        loadContent,
        undo,
        redo,
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
