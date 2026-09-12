import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XCircle } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton.jsx';

export const ColorSelector = ({ icon: Icon, title, activeColor, onChange, onRemove, presets, variant = 'text' }) => {
    const { t } = useTranslation('inscript-editor');
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative">
            <ToolbarButton
                onClick={() => setIsOpen(!isOpen)}
                active={!!activeColor}
                title={title}
            >
                <div className="relative flex items-center justify-center">
                    <Icon size={16} style={{ color: variant === 'text' ? activeColor : undefined }} />
                    {variant === 'highlight' && activeColor && (
                        <span className="absolute -bottom-1 left-0 right-0 h-1 rounded-sm" style={{ backgroundColor: activeColor }} />
                    )}
                </div>
            </ToolbarButton>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[70]" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full right-0 md:left-1/2 md:-translate-x-1/2 mt-2 p-3 bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border-strong)] rounded-lg shadow-xl z-[80] min-w-[200px] animate-in slide-in-from-top-2 fade-in">
                        <div className="text-xs font-medium text-[var(--inscript-color-muted)] mb-2 uppercase tracking-wider">{t('presets', 'Presets')}</div>
                        <div className="grid grid-cols-5 gap-1.5 mb-3">
                            {presets.map(color => (
                                <button
                                    key={color}
                                    onClick={() => { onChange(color); setIsOpen(false); }}
                                    className={`w-6 h-6 rounded border ${activeColor === color ? 'border-white ring-1 ring-white' : 'border-[var(--inscript-color-border-strong)] hover:scale-110 active:scale-95'} transition-all`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>

                        <div className="h-px bg-[var(--inscript-color-border)] my-2" />

                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-xs text-[var(--inscript-color-text)] hover:text-[var(--inscript-color-text)] cursor-pointer px-1 py-1 rounded hover:bg-[var(--inscript-color-hover)] transition-colors">
                                <div className="w-5 h-5 rounded border border-[var(--inscript-color-border-strong)] bg-gradient-to-br from-red-500 via-green-500 to-blue-500 relative overflow-hidden flex items-center justify-center">
                                    <input
                                        type="color"
                                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                        value={activeColor || '#000000'}
                                        onChange={(e) => { onChange(e.target.value); }}
                                    />
                                </div>
                                <span>{t('customColor', 'Custom Color...')}</span>
                            </label>

                            <button
                                onClick={() => { onRemove(); setIsOpen(false); }}
                                className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 px-1 py-1 rounded hover:bg-red-400/10 transition-colors"
                            >
                                <XCircle size={14} />
                                <span>{variant === 'text' ? t('resetToDefault', 'Reset to Default') : t('noHighlight', 'No Highlight')}</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
