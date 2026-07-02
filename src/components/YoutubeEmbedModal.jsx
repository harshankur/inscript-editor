import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Filter, Plus, X, Youtube as YoutubeIcon } from 'lucide-react';
import { InlineNotice } from './InlineNotice.jsx';
import { extractYoutubeId } from '../utils/youtubeUrl.js';
import { useInscriptEditorTranslations } from '../hooks/useInscriptEditorTranslations.js';

export const YoutubeEmbedModal = ({ isOpen, onClose, onConfirm, onSearch }) => {
    useInscriptEditorTranslations();
    const { t } = useTranslation('inscript-editor');
    const [activeTab, setActiveTab] = useState('link'); // 'link' or 'search'
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [linkInput, setLinkInput] = useState('');
    const [previewId, setPreviewId] = useState(null);

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setResults([]);
            setSearchError(null);
            setLinkInput('');
            setPreviewId(null);
        }
    }, [isOpen]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!query.trim() || !onSearch) return;

        setSearching(true);
        setSearchError(null);
        try {
            const items = await onSearch(query);
            setResults(items || []);
        } catch (err) {
            setResults([]);
            setSearchError(t('searchFailedMessage', 'Search failed. Please try again, or use the Direct Link tab instead.'));
        } finally {
            setSearching(false);
        }
    };

    useEffect(() => {
        const id = extractYoutubeId(linkInput);
        setPreviewId(id);
    }, [linkInput]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-zinc-900 dark:text-white">
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col h-[80vh]">
                {/* Header */}
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 text-red-500 rounded-lg">
                            <YoutubeIcon size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">{t('embedYoutube', 'Embed YouTube Video')}</h3>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500">{t('searchOrPasteLink', 'Search or paste a link to embed')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-6 pt-2 border-b border-zinc-200 dark:border-zinc-800 gap-6">
                    <button
                        onClick={() => setActiveTab('link')}
                        className={`py-3 text-sm font-medium border-b-2 transition-all ${activeTab === 'link' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                        {t('directLink', 'Direct Link')}
                    </button>
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`py-3 text-sm font-medium border-b-2 transition-all ${activeTab === 'search' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                        {t('searchYoutubeExperimental', 'Search YouTube (Experimental)')}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {activeTab === 'search' ? (
                        <div className="space-y-6">
                            <form onSubmit={handleSearch} className="relative">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder={t('searchForVideosPlaceholder', 'Search for videos...')}
                                    className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl py-3 pl-4 pr-12 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all shadow-inner"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    disabled={searching}
                                    className="absolute right-2 top-2 p-1.5 bg-emerald-500 text-zinc-950 rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
                                >
                                    <Filter size={18} />
                                </button>
                            </form>

                            <InlineNotice variant="warning" title={t('experimentalFeature', 'Experimental Feature')}>
                                <Trans i18nKey="experimentalFeatureDescription" ns="inscript-editor">
                                    External search uses public proxy instances which can be unreliable. If search fails, please use the <strong>Direct Link</strong> tab instead.
                                </Trans>
                            </InlineNotice>

                            {searchError && (
                                <InlineNotice variant="error" title={t('searchFailedTitle', 'Search Failed')}>
                                    {searchError}
                                </InlineNotice>
                            )}

                            {searching ? (
                                <div className="grid grid-cols-2 gap-4 animate-pulse">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="space-y-2">
                                            <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
                                            <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4" />
                                        </div>
                                    ))}
                                </div>
                            ) : results.length > 0 ? (
                                <div className="grid grid-cols-2 gap-4">
                                    {results.map((video) => (
                                        <button
                                            key={video.url}
                                            onClick={() => {
                                                const id = extractYoutubeId(video.url);
                                                if (id) onConfirm(id);
                                            }}
                                            className="group text-left space-y-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 p-2 rounded-xl transition-all"
                                        >
                                            <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                                <img
                                                    src={video.thumbnail}
                                                    alt={video.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <Plus size={32} className="text-zinc-900 dark:text-white bg-emerald-500 rounded-full p-2" />
                                                </div>
                                                <span className="absolute bottom-2 right-2 bg-black/80 text-[10px] px-1.5 py-0.5 rounded font-mono">
                                                    {video.duration ? Math.floor(video.duration / 60) + ':' + (video.duration % 60).toString().padStart(2, '0') : ''}
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-medium line-clamp-2 leading-tight group-hover:text-emerald-400 transition-colors">{video.title}</h4>
                                                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                                                    {video.uploaderName} • {t('viewsSuffix', '{{views}} views', { views: video.views?.toLocaleString() })}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : query && !searching ? (
                                <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 italic">{t('noVideosFound', 'No videos found. Try a different search.')}</div>
                            ) : (
                                <div className="text-center py-12 flex flex-col items-center gap-4 text-zinc-400 dark:text-zinc-500">
                                    <YoutubeIcon size={48} className="opacity-10" />
                                    <p>{t('enterTopicPrompt', 'Enter a topic or video name to find content')}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 block">{t('videoUrlOrId', 'Video URL or ID')}</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder={t('videoUrlPlaceholder', 'https://youtube.com/watch?v=...')}
                                    className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl py-3 px-4 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all shadow-inner"
                                    value={linkInput}
                                    onChange={(e) => setLinkInput(e.target.value)}
                                />
                            </div>

                            {previewId ? (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">{t('livePreview', 'Live Preview')}</label>
                                    <div className="aspect-video rounded-xl overflow-hidden bg-black ring-1 ring-zinc-800 relative shadow-2xl">
                                        <iframe
                                            src={`https://www.youtube.com/embed/${previewId}?controls=0&modestbranding=1`}
                                            className="w-full h-full"
                                            title={t('preview', 'Preview')}
                                        />
                                        <div className="absolute inset-0 z-10 pointer-events-none border-2 border-emerald-500/30 rounded-xl" />
                                    </div>
                                    <p className="text-[10px] text-emerald-500 font-mono text-center">{t('detectedId', 'Detected ID: {{id}}', { id: previewId })}</p>
                                </div>
                            ) : linkInput.trim() && (
                                <InlineNotice variant="warning">
                                    {t('noValidIdDetected', 'No valid YouTube ID detected. Paste a full YouTube URL or an 11-character video ID.')}
                                </InlineNotice>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-white dark:bg-zinc-950/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">{t('cancel', 'Cancel')}</button>
                    <button
                        onClick={() => previewId && onConfirm(previewId)}
                        disabled={!previewId}
                        className="px-6 py-2 bg-emerald-500 text-zinc-950 rounded-lg text-sm font-bold hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                        {t('insertVideo', 'Insert Video')}
                    </button>
                </div>
            </div>
        </div>
    );
};
