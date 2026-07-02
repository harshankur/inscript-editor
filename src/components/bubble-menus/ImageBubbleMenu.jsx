import { useTranslation } from 'react-i18next';
import { BubbleMenu } from '@tiptap/react/menus';
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from 'lucide-react';
import { ToolbarButton } from '../ToolbarButton.jsx';
import { useInscriptEditorTranslations } from '../../hooks/useInscriptEditorTranslations.js';

export const ImageBubbleMenu = ({ editor, isReadonly }) => {
    useInscriptEditorTranslations();
    const { t } = useTranslation('inscript-editor');
    if (!editor) return null;
    return (
        <BubbleMenu
            editor={editor}
            pluginKey="imageBubbleMenu"
            shouldShow={({ editor }) => !isReadonly && editor.isActive('image')}
            tippyOptions={{ duration: 100, zIndex: 9999, maxWidth: '98vw', interactive: true, placement: 'top' }}
        >
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-xl flex items-center p-1 gap-1 overflow-visible custom-scrollbar">
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    {['25%', '50%', '75%', '100%'].map(w => (
                        <ToolbarButton
                            key={w}
                            onClick={() => editor.chain().focus().updateAttributes('image', { width: w }).run()}
                            active={editor.getAttributes('image').width === w}
                            title={t('imageWidth', 'Image width {{width}}', { width: w })}
                        >
                            <span className="text-[10px] font-mono px-0.5">{w}</span>
                        </ToolbarButton>
                    ))}
                </div>
                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    <ToolbarButton onClick={() => editor.chain().focus().updateAttributes('image', { align: 'left' }).run()} active={editor.getAttributes('image').align === 'left'} title={t('alignLeft', 'Align Left')}>
                        <AlignLeft size={15} />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().updateAttributes('image', { align: 'center' }).run()} active={editor.getAttributes('image').align === 'center' || !editor.getAttributes('image').align} title={t('alignCenter', 'Align Center')}>
                        <AlignCenter size={15} />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().updateAttributes('image', { align: 'right' }).run()} active={editor.getAttributes('image').align === 'right'} title={t('alignRight', 'Align Right')}>
                        <AlignRight size={15} />
                    </ToolbarButton>
                </div>
                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().deleteSelection().run()}
                        title={t('deleteImage', 'Delete image')}
                        className="hover:bg-red-500/10 hover:text-red-500"
                    >
                        <Trash2 size={15} className="text-red-500" />
                    </ToolbarButton>
                </div>
            </div>
        </BubbleMenu>
    );
};
