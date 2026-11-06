import { useCallback, useMemo } from 'react';
import { useInscriptT } from '../../hooks/useInscriptT.js';
import { BubbleMenu } from '@tiptap/react/menus';
import { BUBBLE_MENU_STYLE, bubbleMenuContainer, useBubbleMenuOptions } from './menuOptions.js';
import {
    Bold, Code, Italic, Palette, Quote,
    Underline as UnderlineIcon, Strikethrough,
    Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
    TextSelect, RemoveFormatting,
} from 'lucide-react';
import { ColorSelector } from '../ColorSelector.jsx';
import { ToolbarButton } from '../ToolbarButton.jsx';
import { HighlightSelector } from '../HighlightSelector.jsx';
import { useEditorTransaction } from '../../hooks/useEditorTransaction.js';
import { TEXT_COLOR_PRESETS } from '../../constants.js';
import { FontSizeSelector } from '../FontSizeSelector.jsx';
import { LinkSelector } from '../LinkSelector.jsx';
import { useInscriptEditorTranslations } from '../../hooks/useInscriptEditorTranslations.js';
import { BUBBLE_PRESETS } from '../../toolbar/presets.js';
import { DIVIDER, sanitizeToolConfig } from '../../toolbar/toolRegistry.js';
import { isActiveCached } from '../../utils/editorView.js';
import { abbreviationTool } from '../../toolbar/abbreviationTool.js';

/**
 * A button of the selection menu: a ToolbarButton (named by its tooltip, a toggle when given
 * `active`) drawn the way this menu marks an applied format, in the accent colour.
 */
const MenuButton = (props) => (
    <ToolbarButton
        {...props}
        activeClassName="text-[var(--inscript-color-accent)] bg-[var(--inscript-color-active)] hover:bg-[var(--inscript-color-hover)]"
    />
);

function buildToolMap(editor, t, onAddAbbreviation) {
    return {
        bold: {
            id: 'bold',
            render: () => (
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    title={t('bold', 'Bold')}
                    active={isActiveCached(editor, 'bold')}
                >
                    <Bold size={16} />
                </MenuButton>
            )
        },
        italic: {
            id: 'italic',
            render: () => (
                <MenuButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    title={t('italic', 'Italic')}
                    active={isActiveCached(editor, 'italic')}
                >
                    <Italic size={16} />
                </MenuButton>
            )
        },
        underline: {
            id: 'underline',
            render: () => (
                <MenuButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    title={t('underline', 'Underline')}
                    active={isActiveCached(editor, 'underline')}
                >
                    <UnderlineIcon size={16} />
                </MenuButton>
            )
        },
        strike: {
            id: 'strike',
            render: () => (
                <MenuButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    title={t('strike', 'Strikethrough')}
                    active={isActiveCached(editor, 'strike')}
                >
                    <Strikethrough size={16} />
                </MenuButton>
            )
        },
        sub: {
            id: 'sub',
            render: () => (
                <MenuButton
                    onClick={() => editor.chain().focus().toggleSubscript().run()}
                    title={t('subscript', 'Subscript')}
                    active={isActiveCached(editor, 'subscript')}
                >
                    <SubscriptIcon size={16} />
                </MenuButton>
            )
        },
        sup: {
            id: 'sup',
            render: () => (
                <MenuButton
                    onClick={() => editor.chain().focus().toggleSuperscript().run()}
                    title={t('superscript', 'Superscript')}
                    active={isActiveCached(editor, 'superscript')}
                >
                    <SuperscriptIcon size={16} />
                </MenuButton>
            )
        },
        abbreviation: {
            id: 'abbreviation',
            render: () => {
                const { action, active, toggle } = abbreviationTool(editor, t, onAddAbbreviation);
                return (
                    <MenuButton onClick={action} title={t('abbreviation', 'Abbreviation')} active={active} toggle={toggle}>
                        <TextSelect size={16} />
                    </MenuButton>
                );
            }
        },
        fontSize: {
            id: 'fontSize',
            render: () => <FontSizeSelector editor={editor} />
        },
        highlight: {
            id: 'highlight',
            render: () => (
                <HighlightSelector editor={editor} title={t('highlight', 'Highlight')} />
            )
        },
        color: {
            id: 'color',
            render: () => (
                <ColorSelector
                    icon={Palette}
                    title={t('textColor', 'Text Color')}
                    activeColor={editor.getAttributes('textStyle').color}
                    onChange={(color) => editor.chain().focus().setColor(color).run()}
                    onRemove={() => editor.chain().focus().unsetColor().run()}
                    presets={TEXT_COLOR_PRESETS}
                    variant="text"
                />
            )
        },
        link: {
            id: 'link',
            render: () => <LinkSelector editor={editor} />
        },
        inlineCode: {
            id: 'inlineCode',
            render: () => (
                <MenuButton
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    title={t('inlineCode', 'Inline Code')}
                    active={isActiveCached(editor, 'code')}
                >
                    <Code size={16} />
                </MenuButton>
            )
        },
        clearFormat: {
            id: 'clearFormat',
            render: () => (
                <MenuButton
                    onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                    title={t('clearFormat', 'Clear Formatting')}
                >
                    <RemoveFormatting size={16} />
                </MenuButton>
            )
        },
        code: {
            id: 'code',
            render: () => (
                <MenuButton
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    title={t('codeBlock', 'Code Block')}
                    active={isActiveCached(editor, 'codeBlock')}
                >
                    <Code size={16} />
                </MenuButton>
            )
        },
        quote: {
            id: 'quote',
            render: () => (
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    title={t('quote', 'Quote')}
                    active={isActiveCached(editor, 'blockquote')}
                >
                    <Quote size={16} />
                </MenuButton>
            )
        }
    };
}

