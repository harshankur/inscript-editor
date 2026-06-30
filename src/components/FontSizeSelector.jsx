import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALargeSmall, CheckCircle, XCircle } from 'lucide-react';
import { ToolbarButton, TOOLBAR_SIZES } from './ToolbarButton.jsx';

export const FontSizeSelector = ({ editor }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const sizes = [12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72];
    const currentSize = editor?.getAttributes('textStyle')?.fontSize;

    return (
        <div className="relative">
            <ToolbarButton
                onClick={() => setIsOpen(!isOpen)}
                active={!!currentSize}
                title={t('fontSize')}
                width={TOOLBAR_SIZES.CUSTOM}
            >
                <div className="flex items-center justify-center gap-0.5">
                    <ALargeSmall size={16} />
                    {currentSize && <span className="text-[10px] font-bold">{currentSize}</span>}
                </div>
            </ToolbarButton>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[70]" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-xl z-[80] flex flex-col min-w-[80px] max-h-[200px] overflow-y-auto animate-in slide-in-from-top-2 fade-in">
                        {sizes.map(size => (
                            <button
                                key={size}
                                onClick={() => { editor.chain().focus().setFontSize(size).run(); setIsOpen(false); }}
                                className={`px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm flex items-center justify-between ${currentSize == size ? 'text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400'}`}
                            >
                                <span>{size}px</span>
                                {currentSize == size && <CheckCircle size={12} className="text-emerald-500" />}
                            </button>
                        ))}
                        <button
                            onClick={() => { editor.chain().focus().unsetFontSize().run(); setIsOpen(false); }}
                            className="px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-xs text-red-400 border-t border-zinc-200 dark:border-zinc-800 mt-1 flex items-center gap-2"
                        >
                            <XCircle size={12} />
                            {t('reset')}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
