import { useCallback } from 'react';
import { useInscriptT } from '../../hooks/useInscriptT.js';
import { BubbleMenu } from '@tiptap/react/menus';
import { BUBBLE_MENU_STYLE, bubbleMenuContainer, useBubbleMenuOptions } from './menuOptions.js';
import {
    AlignCenter, AlignLeft, AlignRight, ArrowLeftRight, CircleSlash,
    BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart,
    Columns, Rows, SplitSquareHorizontal, Trash2,
} from 'lucide-react';
import { ToolbarButton } from '../ToolbarButton.jsx';
import { ChoiceButtons } from './ChoiceButtons.jsx';
import { PlacementButtons } from './PlacementButtons.jsx';
import { canAlignColumns, getColumnAlign, getTableNode, isHeaderRowActive, isHeaderColumnActive, setColumnAlign, setTableLayout } from '../../utils/tableHelpers.js';
import { COLUMN_ALIGN, TABLE_ALIGN } from '../../constants.js';
import { useEditorTransaction } from '../../hooks/useEditorTransaction.js';
import { useInscriptEditorTranslations } from '../../hooks/useInscriptEditorTranslations.js';

export const TableBubbleMenu = ({ editor, isReadonly, scrollContainer, menuContainer }) => {
    useInscriptEditorTranslations();
    const { t } = useInscriptT();
    // The active placement and header toggles are read from the editor while rendering.
    useEditorTransaction(editor);
    // Stable identity: TipTap's BubbleMenu dispatches a transaction whenever this prop changes,
    // so an inline function would dispatch one on every render (and, in a menu that re-renders
    // on transactions, loop forever).
    const menuOptions = useBubbleMenuOptions('bottom', scrollContainer);
    const shouldShow = useCallback(({ editor: current }) => {
        if (isReadonly) return false;
        return '$anchorCell' in current.state.selection;
    }, [isReadonly]);
    if (!editor) return null;
    // The selected columns' shared alignment: null when none is set, undefined when they differ.
    // Column alignment needs this library's table extension (its setColumnAlign command).
    const columnsAlignable = canAlignColumns(editor);
    // Read only while the menu can show (a cell selection): it walks the selected columns' cells.
    const columnAlign = '$anchorCell' in editor.state.selection ? getColumnAlign(editor.state) : undefined;
    // The table's placement on the page; no attribute is the default, centred.
    const tableAlign = getTableNode(editor.state)?.node.attrs.align;
    return (
        <BubbleMenu
            editor={editor}
            pluginKey="tableBubbleMenu"
            shouldShow={shouldShow}
            options={menuOptions}
            appendTo={bubbleMenuContainer(menuContainer)}
            style={BUBBLE_MENU_STYLE}
        >
            <div className="bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border-strong)] rounded-lg shadow-xl flex items-center p-1 gap-1 flex-wrap overflow-visible max-w-[90vw] custom-scrollbar">
                {/* Columns Group */}
                <div className="flex items-center gap-0.5 bg-[var(--inscript-color-surface-raised)] p-0.5 rounded border border-[var(--inscript-color-border)]">
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
                            <Columns size={15} className="text-[var(--inscript-color-muted)]" />
                            <Trash2 size={10} className="absolute -bottom-0.5 -right-0.5 text-red-500" />
                        </div>
                    </ToolbarButton>
                </div>

                <div className="w-px h-4 bg-[var(--inscript-color-border)] mx-0.5" />

                {/* Rows Group */}
                <div className="flex items-center gap-0.5 bg-[var(--inscript-color-surface-raised)] p-0.5 rounded border border-[var(--inscript-color-border)]">
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
                            <Rows size={15} className="text-[var(--inscript-color-muted)]" />
                            <Trash2 size={10} className="absolute -bottom-0.5 -right-0.5 text-red-500" />
                        </div>
                    </ToolbarButton>
                </div>

                <div className="w-px h-4 bg-[var(--inscript-color-border)] mx-0.5" />

                {/* Cell Actions Group */}
                <div className="flex items-center gap-0.5 bg-[var(--inscript-color-surface-raised)] p-0.5 rounded border border-[var(--inscript-color-border)]">
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

                <div className="w-px h-4 bg-[var(--inscript-color-border)] mx-0.5" />

                {/* Column alignment: every cell of the column, header included (a Markdown `---:`) */}
                <div className="flex items-center gap-0.5 bg-[var(--inscript-color-surface-raised)] p-0.5 rounded border border-[var(--inscript-color-border)]">
                    <ChoiceButtons
                        value={columnAlign}
                        onPick={align => setColumnAlign(editor, align)}
                        disabled={!columnsAlignable}
                        options={[
                            { value: COLUMN_ALIGN.LEFT, Icon: AlignLeft, title: t('alignColumnLeft', 'Align column left') },
                            { value: COLUMN_ALIGN.CENTER, Icon: AlignCenter, title: t('alignColumnCenter', 'Center column') },
                            { value: COLUMN_ALIGN.RIGHT, Icon: AlignRight, title: t('alignColumnRight', 'Align column right') },
                        ]}
                    />
                    <ToolbarButton onClick={() => setColumnAlign(editor, null)} disabled={!columnsAlignable} title={t('clearColumnAlign', 'Clear column alignment')}>
                        <CircleSlash size={15} />
                    </ToolbarButton>
                </div>

                <div className="w-px h-4 bg-[var(--inscript-color-border)] mx-0.5" />

                {/* Table placement on the page (not the text inside it) */}
                <div className="flex items-center gap-0.5 bg-[var(--inscript-color-surface-raised)] p-0.5 rounded border border-[var(--inscript-color-border)]">
                    <PlacementButtons
                        value={tableAlign}
                        onPlace={align => setTableLayout(editor, { align })}
                        titles={{
                            [TABLE_ALIGN.LEFT]: t('placeTableLeft', 'Place table left'),
                            [TABLE_ALIGN.CENTER]: t('placeTableCenter', 'Center table on the page'),
                            [TABLE_ALIGN.RIGHT]: t('placeTableRight', 'Place table right'),
                        }}
                    />
                </div>

                <div className="w-px h-4 bg-[var(--inscript-color-border)] mx-0.5" />

                {/* Table Actions Group */}
                <div className="flex items-center gap-0.5 bg-[var(--inscript-color-surface-raised)] p-0.5 rounded border border-[var(--inscript-color-border)]">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                        disabled={!editor.can().toggleHeaderRow()}
                        active={isHeaderRowActive(editor)}
                        title={t('toggleHeaderRow', 'Toggle Header Row')}
                    >
                        <div className="flex flex-col gap-0.5 items-center justify-center w-4 h-4 border border-[var(--inscript-color-border-strong)] rounded-sm p-0.5">
                            <div className="w-full h-1 bg-[var(--inscript-color-border-strong)] rounded-[1px]" />
                            <div className="w-full h-0.5 bg-[var(--inscript-color-border)] rounded-[1px]" />
                            <div className="w-full h-0.5 bg-[var(--inscript-color-border)] rounded-[1px]" />
                        </div>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
                        disabled={!editor.can().toggleHeaderColumn()}
                        active={isHeaderColumnActive(editor)}
                        title={t('toggleHeaderColumn', 'Toggle Header Column')}
                    >
                        <div className="flex gap-0.5 items-center justify-center w-4 h-4 border border-[var(--inscript-color-border-strong)] rounded-sm p-0.5">
                            <div className="w-1 h-full bg-[var(--inscript-color-border-strong)] rounded-[1px]" />
                            <div className="w-0.5 h-full bg-[var(--inscript-color-border)] rounded-[1px]" />
                            <div className="w-0.5 h-full bg-[var(--inscript-color-border)] rounded-[1px]" />
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