export const TextBubbleMenu = ({ editor, isReadonly, bubbleMenuConfig, onAddAbbreviation, scrollContainer, menuContainer }) => {
    useInscriptEditorTranslations();
    const { t } = useInscriptT();
    // The tools' active states are read from the editor while rendering.
    useEditorTransaction(editor);
    // Stable identity: TipTap's BubbleMenu dispatches a transaction whenever this prop changes,
    // so an inline function would dispatch one on every render (and, in a menu that re-renders
    // on transactions, loop forever).
    const menuOptions = useBubbleMenuOptions('top', scrollContainer);
    // For selected text only: a selected node (an image, a video, an embed, a formula, a diagram,
    // a rule) has its own menu or none, and table cells have theirs.
    const shouldShow = useCallback(({ editor: current }) => {
        if (isReadonly) return false;
        const { selection } = current.state;
        if (selection.empty || selection.node || '$anchorCell' in selection) return false;
        return true;
    }, [isReadonly]);

    // Validated once per value, like the toolbar's (duplicates rendered twice under one key).
    const bubbleConfigKey = bubbleMenuConfig ? JSON.stringify(bubbleMenuConfig) : '';
    const activeConfig = useMemo(
        () => (bubbleMenuConfig ? sanitizeToolConfig(bubbleMenuConfig, 'bubble') : BUBBLE_PRESETS.full),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [bubbleConfigKey],
    );

    if (!editor) return null;

    const toolMap = buildToolMap(editor, t, onAddAbbreviation);

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={shouldShow}
            options={menuOptions}
            appendTo={bubbleMenuContainer(menuContainer)}
            style={BUBBLE_MENU_STYLE}
        >
            <div className="bg-[var(--inscript-color-surface-raised)] border border-[var(--inscript-color-border-strong)] rounded-lg shadow-xl flex items-center p-1 gap-1 flex-wrap overflow-visible max-w-[90vw] custom-scrollbar">
                {activeConfig.map((entry, idx) => {
                    if (entry === DIVIDER) {
                        return <div key={`div-${idx}`} className="w-px h-4 bg-[var(--inscript-color-border)] mx-1 shrink-0" />;
                    }
                    const tool = toolMap[entry];
                    if (!tool) return null;
                    return <span key={`${entry}-${idx}`}>{tool.render()}</span>;
                })}
            </div>
        </BubbleMenu>
    );
};
