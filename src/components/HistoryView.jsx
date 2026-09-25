import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Diff from 'diff';
import { Redo } from 'lucide-react';
import { getTextContent } from '../utils/getTextContent.js';
import { inertPreviewHtml } from '../utils/previewHtml.js';
import { useInscriptEditorTranslations } from '../hooks/useInscriptEditorTranslations.js';

const BASELINE_KINDS = new Set(['opened', 'imported']);

const RELATIVE_UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];

/** "2 minutes ago" style, in the UI language; "now" under ten seconds. */
function relativeTime(date, now, language) {
    let format;
    try { format = new Intl.RelativeTimeFormat(language || undefined, { numeric: 'auto' }); }
    catch { format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }); }
    const diff = Math.round((date.getTime() - now) / 1000);
    if (Math.abs(diff) < 10) return format.format(0, 'second');
    for (const [unit, seconds] of RELATIVE_UNITS) {
        if (Math.abs(diff) >= seconds) return format.format(Math.round(diff / seconds), unit);
    }
    return format.format(0, 'second');
}

/**
 * The version history panel: the list of versions, and the selected one compared with the
 * reference (by default the first version, the document as opened).
 *
 * Previews are inert (embeds become placeholders, nothing runs) and styled by the editor's own
 * content rules, so a version looks like the document. `originalHtml` is rendered as markup, so
 * it must be editor-serialized HTML (from getHTML() or a history entry).
 */
