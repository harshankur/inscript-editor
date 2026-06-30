import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, Image as ImageIcon, Plus, X } from 'lucide-react';

export const ImageSelectorModal = ({ isOpen, onClose, images, onSelect, onUpload }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');

    if (!isOpen) return null;
    const filteredImages = images.filter(img => img.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[80vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t('mediaLibraryTitle')}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex gap-4">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('searchImages')}
                            className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-zinc-900 dark:text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                            autoFocus
                        />
                        <div className="absolute left-3 top-2.5 text-zinc-400 dark:text-zinc-500">
                            <Filter size={16} />
                        </div>
                    </div>
                    <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-900 dark:text-white font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-2 shadow-lg shadow-emerald-900/20">
                        <Plus size={18} />
                        <span>{t('uploadNew')}</span>
                        <input type="file" className="hidden" onChange={(e) => { const file = e.target.files[0]; if (file) onUpload(file); }} accept="image/*" />
                    </label>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-zinc-950/30">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredImages.map((img) => (
                            <button
                                key={img.url}
                                onClick={() => onSelect(img.url)}
                                className="group relative aspect-square bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:ring-2 hover:ring-emerald-500 transition-all hover:scale-[1.02]"
                            >
                                <img
                                    src={img.url}
                                    alt={img.name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-xs text-zinc-900 dark:text-white truncate font-medium">{img.name}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                    {filteredImages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500 gap-2">
                            <ImageIcon size={48} className="opacity-20" />
                            <p>{t('noImagesFound')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
