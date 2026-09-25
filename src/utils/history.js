// Pure helpers for the version history kept by useInscriptEditor. Entries are plain JSON so a
// host can persist a document's stack and hand it back later (loadContent's `history` option).

/** What produced an entry. `opened`/`imported` are baselines (what the document was on load). */
export const HISTORY_KINDS = ['opened', 'imported', 'edited', 'restored', 'external'];
const KIND_SET = new Set(HISTORY_KINDS);
const BASELINE_KINDS = new Set(['opened', 'imported']);

export const DEFAULT_MAX_HISTORY = 200;
/** Measured as the total length of the stored HTML strings. */
export const DEFAULT_MAX_HISTORY_BYTES = 20 * 1024 * 1024;

let counter = 0;
/** A unique entry id (random where the platform offers it, a counter otherwise). */
export function newEntryId() {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch { /* fall through */ }
    counter += 1;
    return `v${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const stringList = value => (Array.isArray(value) ? value.filter(v => typeof v === 'string') : []);

/** A new entry of `kind` with a fresh id and timestamp. */
export function createEntry(kind, { html, title = '', tags = [], categories = [], restoredFrom, parentId } = {}) {
    const entry = {
        id: newEntryId(),
        kind,
        html: html ?? '',
        title: title ?? '',
        tags: stringList(tags),
        categories: stringList(categories),
        timestamp: new Date().toISOString(),
    };
    if (restoredFrom) entry.restoredFrom = restoredFrom;
    if (parentId) entry.parentId = parentId;
    return entry;
}

export const isBaseline = entry => !!entry && BASELINE_KINDS.has(entry.kind);

/** Same title, tags and categories (the non-content half of "did anything change?"). */
export function sameMetadata(a, b) {
    return (a?.title ?? '') === (b?.title ?? '')
        && JSON.stringify(a?.tags ?? []) === JSON.stringify(b?.tags ?? [])
        && JSON.stringify(a?.categories ?? []) === JSON.stringify(b?.categories ?? []);
}

/**
 * Entries a host handed to the deprecated setHistory: each gets an id if it lacks one (ids key
 * the panel and link restored entries to their source). Nothing else is invented, so an entry
 * without a `kind` keeps the old position-based label.
 */
export function withIds(list) {
    const seen = new Set();
    return list.map(entry => {
        if (entry && typeof entry.id === 'string' && entry.id && !seen.has(entry.id)) {
            seen.add(entry.id);
            return entry;
        }
        const copy = { ...entry, id: newEntryId() };
        seen.add(copy.id);
        return copy;
    });
}

/**
 * A persisted stack, validated so a corrupt file can't break the editor: non-entries dropped,
 * fields coerced, duplicate or missing ids replaced, unknown kinds removed, dangling
 * restoredFrom/parentId references dropped, and the index brought into range (default: last).
 */
export function sanitizeHistory(list, index) {
    if (!Array.isArray(list)) return { history: [], index: -1 };
    const seen = new Set();
    const history = [];
    for (const raw of list) {
        if (!raw || typeof raw !== 'object' || typeof raw.html !== 'string') continue;
        const id = typeof raw.id === 'string' && raw.id && !seen.has(raw.id) ? raw.id : newEntryId();
        seen.add(id);
        const stamp = typeof raw.timestamp === 'string' && !Number.isNaN(Date.parse(raw.timestamp))
            ? raw.timestamp : new Date().toISOString();
        const entry = {
            id,
            html: raw.html,
            title: typeof raw.title === 'string' ? raw.title : '',
            tags: stringList(raw.tags),
            categories: stringList(raw.categories),
            timestamp: stamp,
        };
        if (KIND_SET.has(raw.kind)) entry.kind = raw.kind;
        if (typeof raw.restoredFrom === 'string') entry.restoredFrom = raw.restoredFrom;
        if (typeof raw.parentId === 'string') entry.parentId = raw.parentId;
        history.push(entry);
    }
    const ids = new Set(history.map(e => e.id));
    for (const entry of history) {
        if (entry.restoredFrom && !ids.has(entry.restoredFrom)) delete entry.restoredFrom;
        if (entry.parentId && !ids.has(entry.parentId)) delete entry.parentId;
    }
    const last = history.length - 1;
    const resolved = Number.isInteger(index) && index >= 0 && index <= last ? index : last;
    return { history, index: resolved };
}

/**
 * Apply the cap: evict the oldest entries until both limits hold, but never the baseline (an
 * `opened`/`imported` first entry, "what I opened") and never the entry the pointer is on. The
 * pointer keeps pointing at the same entry, and references to evicted entries are dropped.
 */
export function capHistory(history, index, { maxHistory = DEFAULT_MAX_HISTORY, maxHistoryBytes = DEFAULT_MAX_HISTORY_BYTES } = {}) {
    const maxCount = Number.isFinite(maxHistory) && maxHistory > 0 ? Math.max(2, Math.floor(maxHistory)) : Infinity;
    const maxBytes = Number.isFinite(maxHistoryBytes) && maxHistoryBytes > 0 ? maxHistoryBytes : Infinity;
    let bytes = 0;
    for (const entry of history) bytes += entry.html?.length ?? 0;
    if (history.length <= maxCount && bytes <= maxBytes) return { history, index };

    const pointed = history[index];
    const protectedFirst = isBaseline(history[0]) ? history[0] : null;
    const kept = [...history];
    const evicted = new Set();
    let cursor = 0;
    while ((kept.length > maxCount || bytes > maxBytes) && cursor < kept.length) {
        const entry = kept[cursor];
        if (entry === protectedFirst || entry === pointed) { cursor += 1; continue; }
        kept.splice(cursor, 1);
        evicted.add(entry.id);
        bytes -= entry.html?.length ?? 0;
    }
    const cleaned = kept.map(entry => {
        if (!evicted.has(entry.restoredFrom) && !evicted.has(entry.parentId)) return entry;
        const copy = { ...entry };
        if (evicted.has(copy.restoredFrom)) delete copy.restoredFrom;
        if (evicted.has(copy.parentId)) delete copy.parentId;
        return copy;
    });
    const nextIndex = pointed ? kept.indexOf(pointed) : Math.min(index, cleaned.length - 1);
    return { history: cleaned, index: nextIndex };
}

/**
 * A key for the serializable part of editorOptions: changing it recreates the editor so the
 * new options apply. Functions count by presence only (their identity changes every render;
 * the hook reads the live ones through refs), and the internal refs are skipped.
 */
export function editorOptionsKey(options) {
    try {
        return JSON.stringify(options ?? {}, (key, value) => {
            if (key === 'hostHandlersRef' || key === 'liveOptionsRef') return undefined;
            return typeof value === 'function' ? '[fn]' : value;
        });
    } catch {
        return '[unserializable]';
    }
}
