import { useTranslation } from 'react-i18next';
import { BubbleMenu } from '@tiptap/react/menus';
import { AlignCenter, AlignLeft, AlignRight, ExternalLink, Trash2 } from 'lucide-react';
import { ToolbarButton } from '../ToolbarButton.jsx';
import { useInscriptEditorTranslations } from '../../hooks/useInscriptEditorTranslations.js';

export const YoutubeBubbleMenu = ({ editor, isReadonly }) => {
    useInscriptEditorTranslations();
    const { t } = useTranslation('inscript-editor');
    if (!editor) return null;
    return (
        <BubbleMenu
            editor={editor}
            pluginKey="youtubeBubbleMenu"
            shouldShow={({ editor }) => !isReadonly && editor.isActive('youtube')}
            tippyOptions={{ duration: 100, zIndex: 9999, maxWidth: '98vw', interactive: true, placement: 'top' }}
        >
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-xl flex items-center p-1 gap-1 overflow-visible custom-scrollbar">
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    {['25%', '50%', '75%', '100%'].map(w => (
                        <ToolbarButton
                            key={w}
                            onClick={() => editor.chain().focus().updateAttributes('youtube', { width: w }).run()}
                            active={editor.getAttributes('youtube').width === w}
                            title={t('videoWidth', 'Video width {{width}}', { width: w })}
                        >
                            <span className="text-[10px] font-mono px-0.5">{w}</span>
                        </ToolbarButton>
                    ))}
                </div>
                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    <ToolbarButton onClick={() => editor.chain().focus().updateAttributes('youtube', { align: 'left' }).run()} active={editor.getAttributes('youtube').align === 'left'} title={t('alignLeft', 'Align Left')}>
                        <AlignLeft size={15} />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().updateAttributes('youtube', { align: 'center' }).run()} active={editor.getAttributes('youtube').align === 'center' || !editor.getAttributes('youtube').align} title={t('alignCenter', 'Align Center')}>
                        <AlignCenter size={15} />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().updateAttributes('youtube', { align: 'right' }).run()} active={editor.getAttributes('youtube').align === 'right'} title={t('alignRight', 'Align Right')}>
                        <AlignRight size={15} />
                    </ToolbarButton>
                </div>
                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    <ToolbarButton
                        onClick={() => {
                            const id = editor.getAttributes('youtube')['data-youtube-video'];
                            if (id) window.open(`https://www.youtube.com/watch?v=${id}`, '_blank');
                        }}
                        title={t('openInYoutube', 'Open in YouTube')}
                    >
                        <ExternalLink size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().deleteSelection().run()}
                        title={t('deleteVideo', 'Delete video')}
                        className="hover:bg-red-500/10 hover:text-red-500"
                    >
                        <Trash2 size={15} className="text-red-500" />
                    </ToolbarButton>
                </div>
            </div>
        </BubbleMenu>
    );
};