export const HistoryView = ({
    history = [],
    originalHtml,
    originalTitle: originalTitleProp,
    originalTags: originalTagsProp,
    originalCategories: originalCategoriesProp,
    currentIndex = -1,
    onSelect,
}) => {
    useInscriptEditorTranslations();
    const { t, i18n } = useTranslation('inscript-editor');
    const hasEntries = history.length > 0;
    const clampIndex = (index) => (hasEntries ? Math.min(Math.max(index, 0), history.length - 1) : -1);
    const [selectedIdx, setSelectedIdx] = useState(() => clampIndex(currentIndex));
    const [mode, setMode] = useState('visual'); // 'visual' | 'source' | 'text'
    const [now, setNow] = useState(() => Date.now());

    // Follow the active version when it (or the list) changes, e.g. after an undo while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { setSelectedIdx(clampIndex(currentIndex)); }, [currentIndex, history]);
    // Keep the relative timestamps current while the panel is open.
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(id);
    }, []);
    // Clamped at render too, so a shrunken list never shows a selection outside it.
    const selected = clampIndex(selectedIdx);

    // Sync Scrolling Refs
    const leftRef = useRef(null);
    const rightRef = useRef(null);
    const activeVersionRef = useRef(null);
    const isScrolling = useRef(false);

    // Auto-scroll to selected version
    useEffect(() => {
        if (activeVersionRef.current) {
            activeVersionRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selected]);

    const handleScroll = (source) => (e) => {
        if (isScrolling.current) return;
        isScrolling.current = true;
        const target = source === 'left' ? rightRef.current : leftRef.current;
        if (target) {
            const percentage = e.target.scrollTop / (e.target.scrollHeight - e.target.clientHeight);
            if (Number.isFinite(percentage)) {
                target.scrollTop = percentage * (target.scrollHeight - target.clientHeight);
            }
        }
        setTimeout(() => { isScrolling.current = false; }, 50);
    };

    // The reference defaults to the first version (the document as opened).
    const baseline = history[0] || {};
    const refHtml = originalHtml ?? baseline.html ?? '';
    const refTitle = originalTitleProp ?? baseline.title ?? '';
    const refTags = originalTagsProp ?? baseline.tags ?? [];
    const refCategories = originalCategoriesProp ?? baseline.categories ?? [];

    const selectedState = history[selected] || {};
    const compareHtml = selectedState.html || '';

    // Hosts that keep metadata out of history get no empty Title/Tags/Categories rows.
    const tracksMetadata = [{ title: refTitle, tags: refTags, categories: refCategories }, ...history]
        .some(e => (typeof e.title === 'string' && e.title.trim()) || e.tags?.length || e.categories?.length);

    // Labels follow each entry's kind, not its position. Entries without a kind (hand-made or
    // pre-0.4) keep the old position-based labels.
    const numbered = BASELINE_KINDS.has(history[0]?.kind) || (history[0] && !history[0].kind);
    const labelFor = (idx, depth = 0) => {
        const entry = history[idx];
        if (!entry) return '';
        switch (entry.kind) {
            case 'opened': return t('historyOpened', 'Opened');
            case 'imported': return t('historyImported', 'Imported');
            case 'external': return t('historyChangedOutside', 'Changed outside the app');
            case 'restored': {
                const source = history.findIndex(e => e.id && e.id === entry.restoredFrom);
                return source >= 0 && depth === 0
                    ? t('historyRestoredFrom', 'Restored from {{label}}', { label: labelFor(source, depth + 1) })
                    : t('historyRestored', 'Restored');
            }
            case 'edited': return t('version', 'Version {{n}}', { n: numbered ? idx : idx + 1 });
            default: return idx === 0 ? t('original', 'Original') : t('version', 'Version {{n}}', { n: idx });
        }
    };

    const previewPlaceholder = (source) => t('historyEmbedPlaceholder', 'Embedded content: {{source}}', { source: source || '?' });
    const refPreview = useMemo(() => (mode === 'visual' ? inertPreviewHtml(refHtml, previewPlaceholder) : ''),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [refHtml, mode, i18n.language]);
    const comparePreview = useMemo(() => (mode === 'visual' ? inertPreviewHtml(compareHtml, previewPlaceholder) : ''),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [compareHtml, mode, i18n.language]);

    const diffSource = useMemo(() => {
        if (mode === 'visual') return null;
        if (mode === 'source') {
            return Diff.diffLines(refHtml || '', compareHtml);
        }
        if (mode === 'text') {
            return Diff.diffWords(getTextContent(refHtml || ''), getTextContent(compareHtml));
        }
        return null;
    }, [refHtml, compareHtml, mode]);

    // Calculate Title Diff
    const diffTitle = useMemo(() => {
        if (mode === 'visual') return null;
        const originalTitle = typeof refTitle === 'string' ? refTitle : '';
        const compareTitle = selectedState.title || '';
        return Diff.diffWords(originalTitle, compareTitle);
    }, [refTitle, selectedState.title, mode]);

    // Helper for Array Diff
    const getArrayDiff = (oldArr = [], newArr = []) => {
        const added = newArr.filter(x => !oldArr.includes(x));
        const removed = oldArr.filter(x => !newArr.includes(x));
        const unchanged = oldArr.filter(x => newArr.includes(x));
        return { added, removed, unchanged };
    };

    const tagDiff = useMemo(() => getArrayDiff(refTags, selectedState.tags), [refTags, selectedState.tags]);
    const catDiff = useMemo(() => getArrayDiff(refCategories, selectedState.categories), [refCategories, selectedState.categories]);

    const renderMetadataDiff = (diff, label, forOriginal) => {
        if (!diff) return null;
        const { added, removed, unchanged } = diff;
        if (added.length === 0 && removed.length === 0 && unchanged.length === 0) return null;

        return (
            <div className="mb-4">
                <div className="text-[10px] font-bold text-[var(--inscript-color-muted)] uppercase tracking-wider mb-1.5">{label}</div>
                <div className="flex flex-wrap gap-1.5">
                    {unchanged.map(item => (
                        <span key={item} className="px-2 py-0.5 rounded bg-[var(--inscript-color-surface-raised)] text-[var(--inscript-color-muted)] text-xs border border-[var(--inscript-color-border-strong)]">{item}</span>
                    ))}
                    {forOriginal ? removed.map(item => (
                        <span key={item} className="px-2 py-0.5 rounded bg-red-900/20 text-red-400 text-xs border border-red-900/30 line-through decoration-red-400/50" title={t('removed', 'Removed')}>
                            {item}
                        </span>
                    )) : added.map(item => (
                        <span key={item} className="px-2 py-0.5 rounded bg-emerald-900/20 text-emerald-400 text-xs border border-emerald-900/30 font-bold" title={t('added', 'Added')}>
                            + {item}
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    const renderMetadataCurrent = (items = [], label) => {
        if (!items || items.length === 0) return null;
        return (
            <div className="mb-4">
                <div className="text-[10px] font-bold text-[var(--inscript-color-muted)] uppercase tracking-wider mb-1.5">{label}</div>
                <div className="flex flex-wrap gap-1.5">
                    {items.map(item => (
                        <span key={item} className="px-2 py-0.5 rounded bg-[var(--inscript-color-surface-raised)] text-[var(--inscript-color-text)] text-xs border border-[var(--inscript-color-border-strong)]">{item}</span>
                    ))}
                </div>
            </div>
        );
    };

    const canRestore = hasEntries && selected !== currentIndex && typeof onSelect === 'function';

    return (
        <div className="flex flex-col md:flex-row h-full bg-[var(--inscript-color-surface)]">
            {/* History Sidebar - Styled to match main sidebar */}
            <div className="w-full md:w-64 h-56 md:h-auto bg-[var(--inscript-color-surface)] border-b md:border-b-0 md:border-r border-[var(--inscript-color-border)] flex flex-col flex-shrink-0">
                <div className="h-10 md:h-16 flex items-center px-4 md:px-6 border-b border-[var(--inscript-color-border)]">
                    <span className="font-bold text-[var(--inscript-color-muted)] text-xs uppercase tracking-wider">
                        {t('versionHistory', 'Version History')}
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto bg-[var(--inscript-color-surface-raised)]">
                    {!hasEntries && (
                        <p className="px-4 md:px-6 py-4 text-sm text-[var(--inscript-color-muted)]">
                            {t('historyEmpty', 'No versions yet. Versions are recorded as you edit.')}
                        </p>
                    )}
                    {history.map((item, idx) => {
                        const isCurrent = idx === currentIndex;
                        const isBaseline = BASELINE_KINDS.has(item.kind) || (!item.kind && idx === 0);
                        const isSelected = selected === idx;
                        const date = new Date(item.timestamp);
                        const validDate = !Number.isNaN(date.getTime());
                        return (
                            <button
                                key={item.id ?? idx}
                                ref={isSelected ? activeVersionRef : null}
                                onClick={() => setSelectedIdx(idx)}
                                aria-pressed={isSelected}
                                className={`w-full text-left px-4 md:px-6 py-3 md:py-4 border-b border-[var(--inscript-color-border)] flex flex-col gap-1 transition-all ${isSelected
                                    ? 'bg-[var(--inscript-color-active)] border-l-2 border-l-[var(--inscript-color-accent)]'
                                    : 'hover:bg-[var(--inscript-color-hover)] border-l-2 border-l-transparent'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-1 gap-2">
                                    <span className={`text-sm font-bold ${isBaseline ? 'text-[var(--inscript-color-link)]' : 'text-[var(--inscript-color-text)]'}`}>
                                        {labelFor(idx)}
                                    </span>
                                    {isCurrent && (
                                        <span className="text-[10px] bg-[var(--inscript-color-accent-soft)] text-[var(--inscript-color-accent)] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{t('active', 'Active')}</span>
                                    )}
                                </div>
                                {validDate && (
                                    <time
                                        dateTime={item.timestamp}
                                        title={date.toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'medium' })}
                                        className="text-[10px] font-mono text-[var(--inscript-color-muted)]"
                                    >
                                        {relativeTime(date, now, i18n.language)}
                                    </time>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="p-2 md:p-4 border-t border-[var(--inscript-color-border)] bg-[var(--inscript-color-surface-raised)]">
                    <button
                        onClick={() => { if (canRestore) onSelect(selected, history[selected]); }}
                        disabled={!canRestore}
                        className="w-full py-2 md:py-2.5 bg-[var(--inscript-color-text)] hover:opacity-90 text-[var(--inscript-color-surface)] font-bold rounded-lg text-xs uppercase tracking-wide transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        <span className="md:hidden"><Redo size={14} /></span>
                        {t('restoreVersion', 'Restore Version')}
                    </button>
                </div>
            </div>

            {/* Diff Area - Flex Col on Mobile (Split Top/Bottom), Grid on Desktop (Split Left/Right) */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="p-2 min-h-12 md:min-h-16 md:p-3 bg-[var(--inscript-color-surface-raised)] border-b border-[var(--inscript-color-border)] flex justify-between items-center sticky top-0 bg-[var(--inscript-color-surface)] backdrop-blur z-20">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--inscript-color-muted)] pl-1 md:pl-2">{t('originalReference', 'Original (Reference)')}</span>
                    <div className="flex bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border)] rounded-lg p-0.5 shadow-sm">
                        <button onClick={() => setMode('visual')} className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${mode === 'visual' ? 'bg-[var(--inscript-color-active)] text-[var(--inscript-color-text)] shadow-sm' : 'text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)]'}`}>{t('preview', 'Preview')}</button>
                        <button onClick={() => setMode('text')} className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${mode === 'text' ? 'bg-[var(--inscript-color-active)] text-[var(--inscript-color-text)] shadow-sm' : 'text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)]'}`}>{t('text', 'Text')}</button>
                        <button onClick={() => setMode('source')} className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${mode === 'source' ? 'bg-[var(--inscript-color-active)] text-[var(--inscript-color-text)] shadow-sm' : 'text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)]'}`}>{t('source', 'Source')}</button>
                    </div>
                </div>
                <div ref={leftRef} onScroll={handleScroll('left')} className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Title Display/Diff */}
                    {tracksMetadata && (
                        <div className="px-4 md:px-8 pt-4 md:pt-6 pb-2 border-b border-[var(--inscript-color-border)]">
                            <div className="text-xs font-bold text-[var(--inscript-color-muted)] uppercase tracking-wider mb-2">{t('title', 'Title')}</div>
                            {mode === 'visual' ? (
                                <div className="text-lg md:text-xl font-bold text-[var(--inscript-color-muted)] mb-4 md:mb-6 break-words">{refTitle}</div>
                            ) : (
                                <div className="text-lg md:text-xl font-bold text-[var(--inscript-color-muted)] font-mono mb-4 md:mb-6 break-words">
                                    {diffTitle ? diffTitle.map((part, i) => !part.added && <span key={i} style={part.removed ? { backgroundColor: 'rgba(127,29,29,0.4)', textDecoration: 'line-through' } : {}}>{part.value}</span>) : refTitle}
                                </div>
                            )}

                            {/* Metadata Original/Diff Left */}
                            {mode !== 'visual' ? (
                                <>
                                    {renderMetadataDiff(tagDiff, t('tags', 'Tags'), true)}
                                    {renderMetadataDiff(catDiff, t('categories', 'Categories'), true)}
                                </>
                            ) : (
                                <>
                                    {renderMetadataCurrent(refTags, t('tags', 'Tags'))}
                                    {renderMetadataCurrent(refCategories, t('categories', 'Categories'))}
                                </>
                            )}
                        </div>
                    )}
                    <div className="p-4 md:p-8">
                        {mode === 'visual' ? (
                            <div className="ProseMirror inscript-history-preview" data-history-preview="reference" dangerouslySetInnerHTML={{ __html: refPreview }} />
                        ) : (
                            <pre className="font-mono text-xs text-[var(--inscript-color-muted)] whitespace-pre-wrap">{diffSource && diffSource.map((part, i) => !part.added && <span key={i} style={part.removed ? { backgroundColor: 'rgba(127,29,29,0.4)', textDecoration: 'line-through' } : {}}>{part.value}</span>)}</pre>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[var(--inscript-color-surface-raised)]">
                <div className="p-2 min-h-12 md:min-h-16 md:p-3 bg-[var(--inscript-color-surface-raised)] border-b border-[var(--inscript-color-border)] flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-[var(--inscript-color-accent)] sticky top-0 bg-[var(--inscript-color-surface)] backdrop-blur z-10">
                    {hasEntries && t('selectedVersion', 'Selected Version ({{n}})', { n: labelFor(selected) })}
                </div>
                <div ref={rightRef} onScroll={handleScroll('right')} className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Title Display/Diff */}
                    {tracksMetadata && hasEntries && (
                        <div className="px-4 md:px-8 pt-4 md:pt-6 pb-2 border-b border-[var(--inscript-color-border)] shrink-0">
                            <div className="text-xs font-bold text-[var(--inscript-color-accent)] uppercase tracking-wider mb-2">{t('title', 'Title')}</div>
                            {mode === 'visual' ? (
                                <div className="text-lg md:text-xl font-bold text-[var(--inscript-color-text)] mb-4 md:mb-6 break-words">{selectedState.title}</div>
                            ) : (
                                <div className="text-lg md:text-xl font-bold text-[var(--inscript-color-text)] font-mono mb-4 md:mb-6 break-words">
                                    {diffTitle ? diffTitle.map((part, i) => !part.removed && <span key={i} style={part.added ? { backgroundColor: 'rgba(6,78,59,0.4)' } : {}}>{part.value}</span>) : selectedState.title}
                                </div>
                            )}

                            {/* Metadata Current/Diff Right */}
                            {mode !== 'visual' ? (
                                <>
                                    {renderMetadataDiff(tagDiff, t('tags', 'Tags'), false)}
                                    {renderMetadataDiff(catDiff, t('categories', 'Categories'), false)}
                                </>
                            ) : (
                                <>
                                    {renderMetadataCurrent(selectedState.tags, t('tags', 'Tags'))}
                                    {renderMetadataCurrent(selectedState.categories, t('categories', 'Categories'))}
                                </>
                            )}
                        </div>
                    )}
                    <div className="p-4 md:p-8">
                        {mode === 'visual' ? (
                            <div className="ProseMirror inscript-history-preview" data-history-preview="selected" dangerouslySetInnerHTML={{ __html: comparePreview }} />
                        ) : (
                            <pre className="font-mono text-xs text-[var(--inscript-color-text)] whitespace-pre-wrap">{diffSource && diffSource.map((part, i) => !part.removed && <span key={i} style={part.added ? { backgroundColor: 'rgba(6,78,59,0.4)' } : {}}>{part.value}</span>)}</pre>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
