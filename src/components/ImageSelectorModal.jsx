import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, Image as ImageIcon, Loader2, Plus, X } from 'lucide-react';
import { InlineNotice } from './InlineNotice.jsx';
import { useInscriptEditorTranslations } from '../hooks/useInscriptEditorTranslations.js';

export const ImageSelectorModal = ({ isOpen, onClose, images, onSelect, onUpload }) => {
    useInscriptEditorTranslations();
    const { t } = useTranslation('inscript-editor');
    const [search, setSearch] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);

    if (!isOpen) return null;
    const filteredImages = images.filter(img => img.name.toLowerCase().includes(search.toLowerCase()));

    const handleUpload = async (file) => {
        if (!file) return;
        setUploading(true);
        setUploadError(null);
        try {
            await onUpload(file);
        } catch (err) {
            setUploadError(t('uploadFailedMessage', 'Upload failed. Please try again.'));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border-strong)] rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[80vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--inscript-color-border)]">
                    <h2 className="text-lg font-bold text-[var(--inscript-color-text)]">{t('mediaLibraryTitle', 'Media Library')}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--inscript-color-hover)] rounded-lg text-[var(--inscript-color-muted)] hover:text-[var(--inscript-color-text)] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-[var(--inscript-color-border)] flex gap-4">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('searchImages', 'Search images...')}
                            className="w-full bg-[var(--inscript-color-surface)] border border-[var(--inscript-color-border)] rounded-lg pl-10 pr-4 py-2 text-[var(--inscript-color-text)] placeholder:text-[var(--inscript-color-muted)] focus:outline-none focus:border-[var(--inscript-color-accent)] transition-colors"
                            autoFocus
                        />
                        <div className="absolute left-3 top-2.5 text-[var(--inscript-color-muted)]">
                            <Filter size={16} />
                        </div>
                    </div>
                    <label className={`px-4 py-2 bg-[var(--inscript-color-accent)] hover:opacity-90 text-[var(--inscript-color-on-accent)] font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-2 shadow-lg ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                        <span>{t('uploadNew', 'Upload New')}</span>
                        <input
                            type="file"
                            className="hidden"
                            disabled={uploading}
                            onChange={(e) => { const file = e.target.files[0]; handleUpload(file); e.target.value = ''; }}
                            accept="image/*"
                        />
                    </label>
                </div>

                {uploadError && (
                    <div className="px-4 pt-4">
                        <InlineNotice variant="error">{uploadError}</InlineNotice>
                    </div>
                )}

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4 bg-[var(--inscript-color-surface)]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredImages.map((img) => (
                            <button
                                key={img.url}
                                onClick={() => onSelect(img.url)}
                                className="group relative aspect-square bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border)] rounded-xl overflow-hidden hover:ring-2 hover:ring-[var(--inscript-color-accent)] transition-all hover:scale-[1.02]"
                            >
                                <img
                                    src={img.url}
                                    alt={img.name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-xs text-[var(--inscript-color-text)] truncate font-medium">{img.name}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                    {filteredImages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--inscript-color-muted)] gap-2">
                            <ImageIcon size={48} className="opacity-20" />
                            <p>{t('noImagesFound', 'No images found')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
