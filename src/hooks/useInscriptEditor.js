import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '@tiptap/react';
import { createDocument, getHTMLFromFragment } from '@tiptap/core';
import { buildExtensions } from '../extensions/index.js';
import { hasView, viewDom } from '../utils/editorView.js';
import {
    HISTORY_KINDS, DEFAULT_MAX_HISTORY, DEFAULT_MAX_HISTORY_BYTES,
    createEntry, sameMetadata, withIds, sanitizeHistory, capHistory, editorOptionsKey, documentForReplacement,
} from '../utils/history.js';

/** How long edits settle before they are recorded as a version. */
const COMMIT_DEBOUNCE_MS = 1000;

/** prosemirror-history's plugin key (TipTap's UndoRedo), as ProseMirror names keys. */
const HISTORY_PLUGIN_KEY = 'history$';

/**
 * Set the editor's content without it counting as an edit: no `update` event (so no history
 * commit and no onContentChange), and a fresh keystroke undo stack, so Cmd/Ctrl+Z can never
 * reach back across a load or a version jump (it would otherwise undo the load itself, or pull
 * the previous document's text into this one).
 *
 * `exact`: the HTML is the editor's own (a version, what a replaced editor held), so its
 * whitespace is content (two spaces typed in a row, a space left by deleting a word) and is kept
 * as it is. A host's HTML is parsed like any page, its formatting whitespace collapsed.
 */
function setContentQuiet(editor, html, { exact = false } = {}) {
    editor.chain()
        // Not undoable by keystroke, and taken as given: plain-text URLs are not autolinked.
        .command(({ tr }) => { tr.setMeta('addToHistory', false).setMeta('preventAutolink', true); return true; })
        .setContent(html ?? '', { emitUpdate: false, ...(exact ? { parseOptions: { preserveWhitespace: 'full' } } : {}) })
        .run();
    // Keystroke undo starts over: the history plugin alone is dropped and added back, so its state
    // is new. Every other plugin keeps its state. A state built from scratch re-initialized them all,
    // and the table plugin then handed ProseMirror a new node-view function, which redrew every
    // block (every formula and diagram rendered again, every embed rebuilt) on each load and undo.
    const { state } = editor;
    const withoutHistory = state.plugins.filter(plugin => plugin.key !== HISTORY_PLUGIN_KEY);
    if (withoutHistory.length === state.plugins.length) return;
    editor.view.updateState(state.reconfigure({ plugins: withoutHistory }).reconfigure({ plugins: state.plugins }));
}

/**
 * Is the document blank: one empty paragraph, what an editor holds before it is given anything?
 * (TipTap's isEmpty is also true for a table or a list whose cells hold no text.)
 */
function isBlankDocument(editor) {
    const { doc } = editor.state;
    return doc.childCount === 1 && doc.firstChild.type.name === 'paragraph' && doc.firstChild.childCount === 0;
}

/**
 * Run one empty transaction that tells no one: plugins that append to every transaction (TipTap's
 * trailing node) normalize the document, with no update event and nothing for undo.
 */
function settleQuietly(editor) {
    editor.view.dispatch(editor.state.tr.setMeta('preventUpdate', true).setMeta('addToHistory', false));
}

/**
 * Do two HTML strings hold the same document for this schema? Both go through the same parse
 * and serialize, so HTML that differs only in how it was written (a Markdown renderer's newlines
 * between blocks, attribute order or defaults from an older editor or TipTap release) compares
 * equal. Anything unparseable compares unequal.
 */
