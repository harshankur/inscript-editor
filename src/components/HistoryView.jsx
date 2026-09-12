import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Diff from 'diff';
import { Redo } from 'lucide-react';
import { getTextContent } from '../utils/getTextContent.js';
import { useInscriptEditorTranslations } from '../hooks/useInscriptEditorTranslations.js';

export const HistoryView = ({ history, originalHtml, originalTitle: originalTitleProp, originalTags = [], originalCategories = [], current, currentIndex, onSelect }) => {
    useInscriptEditorTranslations();
    const { t, i18n } = useTranslation('inscript-editor');
    const [selectedIdx, setSelectedIdx] = useState(currentIndex);
    const [mode, setMode] = useState('visual'); // 'visual' | 'source' | 'text'

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
    }, [selectedIdx]);

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

    const selectedState = history[selectedIdx] || {};
    const compareHtml = selectedState.html || '';

    const diffSource = useMemo(() => {
        if (mode === 'visual') return null;
        if (mode === 'source') {
            return Diff.diffLines(originalHtml || '', compareHtml);
        }
        if (mode === 'text') {
            return Diff.diffWords(getTextContent(originalHtml || ''), getTextContent(compareHtml));
        }
        return null;
    }, [originalHtml, compareHtml, mode]);

    // Calculate Title Diff
    const diffTitle = useMemo(() => {
        if (mode === 'visual') return null;
        const originalTitle = typeof originalTitleProp === 'string' ? originalTitleProp : '';
        const compareTitle = selectedState.title || '';
        return Diff.diffWords(originalTitle, compareTitle);
    }, [originalTitleProp, selectedState.title, mode]);

    // Helper for Array Diff
    const getArrayDiff = (oldArr = [], newArr = []) => {
        const added = newArr.filter(x => !oldArr.includes(x));
        const removed = oldArr.filter(x => !newArr.includes(x));
        const unchanged = oldArr.filter(x => newArr.includes(x));
        return { added, removed, unchanged };
    };

    const tagDiff = useMemo(() => getArrayDiff(originalTags, selectedState.tags), [originalTags, selectedState.tags]);
    const catDiff = useMemo(() => getArrayDiff(originalCategories, selectedState.categories), [originalCategories, selectedState.categories]);

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
                    {history.map((item, idx) => {
                        const isCurrent = idx === currentIndex;
                        const isOriginal = idx === 0;
                        const isSelected = selectedIdx === idx;
                        return (
                            <button
                                key={idx}
                                ref={isSelected ? activeVersionRef : null}
                                onClick={() => setSelectedIdx(idx)}
                                className={`w-full text-left px-4 md:px-6 py-3 md:py-4 border-b border-[var(--inscript-color-border)] flex flex-col gap-1 transition-all ${isSelected
                                    ? 'bg-[var(--inscript-color-active)] border-l-2 border-l-[var(--inscript-color-accent)]'
                                    : 'hover:bg-[var(--inscript-color-hover)] border-l-2 border-l-transparent'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-sm font-bold ${isOriginal ? 'text-blue-400' : 'text-[var(--inscript-color-text)]'}`}>
                                        {isOriginal ? t('original', 'Original') : t('version', 'Version {{n}}', { n: idx })}
                                    </span>
                                    {isCurrent && (
                                        <span className="text-[10px] bg-[var(--inscript-color-accent-soft)] text-[var(--inscript-color-accent)] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{t('active', 'Active')}</span>
                                    )}
                                </div>
                                <span className="text-[10px] font-mono text-[var(--inscript-color-muted)]">
                                    {new Date(item.timestamp).toLocaleString(i18n.language, {
                                        month: 'short', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="p-2 md:p-4 border-t border-[var(--inscript-color-border)] bg-[var(--inscript-color-surface-raised)]">
                    <button
                        onClick={() => onSelect(selectedIdx)}
                        className="w-full py-2 md:py-2.5 bg-[var(--inscript-color-text)] hover:opacity-90 text-[var(--inscript-color-surface)] font-bold rounded-lg text-xs uppercase tracking-wide transition-colors shadow-lg flex items-center justify-center gap-2"
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
                    <div className="px-4 md:px-8 pt-4 md:pt-6 pb-2 border-b border-[var(--inscript-color-border)]">
                        <div className="text-xs font-bold text-[var(--inscript-color-muted)] uppercase tracking-wider mb-2">{t('title', 'Title')}</div>
                        {mode === 'visual' ? (
                            <div className="text-lg md:text-xl font-bold text-[var(--inscript-color-muted)] mb-4 md:mb-6 break-words">{originalTitleProp}</div>
                        ) : (
                            <div className="text-lg md:text-xl font-bold text-[var(--inscript-color-muted)] font-mono mb-4 md:mb-6 break-words">
                                {diffTitle ? diffTitle.map((part, i) => !part.added && <span key={i} style={part.removed ? { backgroundColor: 'rgba(127,29,29,0.4)', textDecoration: 'line-through' } : {}}>{part.value}</span>) : originalTitleProp}
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
                                {renderMetadataCurrent(originalTags, t('tags', 'Tags'))}
                                {renderMetadataCurrent(originalCategories, t('categories', 'Categories'))}
                            </>
                        )}
                    </div>
                    <div className="p-4 md:p-8">
                        {mode === 'visual' ? (
                            <div className="prose dark:prose-invert max-w-none prose-sm md:prose-base" dangerouslySetInnerHTML={{ __html: originalHtml }} />
                        ) : (
                            <pre className="font-mono text-xs text-[var(--inscript-color-muted)] whitespace-pre-wrap">{diffSource && diffSource.map((part, i) => !part.added && <span key={i} style={part.removed ? { backgroundColor: 'rgba(127,29,29,0.4)', textDecoration: 'line-through' } : {}}>{part.value}</span>)}</pre>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[var(--inscript-color-surface-raised)]">
                <div className="p-2 min-h-12 md:min-h-16 md:p-3 bg-[var(--inscript-color-surface-raised)] border-b border-[var(--inscript-color-border)] flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-[var(--inscript-color-accent)] sticky top-0 bg-[var(--inscript-color-surface)] backdrop-blur z-10">
                    {t('selectedVersion', 'Selected Version ({{n}})', { n: selectedIdx })}
                </div>
                <div ref={rightRef} onScroll={handleScroll('right')} className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Title Display/Diff */}
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
                    <div className="p-4 md:p-8">
                        {mode === 'visual' ? (
                            <div className="prose dark:prose-invert max-w-none prose-sm md:prose-base" dangerouslySetInnerHTML={{ __html: compareHtml }} />
                        ) : (
                            <pre className="font-mono text-xs text-[var(--inscript-color-text)] whitespace-pre-wrap">{diffSource && diffSource.map((part, i) => !part.removed && <span key={i} style={part.added ? { backgroundColor: 'rgba(6,78,59,0.4)' } : {}}>{part.value}</span>)}</pre>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
