import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Filter, Plus, X, SquarePlay as YoutubeIcon } from 'lucide-react';
import { InlineNotice } from './InlineNotice.jsx';
import { extractYoutubeId, youtubeEmbedUrl } from '../utils/youtubeUrl.js';
import { buildYoutubeConsent, YOUTUBE_CONSENT_DEFAULTS } from '../utils/youtubeConsent.js';

/**
 * The emphasized part of a translated sentence. A translation can put attributes on its tags
 * (`<1 class="…" style="…">`), and react-i18next hands them to the element as props: this renders
 * only the text, so a translation can neither style the page nor crash it (a string `style`).
 */
/** A duration in seconds as m:ss (h:mm:ss past an hour), whole seconds; '' when unknown. */
export function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '';
    const total = Math.round(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const EmphasisText = ({ children }) => <strong>{children}</strong>;
import { useInscriptEditorTranslations } from '../hooks/useInscriptEditorTranslations.js';

// The query the live preview's player is loaded with.
const PREVIEW_PLAYER_QUERY = '?controls=0&modestbranding=1';

// The same consent placeholder the editor's videos show (facade: 'local'), mounted into React.
// It is plain DOM built once per set of labels; the callbacks are read through refs, so a new
// function identity never rebuilds it.
function YoutubeConsentPreview({ labels, onLoad, privacyUrl, onOpenExternal }) {
    const hostRef = useRef(null);
    const onLoadRef = useRef(onLoad);
    const openerRef = useRef(onOpenExternal);
    useEffect(() => { onLoadRef.current = onLoad; }, [onLoad]);
    useEffect(() => { openerRef.current = onOpenExternal; }, [onOpenExternal]);
    const { title, text, load, privacy } = labels;
    useEffect(() => {
        const element = buildYoutubeConsent({
            labels: { title, text, load, privacy },
            onLoad: () => onLoadRef.current(),
            privacyUrl,
            getOpenExternal: () => openerRef.current,
        });
        hostRef.current.appendChild(element);
        return () => element.remove();
    }, [title, text, load, privacy, privacyUrl]);
    // display: contents, so the placeholder fills the preview box itself.
    return <div ref={hostRef} className="contents" />;
}

// The live preview loads nothing until the user presses "Load preview" on its consent
// placeholder, for that video only. privacyUrl links the host's privacy notice from it, as
// editorOptions.youtube.privacyUrl does for the editor's videos; onOpenExternal opens that link
// where a new tab cannot (a desktop webview). The search tab shows only when onSearch is given.
export const YoutubeEmbedModal = ({ isOpen, onClose, onConfirm, onSearch, privacyUrl, onOpenExternal }) => {
    useInscriptEditorTranslations();
    const { t } = useTranslation('inscript-editor');
    const canSearch = typeof onSearch === 'function';
    const [selectedTab, setActiveTab] = useState('link'); // 'link' or 'search'
    const activeTab = canSearch ? selectedTab : 'link';
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [linkInput, setLinkInput] = useState('');
    const [previewId, setPreviewId] = useState(null);
    // The video the user agreed to load in the preview; a different ID asks again.
    const [consentedId, setConsentedId] = useState(null);
    // After "Load preview", focus moves from the button (now gone) to the player.
    const previewFrameRef = useRef(null);
    const focusPreviewRef = useRef(false);
    useEffect(() => {
        if (!focusPreviewRef.current || !previewFrameRef.current) return;
        focusPreviewRef.current = false;
        previewFrameRef.current.focus();
    }, [consentedId]);

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setResults([]);
            setSearchError(null);
            setLinkInput('');
            setPreviewId(null);
            setConsentedId(null);
        }
    }, [isOpen]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!query.trim() || !canSearch) return;

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-[var(--inscript-color-text)]">
            <div className="bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border-strong)] rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col h-[80vh]">
                {/* Header */}
                <div className="p-6 border-b border-[var(--inscript-color-border)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 text-red-500 rounded-lg">
                            <YoutubeIcon size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">{t('embedYoutube', 'Embed YouTube Video')}</h3>
                            <p className="text-xs text-[var(--inscript-color-muted)]">
                                {canSearch ? t('searchOrPasteLink', 'Search or paste a link to embed') : t('pasteLinkToEmbed', 'Paste a link to embed')}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-[var(--inscript-color-hover)] rounded-lg text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs (only with a search to offer: without one there is just the link) */}
                {canSearch && (
                    <div className="flex px-6 pt-2 border-b border-[var(--inscript-color-border)] gap-6">
                        <button type="button"
                            onClick={() => setActiveTab('link')}
                            className={`py-3 text-sm font-medium border-b-2 transition-all ${activeTab === 'link' ? 'border-[var(--inscript-color-accent)] text-[var(--inscript-color-accent)]' : 'border-transparent text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)]'}`}
                        >
                            {t('directLink', 'Direct Link')}
                        </button>
                        <button type="button"
                            onClick={() => setActiveTab('search')}
                            className={`py-3 text-sm font-medium border-b-2 transition-all ${activeTab === 'search' ? 'border-[var(--inscript-color-accent)] text-[var(--inscript-color-accent)]' : 'border-transparent text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)]'}`}
                        >
                            {t('searchYoutubeExperimental', 'Search YouTube (Experimental)')}
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {activeTab === 'search' ? (
                        <div className="space-y-6">
                            {/* Not a <form>: the editor may sit inside the host's own form (Enter searches instead). */}
                            <div className="relative">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder={t('searchForVideosPlaceholder', 'Search for videos...')}
                                    className="w-full bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border-strong)] rounded-xl py-3 pl-4 pr-12 text-[var(--inscript-color-text)] focus:ring-2 focus:ring-[var(--inscript-color-accent-ring)] focus:border-[var(--inscript-color-accent)] outline-none transition-all shadow-inner"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key !== 'Enter') return;
                                        e.preventDefault();
                                        handleSearch();
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleSearch()}
                                    aria-label={t('searchVideos', 'Search videos')}
                                    title={t('searchVideos', 'Search videos')}
                                    disabled={searching}
                                    className="absolute right-2 top-2 p-1.5 bg-[var(--inscript-color-accent)] text-[var(--inscript-color-on-accent)] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                                >
                                    <Filter size={18} />
                                </button>
                            </div>

                            <InlineNotice variant="warning" title={t('experimentalFeature', 'Experimental Feature')}>
                                <Trans i18nKey="experimentalFeatureDescription" ns="inscript-editor" components={{ 1: <EmphasisText /> }}>
                                    External search uses public proxy instances which can be unreliable. If search fails, please use the <EmphasisText>Direct Link</EmphasisText> tab instead.
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
                                            <div className="aspect-video bg-[var(--inscript-color-surface-raised)] rounded-lg" />
                                            <div className="h-4 bg-[var(--inscript-color-surface-raised)] rounded w-3/4" />
                                        </div>
                                    ))}
                                </div>
                            ) : results.length > 0 ? (
                                <div className="grid grid-cols-2 gap-4">
                                    {results.map((video) => (
                                        <button type="button"
                                            key={video.url}
                                            onClick={() => {
                                                const id = extractYoutubeId(video.url);
                                                if (id) onConfirm(id);
                                            }}
                                            className="group text-left space-y-2 hover:bg-[var(--inscript-color-hover)] p-2 rounded-xl transition-all"
                                        >
                                            <div className="relative aspect-video rounded-lg overflow-hidden bg-[var(--inscript-color-surface-raised)]">
                                                <img
                                                    src={video.thumbnail}
                                                    alt={video.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <Plus size={32} className="text-[var(--inscript-color-on-accent)] bg-[var(--inscript-color-accent)] rounded-full p-2" />
                                                </div>
                                                <span className="absolute bottom-2 right-2 bg-black/80 text-[10px] px-1.5 py-0.5 rounded font-mono">
                                                    {formatDuration(video.duration)}
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-medium line-clamp-2 leading-tight group-hover:text-[var(--inscript-color-accent)] transition-colors">{video.title}</h4>
                                                <p className="text-[10px] text-[var(--inscript-color-muted)] flex items-center gap-1">
                                                    {[video.uploaderName, Number.isFinite(video.views) ? t('viewsSuffix', '{{views}} views', { views: video.views.toLocaleString() }) : null].filter(Boolean).join(' • ')}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : query && !searching ? (
                                <div className="text-center py-12 text-[var(--inscript-color-muted)] italic">{t('noVideosFound', 'No videos found. Try a different search.')}</div>
                            ) : (
                                <div className="text-center py-12 flex flex-col items-center gap-4 text-[var(--inscript-color-muted)]">
                                    <YoutubeIcon size={48} className="opacity-10" />
                                    <p>{t('enterTopicPrompt', 'Enter a topic or video name to find content')}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-[var(--inscript-color-muted)] uppercase tracking-widest mb-2 block">{t('videoUrlOrId', 'Video URL or ID')}</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder={t('videoUrlPlaceholder', 'https://youtube.com/watch?v=...')}
                                    className="w-full bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border-strong)] rounded-xl py-3 px-4 text-[var(--inscript-color-text)] focus:ring-2 focus:ring-[var(--inscript-color-accent-ring)] focus:border-[var(--inscript-color-accent)] outline-none transition-all shadow-inner"
                                    value={linkInput}
                                    onChange={(e) => setLinkInput(e.target.value)}
                                />
                            </div>

                            {previewId ? (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-[var(--inscript-color-muted)] uppercase tracking-widest block">{t('livePreview', 'Live Preview')}</label>
                                    <div className={`aspect-video rounded-xl overflow-hidden relative @container ${consentedId === previewId ? 'bg-black ring-1 ring-[var(--inscript-color-border)] shadow-2xl' : ''}`}>
                                        {consentedId === previewId ? (
                                            <>
                                                <iframe
                                                    ref={previewFrameRef}
                                                    src={`${youtubeEmbedUrl(previewId)}${PREVIEW_PLAYER_QUERY}`}
                                                    className="w-full h-full"
                                                    title={t('preview', 'Preview')}
                                                />
                                                <div className="absolute inset-0 z-10 pointer-events-none border-2 border-[var(--inscript-color-accent-soft)] rounded-xl" />
                                            </>
                                        ) : (
                                            <YoutubeConsentPreview
                                                labels={{
                                                    title: t('youtubeConsentTitle', YOUTUBE_CONSENT_DEFAULTS.title),
                                                    text: t('youtubeConsentText', YOUTUBE_CONSENT_DEFAULTS.text),
                                                    load: t('youtubeConsentLoadPreview', YOUTUBE_CONSENT_DEFAULTS.loadPreview),
                                                    privacy: t('youtubeConsentPrivacy', YOUTUBE_CONSENT_DEFAULTS.privacy),
                                                }}
                                                onLoad={() => { focusPreviewRef.current = true; setConsentedId(previewId); }}
                                                privacyUrl={privacyUrl}
                                                onOpenExternal={onOpenExternal}
                                            />
                                        )}
                                    </div>
                                    <p className="text-[10px] text-[var(--inscript-color-accent)] font-mono text-center">{t('detectedId', 'Detected ID: {{id}}', { id: previewId })}</p>
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
                <div className="p-6 bg-[var(--inscript-color-surface)] border-t border-[var(--inscript-color-border)] flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)] transition-colors">{t('cancel', 'Cancel')}</button>
                    <button type="button"
                        onClick={() => previewId && onConfirm(previewId)}
                        disabled={!previewId}
                        className="px-6 py-2 bg-[var(--inscript-color-accent)] text-[var(--inscript-color-on-accent)] rounded-lg text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                        {t('insertVideo', 'Insert Video')}
                    </button>
                </div>
            </div>
        </div>
    );
};