function sameDocumentHtml(schema, a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    try {
        const serialize = html => getHTMLFromFragment(createDocument(html, schema).content, schema);
        return serialize(a) === serialize(b);
    } catch {
        return false;
    }
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

    // Typing still waiting to be recorded when the editor turns read-only is recorded first: the
    // commit timer drops anything that fires while read-only.
    useEffect(() => {
        if (isReadonly && !isReadonlyRef.current) flushPendingRef.current?.();
        isReadonlyRef.current = isReadonly;
    }, [isReadonly]);

    // Title, tags and categories props reach the refs only when their value changes. loadContent
    // sets the refs too (the document's own metadata), and an effect re-run with nothing changed
    // (StrictMode, Fast Refresh, an <Activity> shown again) must not put the props back over it.
    // Compared by value: the `[]` defaults (and a host's inline arrays) are new on every render.
    const tagsKey = JSON.stringify(tags);
    const categoriesKey = JSON.stringify(categories);
    const appliedPropsRef = useRef({ title, tagsKey, categoriesKey });
    useEffect(() => {
        const applied = appliedPropsRef.current;
        if (applied.title !== title) { titleRef.current = title; applied.title = title; }
        if (applied.tagsKey !== tagsKey) { tagsRef.current = tags; applied.tagsKey = tagsKey; }
        if (applied.categoriesKey !== categoriesKey) { categoriesRef.current = categories; applied.categoriesKey = categoriesKey; }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, tagsKey, categoriesKey]);

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
        onOpenExternal: editorOptions.onOpenExternal,
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
    /** Whether an edit is waiting to be recorded (Undo/Redo availability depends on it). */
    const [hasPendingEdit, setHasPendingEdit] = useState(false);
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
    /**
     * What a destroyed editor leaves for its replacement when the document is the same:
     * `{ html, from, isEmpty, hasUncommittedEdit }`. `from` is the instance it was read from,
     * so it is only ever applied to a different one.
     */
    const carryRef = useRef(null);
    /** An edit has been armed for commit and neither committed nor deliberately dropped yet. */
    const pendingEditRef = useRef(false);
    /** A title/tags/categories change is waiting to be recorded (survives an effect re-run). */
    const metadataPendingRef = useRef(false);
    const mountedRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    /** The single path for every history mutation: caps, then updates refs and state together. */
    /** Versions the cap must keep for now (one about to be restored while pending typing commits). */
    const protectedIdsRef = useRef([]);
    const applyHistory = useCallback((nextHistory, nextIndex) => {
        const capped = capHistory(nextHistory, nextIndex, { ...limitsRef.current, protectedIds: protectedIdsRef.current });
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
        setHasPendingEdit(false);
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
    const initialContentRef = useRef(initialContent);
    initialContentRef.current = initialContent;
    const hasInitialContentRef = useRef(hasInitialContent);
    hasInitialContentRef.current = hasInitialContent;

    // What a new editor starts with, read when TipTap creates it: right after it destroyed the
    // editor this one replaces (an editorOptions or contentKey change for the same document, or an
    // <Activity> shown again after TipTap destroyed the hidden editor), so what that editor left is
    // known. A replacement starts with the document itself instead of being given it from an
    // effect: setting content there builds React node views, which render synchronously, and React
    // refuses that while it runs effects. A new document's editor starts with its initialContent,
    // which then becomes the baseline version (see the editor effect).
    const replacementSource = () => {
        if (docIdentityRef.current !== committedIdentityRef.current) return null;
        return documentForReplacement({
            carry: carryRef.current,
            replacement: null,
            lastSyncedHtml: lastSyncedHtmlRef.current,
            activeEntry: historyRef.current[historyIndexRef.current],
        });
    };
    const editorConfig = {
        extensions,
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
        // TipTap also emits `update` when only editability changes (setEditable): no edit then.
        onUpdate: ({ editor: instance, transaction }) => {
            if (transaction && !transaction.docChanged) return;
            scheduleCommit(instance);
        },
        // Every instance reports its OWN destruction. TipTap's 'destroy' event names no editor
        // and its onDestroy option is shared by every instance this useEditor ever creates,
        // including the extra one React StrictMode constructs and discards a tick after mount:
        // reading "the current editor" there captured the live document as that instance's
        // leftover. The listener runs while the instance can still be read (TipTap emits
        // 'destroy' before it tears the view down).
        onBeforeCreate: ({ editor: instance }) => {
            instance.on('destroy', () => handleDestroyRef.current?.(instance));
        },
    };
    Object.defineProperties(editorConfig, {
        content: {
            enumerable: true,
            get: () => replacementSource()?.html ?? (hasInitialContentRef.current ? initialContentRef.current : ''),
        },
        // A replacement's HTML is the editor's own, whitespace included (see setContentQuiet).
        parseOptions: {
            enumerable: true,
            get: () => (replacementSource() ? { preserveWhitespace: 'full' } : undefined),
        },
    });
    const editor = useEditor(editorConfig, [contentKey, optionsKey]);

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
    // `instance`: the editor to read, by default this render's. An editor being torn down or
    // destroyed passes itself (this render's may already be its replacement).
    commitRef.current = (instance = editor) => {
        historyDebounceRef.current = null;
        setHasPendingEdit(false);
        // A destroyed editor can't be read: what was pending stays pending, and the replacement
        // editor's effect arms it again (see the editor effect).
        if (!hasView(instance)) return;
        // Whatever the outcome below (recorded, unchanged, or dropped by a guard), the pending
        // edit has now been dealt with.
        pendingEditRef.current = false;
        metadataPendingRef.current = false;
        // Re-check guards at fire time: a debounce armed while unguarded must still
        // be dropped if loading/syncing/readonly flipped on before it fires.
        if (isReadonlyRef.current || isLoadingRef.current || isSyncingRef.current) return;
        const html = instance.getHTML();
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
        onContentChangeRef.current?.(storedEntry(entry), { reason: 'edit' });
    };

    // The entry as the history holds it: the cap may have dropped a link to an evicted entry
    // (parentId, restoredFrom) from the stored copy, and the host must get what is stored.
    const storedEntry = entry => historyRef.current.find(e => e.id === entry.id) ?? entry;

    // Debounced arming, shared by content and metadata edits. Guards mirror the
    // old onUpdate guard so nothing commits while readonly / loading / syncing.
    // References only refs, so it is safe to bind into onUpdate once.
    function scheduleCommit(instance) {
        if (isLoadingRef.current || isSyncingRef.current) {
            // Content the host sets while loading or syncing (an editor update) is not an edit, and
            // it replaces what was typed and not yet recorded: that is dropped, and later edits
            // compare against it. A metadata change then (no editor) leaves pending typing alone.
            if (hasView(instance)) {
                clearPending();
                pendingEditRef.current = false;
                lastSyncedHtmlRef.current = instance.getHTML();
            }
            return;
        }
        if (isReadonlyRef.current) return;
        if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
        pendingEditRef.current = true;
        setHasPendingEdit(true);
        historyDebounceRef.current = setTimeout(() => {
            if (commitRef.current) commitRef.current();
        }, COMMIT_DEBOUNCE_MS);
    }

    /**
     * Commit a pending (debounced) edit right now, so a history jump never drops typing.
     * `instance`: the editor to read (see commitRef).
     */
    const flushPending = (instance) => {
        if (!historyDebounceRef.current) return;
        clearPending();
        commitRef.current?.(instance);
    };

    // An editor instance is being destroyed. If it is the one this hook renders and the document
    // is unchanged, its content is left for a replacement: the editor is recreated for the same
    // document (contentKey with a documentKey, an editorOptions change), or React tore the
    // effects down and TipTap destroyed the editor meanwhile (an <Activity> hidden, then shown).
    handleDestroyRef.current = (instance) => {
        // Not this hook's editor: nothing about the document can be read from it.
        if (instance !== editor) return;
        if (docIdentityRef.current !== committedIdentityRef.current) {
            clearPending();
            pendingEditRef.current = false;
            metadataPendingRef.current = false;
            carryRef.current = null;
            return;
        }
        // While mounted, a pending edit is committed now so the host hears of it. With the effects
        // torn down the host is not notified; the edit travels with the carry instead and is
        // committed once a replacement editor holds it.
        if (mountedRef.current) flushPending(instance);
        try {
            carryRef.current = {
                html: instance.getHTML(),
                from: instance,
                isEmpty: isBlankDocument(instance),
                hasUncommittedEdit: pendingEditRef.current,
            };
        } catch {
            carryRef.current = null;
        }
    };

    // Record title/tags/categories edits even when the editor content is untouched.
    // Skip the initial mount and any change that coincides with a document switch:
    // that is a load, not an edit.
    // Compare tags/categories by value: the `[]` defaults (and fresh arrays from a
    // consumer) change reference every render, which would otherwise re-run this
    // effect on every render instead of only on real metadata edits.
    // And only when the metadata really changed: effects also re-run with nothing changed
    // (React StrictMode on mount, Fast Refresh), which must not arm a commit.
    const metaKey = JSON.stringify([title, tagsKey, categoriesKey]);
    const lastMetaRef = useRef(null);
    useEffect(() => {
        const previous = lastMetaRef.current;
        lastMetaRef.current = { identity: docIdentity, metaKey };
        if (!previous || previous.identity !== docIdentity || previous.metaKey === metaKey) return;
        // Back to what the active version holds (the host applying it after an undo): nothing to record.
        const head = historyRef.current[historyIndexRef.current];
        if (head && sameMetadata(head, { title: titleRef.current, tags: tagsRef.current, categories: categoriesRef.current })) return;
        scheduleCommit();
        metadataPendingRef.current = historyDebounceRef.current !== null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metaKey, docIdentity]);

    // A different document: drop the previous one's history, dirty flag and pending edit.
    useEffect(() => {
        if (committedIdentityRef.current === docIdentity) return;
        committedIdentityRef.current = docIdentity;
        clearPending();
        pendingEditRef.current = false;
        metadataPendingRef.current = false;
        carryRef.current = null;
        // The new document starts from the host's metadata, not what a load gave the previous one.
        titleRef.current = title;
        tagsRef.current = tags;
        categoriesRef.current = categories;
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
    // A freshly (re)created editor can dispatch its own doc-changing transaction as part of
    // @tiptap/react's own mount effects for that editor, which run before this effect's body (the
    // editor is created earlier in this hook). That timer is cleared here, before it can fire a
    // phantom version; a title/tags/categories change armed just before is armed again.
    //
    // React also re-runs effects for the SAME editor: StrictMode on mount, Fast Refresh, an
    // <Activity> shown again before TipTap destroyed the editor. Nothing was replaced then, so
    // nothing is carried, restored or seeded.
    //
    // A replacement editor for the same document gets the document back, quietly (no phantom
    // version, no onContentChange), so the host doesn't reload anything: from what the outgoing
    // editor left, or failing that from the active version (see documentForReplacement).
    //
    // An editor created for a document with `initialContent` (first mount, or a new document)
    // seeds that content as the baseline version.
    //
    // The cleanup records typing still waiting for its timer, read from the editor being torn
    // down, when the document stays the same (the editor is replaced, React tears the effects
    // down for an <Activity> or an unmount, Fast Refresh): nothing typed is lost, and the host
    // hears of it. On a document switch it is dropped (the host flushes before switching).
    const effectEditorRef = useRef(null);
    useEffect(() => {
        const sameInstance = effectEditorRef.current === editor;
        effectEditorRef.current = editor;
        clearPending();
        pendingEditRef.current = false;
        if (!sameInstance && hasView(editor)) {
            // Only a live editor takes what was left: between a destroyed editor and its
            // replacement the hook can render with no editor at all, and the leftover must wait.
            const carry = carryRef.current;
            carryRef.current = null;
            const source = documentForReplacement({
                carry,
                replacement: editor,
                lastSyncedHtml: lastSyncedHtmlRef.current,
                activeEntry: historyRef.current[historyIndexRef.current],
            });
            if (source) {
                // Normally the editor was created holding it (see replacementSource); otherwise
                // (an editor created before the document was known) it is set now.
                if (editor.options.content === source.html) settleQuietly(editor);
                else setContentQuiet(editor, source.html, { exact: true });
                // An edit the outgoing editor never got to commit is committed from here. A document
                // that is back as recorded is the state commits compare against; one holding an edit
                // a guard kept out of the history (a sync, say) keeps comparing against the last
                // recorded state, so that edit is recorded once unguarded.
                if (source.hasUncommittedEdit) scheduleCommit();
                else if (lastSyncedHtmlRef.current === null || source.html === lastSyncedHtmlRef.current) {
                    lastSyncedHtmlRef.current = editor.getHTML();
                }
            } else if (hasInitialContentRef.current && historyRef.current.length === 0) {
                // The editor was built with the content, so no transaction has run yet, and the
                // plugins that normalize on every transaction (the trailing paragraph after a
                // closing heading, list, quote, table...) have not had their say. Let them run now,
                // quietly, so the baseline is the document as it will stay: otherwise the first
                // click adds that paragraph and records a phantom edit.
                settleQuietly(editor);
                const html = editor.getHTML();
                lastSyncedHtmlRef.current = html;
                applyHistory([createEntry('opened', {
                    html, title: titleRef.current, tags: tagsRef.current, categories: categoriesRef.current,
                })], 0);
                setIsDirty(false);
            }
        }
        if (metadataPendingRef.current) scheduleCommit();
        return () => {
            if (docIdentityRef.current !== committedIdentityRef.current) {
                clearPending();
                return;
            }
            // Already destroyed (TipTap replaced it): left pending for the replacement.
            if (hasView(editor)) flushPending(editor);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const loadContentImpl = (html, options = {}) => {
        if (!hasView(editor)) return false;
        const { kind, keepHistory = false, history: persisted, historyIndex: persistedIndex } = options;
        clearPending();
        pendingEditRef.current = false;
        // A load supersedes a title/tags/categories change still waiting to be recorded.
        metadataPendingRef.current = false;
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
        // The active entry's own document is not a change, whatever the editor now serializes it
        // to: loading `stack[i].html` of a persisted stack must not add a version (the editor adds
        // a trailing <p></p> after a closing blockquote, a Markdown renderer leaves newlines, an
        // older release ordered attributes differently). The stored entry is kept as it is;
        // lastSyncedHtmlRef holds the normalized HTML, so later commits still compare correctly.
        const sameContent = !!head && (
            head.html === normalized
            || head.html === html
            || sameDocumentHtml(editor.schema, head.html, html)
        );
        if (sameContent && sameMetadata(head, meta)) {
            applyHistory(base, baseIndex);
        } else {
            const resolvedKind = HISTORY_KINDS.includes(kind) ? kind : (base.length ? 'external' : 'opened');
            applyHistory([...base, createEntry(resolvedKind, { html: normalized, ...meta })], base.length);
        }
        setIsDirty(false);
        return true;
    };
    // A stable function, like the rest of the API: a host effect that lists it as a dependency
    // must not run again (and reload the document) when the editor is recreated.
    const loadContentRef = useRef(loadContentImpl);
    loadContentRef.current = loadContentImpl;
    const loadContent = useCallback((html, options) => loadContentRef.current(html, options), []);

    // Put a version's content in the editor and point at it (undo/redo), telling the host.
    // The version is picked before pending typing is committed, and found again by id after: that
    // commit can push the history over its cap, and evicting the oldest entry shifts every index.
    const moveTo = (index, reason) => {
        if (!hasView(editor)) return false;
        // Pending typing is committed whatever is asked for, as undo() does.
        const targetId = Number.isInteger(index) ? historyRef.current[index]?.id : undefined;
        if (!targetId) { flushPending(); return false; }
        protectedIdsRef.current = [targetId];
        try { flushPending(); } finally { protectedIdsRef.current = []; }
        const resolvedIndex = historyRef.current.findIndex(e => e.id === targetId);
        if (resolvedIndex === -1) return false;
        index = resolvedIndex;
        const target = historyRef.current[index];
        if (index === historyIndexRef.current && editor.getHTML() === lastSyncedHtmlRef.current) return false;
        const resolvedReason = reason ?? (index < historyIndexRef.current ? 'undo' : 'redo');
        setContentQuiet(editor, target.html, { exact: true });
        lastSyncedHtmlRef.current = editor.getHTML();
        applyHistory(historyRef.current, index);
        setIsDirty(true);
        onContentChangeRef.current?.(target, { reason: resolvedReason });
        return true;
    };

    // Restore a version as a NEW entry at the end (the history panel's "Restore Version").
    // The version is taken before pending typing is committed (see moveTo): it is restored even if
    // that commit's cap evicts it.
    const restoreAsNewVersion = (index) => {
        if (!hasView(editor)) return false;
        const target = Number.isInteger(index) ? historyRef.current[index] : undefined;
        if (!target) { flushPending(); return false; }
        const wasActive = index === historyIndexRef.current;
        protectedIdsRef.current = [target.id];
        try { flushPending(); } finally { protectedIdsRef.current = []; }
        const currentHist = historyRef.current;
        if (wasActive && currentHist[historyIndexRef.current]?.id === target.id && editor.getHTML() === lastSyncedHtmlRef.current) return false;
        setContentQuiet(editor, target.html, { exact: true });
        const html = editor.getHTML();
        lastSyncedHtmlRef.current = html;
        const entry = createEntry('restored', {
            html, title: target.title, tags: target.tags, categories: target.categories,
            restoredFrom: currentHist.some(e => e.id === target.id) ? target.id : undefined,
        });
        applyHistory([...currentHist, entry], currentHist.length);
        setIsDirty(true);
        onContentChangeRef.current?.(storedEntry(entry), { reason: 'restore' });
        return true;
    };

    // undo/redo/restoreVersion are stable callbacks that run the latest closures.
    const flushPendingRef = useRef(flushPending);
    flushPendingRef.current = flushPending;
    const moveToRef = useRef(moveTo);
    moveToRef.current = moveTo;
    const restoreAsNewRef = useRef(restoreAsNewVersion);
    restoreAsNewRef.current = restoreAsNewVersion;

    /**
     * Commit pending typing now (onContentChange fires with reason 'edit', as for a debounced
     * commit) and return the stack as it stands, synchronously: the state update renders only
     * later, and a host switching documents in the same handler needs to save the outgoing
     * document's history first. Nothing is committed while read-only, loading or syncing.
     *
     * @returns {{ history: object[], historyIndex: number }}
     */
    const flush = useCallback(() => {
        flushPendingRef.current();
        return { history: historyRef.current, historyIndex: historyIndexRef.current };
    }, []);

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
        // Spread into <InscriptEditor>, the read-only state reaches it too (no editing toolbar).
        isReadonly,
        history,
        setHistory,
        historyIndex,
        setHistoryIndex,
        isDirty,
        setIsDirty,
        // Typing waiting to be recorded counts: undo() records it first and steps back from it (so
        // a freshly opened document can already be undone), and it leaves nothing to redo.
        canUndo: historyIndex > 0 || (hasPendingEdit && historyIndex >= 0),
        canRedo: historyIndex < history.length - 1 && !hasPendingEdit,
        loadContent,
        flush,
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
