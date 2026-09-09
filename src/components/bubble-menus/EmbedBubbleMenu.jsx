import { useTranslation } from 'react-i18next';
import { BubbleMenu } from '@tiptap/react/menus';
import { useEditorState } from '@tiptap/react';
import { ExternalLink, Trash2, Globe, Type } from 'lucide-react';
import { ToolbarButton } from '../ToolbarButton.jsx';
import { SourceField } from './SourceField.jsx';
import { useInscriptEditorTranslations } from '../../hooks/useInscriptEditorTranslations.js';

/**
 * Bubble menu for the generic Embed node: shows the embed's source URL (which is
 * otherwise hidden once the iframe loads) and lets you replace it, edit the caption,
 * open it in a new tab, or delete it.
 */
export const EmbedBubbleMenu = ({ editor, isReadonly, onOpenExternal }) => {
    useInscriptEditorTranslations();
    const { t } = useTranslation('inscript-editor');
    // The host may own external-link opening (e.g. a desktop app where window.open is blocked); fall
    // back to window.open when no handler is supplied.
    const openExternal = (url) => (onOpenExternal ? onOpenExternal(url) : window.open(url, '_blank', 'noopener,noreferrer'));
    const attrs = useEditorState({
        editor,
        selector: ({ editor }) => {
            const a = editor.getAttributes('embed');
            return { src: a.src || '', label: a.label || '' };
        },
    }) || {};
    if (!editor) return null;
    return (
        <BubbleMenu
            editor={editor}
            pluginKey="embedBubbleMenu"
            shouldShow={({ editor }) => !isReadonly && editor.isActive('embed')}
            tippyOptions={{ duration: 100, zIndex: 9999, maxWidth: '98vw', interactive: true, placement: 'top' }}
        >
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-xl flex items-center p-1 gap-1 overflow-visible custom-scrollbar">
                <SourceField
                    icon={<Globe size={14} />}
                    label={t('embedUrl', 'Embed URL')}
                    placeholder={t('embedUrl', 'Embed URL')}
                    value={attrs.src}
                    validate={(v) => v.length > 0}
                    onApply={(v) => editor.chain().focus().updateAttributes('embed', { src: v }).run()}
                    inputClassName="w-52"
                />
                <SourceField
                    icon={<Type size={14} />}
                    label={t('embedCaption', 'Caption')}
                    placeholder={t('embedCaption', 'Caption')}
                    value={attrs.label}
                    onApply={(v) => editor.chain().focus().updateAttributes('embed', { label: v || null }).run()}
                    inputClassName="w-28"
                />
                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    <ToolbarButton
                        onClick={() => {
                            const src = editor.getAttributes('embed').src;
                            if (src) openExternal(src);
                        }}
                        title={t('openEmbed', 'Open in new tab')}
                    >
                        <ExternalLink size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().deleteSelection().run()}
                        title={t('deleteEmbed', 'Delete embed')}
                        className="hover:bg-red-500/10 hover:text-red-500"
                    >
                        <Trash2 size={15} className="text-red-500" />
                    </ToolbarButton>
                </div>
            </div>
        </BubbleMenu>
    );
};
