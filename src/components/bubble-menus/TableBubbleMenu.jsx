import { useTranslation } from 'react-i18next';
import { BubbleMenu } from '@tiptap/react/menus';
import {
    AlignCenter, AlignLeft, AlignRight, ArrowLeftRight,
    BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart,
    Columns, Rows, SplitSquareHorizontal, Trash2,
} from 'lucide-react';
import { ToolbarButton } from '../ToolbarButton.jsx';
import { getTableNode, isHeaderRowActive, isHeaderColumnActive, setTableLayout } from '../../utils/tableHelpers.js';
import { useInscriptEditorTranslations } from '../../hooks/useInscriptEditorTranslations.js';

export const TableBubbleMenu = ({ editor, isReadonly }) => {
    useInscriptEditorTranslations();
    const { t } = useTranslation('inscript-editor');
    if (!editor) return null;
    return (
        <BubbleMenu
            editor={editor}
            pluginKey="tableBubbleMenu"
            shouldShow={({ editor }) => {
                if (isReadonly) return false;
                return '$anchorCell' in editor.state.selection;
            }}
            tippyOptions={{ duration: 100, zIndex: 9999, maxWidth: '98vw', interactive: true, placement: 'bottom' }}
        >
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-xl flex items-center p-1 gap-1 flex-wrap overflow-visible max-w-[90vw] custom-scrollbar">
                {/* Columns Group */}
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().addColumnBefore().run()}
                        disabled={!editor.can().addColumnBefore()}
                        title={t('addColumnBefore', 'Add Column Left')}
                    >
                        <BetweenHorizontalStart size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                        disabled={!editor.can().addColumnAfter()}
                        title={t('addColumnAfter', 'Add Column Right')}
                    >
                        <BetweenHorizontalEnd size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().deleteColumn().run()}
                        disabled={!editor.can().deleteColumn()}
                        title={t('deleteColumn', 'Delete Column')}
                        className="hover:bg-red-500/10 hover:text-red-500"
                    >
                        <div className="relative flex items-center justify-center">
                            <Columns size={15} className="text-zinc-400 dark:text-zinc-500" />
                            <Trash2 size={10} className="absolute -bottom-0.5 -right-0.5 text-red-500" />
                        </div>
                    </ToolbarButton>
                </div>

                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />

                {/* Rows Group */}
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().addRowBefore().run()}
                        disabled={!editor.can().addRowBefore()}
                        title={t('addRowBefore', 'Add Row Above')}
                    >
                        <BetweenVerticalStart size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                        disabled={!editor.can().addRowAfter()}
                        title={t('addRowAfter', 'Add Row Below')}
                    >
                        <BetweenVerticalEnd size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().deleteRow().run()}
                        disabled={!editor.can().deleteRow()}
                        title={t('deleteRow', 'Delete Row')}
                        className="hover:bg-red-500/10 hover:text-red-500"
                    >
                        <div className="relative flex items-center justify-center">
                            <Rows size={15} className="text-zinc-400 dark:text-zinc-500" />
                            <Trash2 size={10} className="absolute -bottom-0.5 -right-0.5 text-red-500" />
                        </div>
                    </ToolbarButton>
                </div>

                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />

                {/* Cell Actions Group */}
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().mergeCells().run()}
                        disabled={!editor.can().mergeCells()}
                        title={t('mergeCells', 'Merge Cells')}
                    >
                        <ArrowLeftRight size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().splitCell().run()}
                        disabled={!editor.can().splitCell()}
                        title={t('splitCell', 'Split Cell')}
                    >
                        <SplitSquareHorizontal size={15} />
                    </ToolbarButton>
                </div>

                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />

                {/* Layout Group */}
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    <ToolbarButton onClick={() => setTableLayout(editor, { align: 'left' })} active={getTableNode(editor.state)?.node.attrs.align === 'left'} title={t('alignLeft', 'Align Left')}>
                        <AlignLeft size={15} />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => setTableLayout(editor, { align: 'center' })} active={getTableNode(editor.state)?.node.attrs.align === 'center' || !getTableNode(editor.state)?.node.attrs.align} title={t('alignCenter', 'Align Center')}>
                        <AlignCenter size={15} />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => setTableLayout(editor, { align: 'right' })} active={getTableNode(editor.state)?.node.attrs.align === 'right'} title={t('alignRight', 'Align Right')}>
                        <AlignRight size={15} />
                    </ToolbarButton>
                </div>

                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-0.5" />

                {/* Table Actions Group */}
                <div className="flex items-center gap-0.5 bg-zinc-100/50 dark:bg-zinc-800/30 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                        disabled={!editor.can().toggleHeaderRow()}
                        active={isHeaderRowActive(editor)}
                        title={t('toggleHeaderRow', 'Toggle Header Row')}
                    >
                        <div className="flex flex-col gap-0.5 items-center justify-center w-4 h-4 border border-zinc-400 dark:border-zinc-500 rounded-sm p-0.5">
                            <div className="w-full h-1 bg-zinc-400 dark:bg-zinc-500 rounded-[1px]" />
                            <div className="w-full h-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-[1px]" />
                            <div className="w-full h-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-[1px]" />
                        </div>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
                        disabled={!editor.can().toggleHeaderColumn()}
                        active={isHeaderColumnActive(editor)}
                        title={t('toggleHeaderColumn', 'Toggle Header Column')}
                    >
                        <div className="flex gap-0.5 items-center justify-center w-4 h-4 border border-zinc-400 dark:border-zinc-500 rounded-sm p-0.5">
                            <div className="w-1 h-full bg-zinc-400 dark:bg-zinc-500 rounded-[1px]" />
                            <div className="w-0.5 h-full bg-zinc-200 dark:bg-zinc-800 rounded-[1px]" />
                            <div className="w-0.5 h-full bg-zinc-200 dark:bg-zinc-800 rounded-[1px]" />
                        </div>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().deleteTable().run()}
                        disabled={!editor.can().deleteTable()}
                        title={t('deleteTable', 'Delete Table')}
                        className="hover:bg-red-500/10 hover:text-red-500"
                    >
                        <Trash2 size={15} className="text-red-500" />
                    </ToolbarButton>
                </div>
            </div>
        </BubbleMenu>
    );
};
