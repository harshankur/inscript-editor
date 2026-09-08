import { useTranslation } from 'react-i18next';
import { BubbleMenu } from '@tiptap/react/menus';
import { useEditorState } from '@tiptap/react';
import { AlignCenter, AlignLeft, AlignRight, Trash2, ImageIcon, Type } from 'lucide-react';
import { ToolbarButton } from '../ToolbarButton.jsx';
import { SourceField } from './SourceField.jsx';
import { useInscriptEditorTranslations } from '../../hooks/useInscriptEditorTranslations.js';

export const ImageBubbleMenu = ({ editor, isReadonly }) => {
    useInscriptEditorTranslations();
    const { t } = useTranslation('inscript-editor');
    const attrs = useEditorState({
        editor,
        selector: ({ editor }) => {
            const a = editor.getAttributes('image');
            return { src: a.src || '', alt: a.alt || '', width: a.width, align: a.align };
        },
    }) || {};
    if (!editor) return null;
    return (
        <BubbleMenu
            editor={editor}
            pluginKey="imageBubbleMenu"
            shouldShow={({ editor }) => !isReadonly && editor.isActive('image')}
            tippyOptions={{ duration: 100, zIndex: 9999, maxWidth: '98vw', interactive: true, placement: 'top' }}
        >
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-xl flex items-center p-1 gap-1 overflow-visible custom-scrollbar">
                {/* The image source and alt text, visible and editable inline. */}
                <SourceField
                    icon={<ImageIcon size={14} />}
                    label={t('imageUrl', 'Image URL')}
                    placeholder={t('imageUrl', 'Image URL')}
                    value={attrs.src}
                    validate={(v) => v.length > 0}
                    onApply={(v) => editor.chain().focus().updateAttributes('image', { src: v }).run()}
                    inputClassName="w-44"
                />
                <SourceField
                    icon={<Type size={14} />}
                    label={t('imageAlt', 'Alt text')}
                    placeholder={t('imageAlt', 'Alt text')}
                    value={attrs.alt}
                    onApply={(v) => editor.chain().focus().updateAttributes('image', { alt: v }).run()}
                    inputClassName="w-28"
                />
                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    {['25%', '50%', '75%', '100%'].map(w => (
                        <ToolbarButton
                            key={w}
                            onClick={() => editor.chain().focus().updateAttributes('image', { width: w }).run()}
                            active={attrs.width === w}
                            title={t('imageWidth', 'Image width {{width}}', { width: w })}
                        >
                            <span className="text-[10px] font-mono px-0.5">{w}</span>
                        </ToolbarButton>
                    ))}
                </div>
                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    <ToolbarButton onClick={() => editor.chain().focus().updateAttributes('image', { align: 'left' }).run()} active={attrs.align === 'left'} title={t('alignLeft', 'Align Left')}>
                        <AlignLeft size={15} />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().updateAttributes('image', { align: 'center' }).run()} active={attrs.align === 'center' || !attrs.align} title={t('alignCenter', 'Align Center')}>
                        <AlignCenter size={15} />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().updateAttributes('image', { align: 'right' }).run()} active={attrs.align === 'right'} title={t('alignRight', 'Align Right')}>
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
