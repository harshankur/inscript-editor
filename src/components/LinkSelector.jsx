import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as LinkIcon, Link2Off } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton.jsx';

export const LinkSelector = ({ editor }) => {
    const { t } = useTranslation('inscript-editor');
    const [isOpen, setIsOpen] = useState(false);
    const [url, setUrl] = useState('');
    // The Link extension refused the address (a script URL, say): keep the popover open and say so.
    const [refused, setRefused] = useState(false);

    const currentUrl = editor?.getAttributes('link').href || '';
    const isActive = editor?.isActive('link');

    useEffect(() => {
        if (isOpen) {
            setUrl(currentUrl);
            setRefused(false);
        }
    }, [isOpen, currentUrl]);

    const handleApply = () => {
        const href = url.trim();
        if (!href) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            setIsOpen(false);
            return;
        }
        const applied = editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
        if (!applied) {
            setRefused(true);
            return;
        }
        setIsOpen(false);
    };

    const handleRemove = () => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <ToolbarButton
                onClick={() => setIsOpen(!isOpen)}
                active={isActive}
                title={t('insertLink', 'Insert Link')}
            >
                <LinkIcon size={16} />
            </ToolbarButton>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[70]" onClick={() => setIsOpen(false)} />
                    {/* Not a <form>: the editor may sit inside the host's own form, and a nested form
                        (or its bubbling submit event) would reach the host. Enter applies instead. */}
                    <div
                        className="absolute top-full left-0 mt-2 p-3 bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border-strong)] rounded-lg shadow-xl z-[80] min-w-[260px] animate-in slide-in-from-top-2 fade-in flex flex-col gap-3"
                    >
                        <div className="text-xs font-medium text-[var(--inscript-color-muted)] uppercase tracking-wider">{t('insertLink', 'Insert Link')}</div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => { setUrl(e.target.value); setRefused(false); }}
                            onKeyDown={(e) => {
                                if (e.key !== 'Enter') return;
                                e.preventDefault();
                                handleApply();
                            }}
                            aria-invalid={refused || undefined}
                            aria-describedby={refused ? 'inscript-link-refused' : undefined}
                            placeholder={t('enterUrl', 'Enter URL...')}
                            className="w-full bg-[var(--inscript-color-surface)] border border-[var(--inscript-color-border)] rounded px-3 py-2 text-sm text-[var(--inscript-color-text)] focus:outline-none focus:border-[var(--inscript-color-accent)] transition-colors"
                            autoFocus
                        />
                        {refused && (
                            <div id="inscript-link-refused" role="alert" className="text-xs text-red-500">
                                {t('linkNotAllowed', 'This address cannot be used as a link.')}
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleApply}
                                className="flex-1 bg-[var(--inscript-color-accent)] hover:opacity-90 text-[var(--inscript-color-on-accent)] text-xs font-bold py-2 rounded transition-colors"
                            >
                                {t('apply', 'Apply')}
                            </button>
                            {isActive && (
                                <button
                                    type="button"
                                    onClick={handleRemove}
                                    className="p-2 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                    title={t('removeLink', 'Remove Link')}
                                >
                                    <Link2Off size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
