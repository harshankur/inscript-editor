import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Diff from 'diff';
import { Redo } from 'lucide-react';
import { getTextContent } from '../utils/getTextContent.js';

export const HistoryView = ({ history, originalHtml, originalTitle: originalTitleProp, originalTags = [], originalCategories = [], current, currentIndex, onSelect }) => {
    const { t, i18n } = useTranslation();
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
                <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">{label}</div>
                <div className="flex flex-wrap gap-1.5">
                    {unchanged.map(item => (
                        <span key={item} className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs border border-zinc-300 dark:border-zinc-700">{item}</span>
                    ))}
                    {forOriginal ? removed.map(item => (
                        <span key={item} className="px-2 py-0.5 rounded bg-red-900/20 text-red-400 text-xs border border-red-900/30 line-through decoration-red-400/50" title="Removed">
                            {item}
                        </span>
                    )) : added.map(item => (
                        <span key={item} className="px-2 py-0.5 rounded bg-emerald-900/20 text-emerald-400 text-xs border border-emerald-900/30 font-bold" title="Added">
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
                <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">{label}</div>
                <div className="flex flex-wrap gap-1.5">
                    {items.map(item => (
                        <span key={item} className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs border border-zinc-300 dark:border-zinc-700">{item}</span>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col md:flex-row h-full bg-white dark:bg-zinc-950">
            {/* History Sidebar - Styled to match main sidebar */}
            <div className="w-full md:w-64 h-56 md:h-auto bg-white dark:bg-zinc-950 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 flex flex-col flex-shrink-0">
                <div className="h-10 md:h-16 flex items-center px-4 md:px-6 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
                        Version History
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-900/30">
                    {history.map((item, idx) => {
                        const isCurrent = idx === currentIndex;
                        const isOriginal = idx === 0;
                        const isSelected = selectedIdx === idx;
                        return (
                            <button
                                key={idx}
                                ref={isSelected ? activeVersionRef : null}
                                onClick={() => setSelectedIdx(idx)}
                                className={`w-full text-left px-4 md:px-6 py-3 md:py-4 border-b border-zinc-200 dark:border-zinc-800/50 flex flex-col gap-1 transition-all ${isSelected
                                    ? 'bg-zinc-50 dark:bg-zinc-900 border-l-2 border-l-emerald-500'
                                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50 border-l-2 border-l-transparent'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-sm font-bold ${isOriginal ? 'text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                        {isOriginal ? 'Original' : `Version ${idx}`}
                                    </span>
                                    {isCurrent && (
                                        <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Active</span>
                                    )}
                                </div>
                                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                                    {new Date(item.timestamp).toLocaleString(i18n.language, {
                                        month: 'short', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="p-2 md:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    <button
                        onClick={() => onSelect(selectedIdx)}
                        className="w-full py-2 md:py-2.5 bg-zinc-100 hover:bg-white text-black font-bold rounded-lg text-xs uppercase tracking-wide transition-colors shadow-lg flex items-center justify-center gap-2"
                    >
                        <span className="md:hidden"><Redo size={14} /></span>
                        Restore Version
                    </button>
                </div>
            </div>

            {/* Diff Area - Flex Col on Mobile (Split Top/Bottom), Grid on Desktop (Split Left/Right) */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="p-2 min-h-12 md:min-h-16 md:p-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center sticky top-0 bg-white dark:bg-zinc-950/95 backdrop-blur z-20">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 pl-1 md:pl-2">Original (Reference)</span>
                    <div className="flex bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 shadow-sm">
                        <button onClick={() => setMode('visual')} className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${mode === 'visual' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>Preview</button>
                        <button onClick={() => setMode('text')} className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${mode === 'text' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>Text</button>
                        <button onClick={() => setMode('source')} className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${mode === 'source' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>Source</button>
                    </div>
                </div>
                <div ref={leftRef} onScroll={handleScroll('left')} className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Title Display/Diff */}
                    <div className="px-4 md:px-8 pt-4 md:pt-6 pb-2 border-b border-zinc-200 dark:border-zinc-800/50">
                        <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Title</div>
                        {mode === 'visual' ? (
                            <div className="text-lg md:text-xl font-bold text-zinc-500 dark:text-zinc-400 mb-4 md:mb-6 break-words">{originalTitleProp}</div>
                        ) : (
                            <div className="text-lg md:text-xl font-bold text-zinc-500 dark:text-zinc-400 font-mono mb-4 md:mb-6 break-words">
                                {diffTitle ? diffTitle.map((part, i) => !part.added && <span key={i} style={part.removed ? { backgroundColor: 'rgba(127,29,29,0.4)', textDecoration: 'line-through' } : {}}>{part.value}</span>) : originalTitleProp}
                            </div>
                        )}

                        {/* Metadata Original/Diff Left */}
                        {mode !== 'visual' ? (
                            <>
                                {renderMetadataDiff(tagDiff, 'Tags', true)}
                                {renderMetadataDiff(catDiff, 'Categories', true)}
                            </>
                        ) : (
                            <>
                                {renderMetadataCurrent(originalTags, 'Tags')}
                                {renderMetadataCurrent(originalCategories, 'Categories')}
                            </>
                        )}
                    </div>
                    <div className="p-4 md:p-8">
                        {mode === 'visual' ? (
                            <div className="prose dark:prose-invert max-w-none prose-sm md:prose-base" dangerouslySetInnerHTML={{ __html: originalHtml }} />
                        ) : (
                            <pre className="font-mono text-xs text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap">{diffSource && diffSource.map((part, i) => !part.added && <span key={i} style={part.removed ? { backgroundColor: 'rgba(127,29,29,0.4)', textDecoration: 'line-through' } : {}}>{part.value}</span>)}</pre>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-50 dark:bg-zinc-900/20">
                <div className="p-2 min-h-12 md:min-h-16 md:p-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-emerald-500 sticky top-0 bg-white dark:bg-zinc-950/95 backdrop-blur z-10">
                    Selected Version ({selectedIdx})
                </div>
                <div ref={rightRef} onScroll={handleScroll('right')} className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Title Display/Diff */}
                    <div className="px-4 md:px-8 pt-4 md:pt-6 pb-2 border-b border-zinc-200 dark:border-zinc-800/50 shrink-0">
                        <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Title</div>
                        {mode === 'visual' ? (
                            <div className="text-lg md:text-xl font-bold text-zinc-900 dark:text-zinc-200 mb-4 md:mb-6 break-words">{selectedState.title}</div>
                        ) : (
                            <div className="text-lg md:text-xl font-bold text-zinc-900 dark:text-zinc-200 font-mono mb-4 md:mb-6 break-words">
                                {diffTitle ? diffTitle.map((part, i) => !part.removed && <span key={i} style={part.added ? { backgroundColor: 'rgba(6,78,59,0.4)' } : {}}>{part.value}</span>) : selectedState.title}
                            </div>
                        )}

                        {/* Metadata Current/Diff Right */}
                        {mode !== 'visual' ? (
                            <>
                                {renderMetadataDiff(tagDiff, 'Tags', false)}
                                {renderMetadataDiff(catDiff, 'Categories', false)}
                            </>
                        ) : (
                            <>
                                {renderMetadataCurrent(selectedState.tags, 'Tags')}
                                {renderMetadataCurrent(selectedState.categories, 'Categories')}
                            </>
                        )}
                    </div>
                    <div className="p-4 md:p-8">
                        {mode === 'visual' ? (
                            <div className="prose dark:prose-invert max-w-none prose-sm md:prose-base" dangerouslySetInnerHTML={{ __html: compareHtml }} />
                        ) : (
                            <pre className="font-mono text-xs text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap">{diffSource && diffSource.map((part, i) => !part.removed && <span key={i} style={part.added ? { backgroundColor: 'rgba(6,78,59,0.4)' } : {}}>{part.value}</span>)}</pre>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
