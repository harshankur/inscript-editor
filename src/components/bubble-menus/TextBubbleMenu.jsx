import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BubbleMenu } from '@tiptap/react/menus';
import { BUBBLE_MENU_STYLE, bubbleMenuContainer, useBubbleMenuOptions } from './menuOptions.js';
import {
    Bold, Code, Italic, Palette, Quote,
    Underline as UnderlineIcon, Strikethrough,
    Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
    TextSelect, RemoveFormatting,
} from 'lucide-react';
import { ColorSelector } from '../ColorSelector.jsx';
import { HighlightSelector } from '../HighlightSelector.jsx';
import { useEditorTransaction } from '../../hooks/useEditorTransaction.js';
import { TEXT_COLOR_PRESETS } from '../../constants.js';
import { FontSizeSelector } from '../FontSizeSelector.jsx';
import { LinkSelector } from '../LinkSelector.jsx';
import { useInscriptEditorTranslations } from '../../hooks/useInscriptEditorTranslations.js';
import { BUBBLE_PRESETS } from '../../toolbar/presets.js';
import { DIVIDER, sanitizeToolConfig } from '../../toolbar/toolRegistry.js';
import { isActiveCached } from '../../utils/editorView.js';

function buildToolMap(editor, t, onAddAbbreviation) {
    return {
        bold: {
            id: 'bold',
            render: () => (
                <button type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)] transition-colors ${isActiveCached(editor, 'bold') ? 'text-[var(--inscript-color-accent)] bg-[var(--inscript-color-active)]' : 'text-[var(--inscript-color-muted)]'}`}
                    title={t('bold', 'Bold')}
                >
                    <Bold size={16} />
                </button>
            )
        },
        italic: {
            id: 'italic',
            render: () => (
                <button type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)] transition-colors ${isActiveCached(editor, 'italic') ? 'text-[var(--inscript-color-accent)] bg-[var(--inscript-color-active)]' : 'text-[var(--inscript-color-muted)]'}`}
                    title={t('italic', 'Italic')}
                >
                    <Italic size={16} />
                </button>
            )
        },
        underline: {
            id: 'underline',
            render: () => (
                <button type="button"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)] transition-colors ${isActiveCached(editor, 'underline') ? 'text-[var(--inscript-color-accent)] bg-[var(--inscript-color-active)]' : 'text-[var(--inscript-color-muted)]'}`}
                    title={t('underline', 'Underline')}
                >
                    <UnderlineIcon size={16} />
                </button>
            )
        },
        strike: {
            id: 'strike',
            render: () => (
                <button type="button"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)] transition-colors ${isActiveCached(editor, 'strike') ? 'text-[var(--inscript-color-accent)] bg-[var(--inscript-color-active)]' : 'text-[var(--inscript-color-muted)]'}`}
                    title={t('strike', 'Strikethrough')}
                >
                    <Strikethrough size={16} />
                </button>
            )
        },
        sub: {
            id: 'sub',
            render: () => (
                <button type="button"
                    onClick={() => editor.chain().focus().toggleSubscript().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)] transition-colors ${isActiveCached(editor, 'subscript') ? 'text-[var(--inscript-color-accent)] bg-[var(--inscript-color-active)]' : 'text-[var(--inscript-color-muted)]'}`}
                    title={t('subscript', 'Subscript')}
                >
                    <SubscriptIcon size={16} />
                </button>
            )
        },
        sup: {
            id: 'sup',
            render: () => (
                <button type="button"
                    onClick={() => editor.chain().focus().toggleSuperscript().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)] transition-colors ${isActiveCached(editor, 'superscript') ? 'text-[var(--inscript-color-accent)] bg-[var(--inscript-color-active)]' : 'text-[var(--inscript-color-muted)]'}`}
                    title={t('superscript', 'Superscript')}
                >
                    <SuperscriptIcon size={16} />
                </button>
            )
        },
        abbreviation: {
            id: 'abbreviation',
            render: () => (
                <button type="button"
                    onClick={() => {
                        if (onAddAbbreviation) return onAddAbbreviation();
                        if (isActiveCached(editor, 'abbreviation')) { editor.chain().focus().unsetAbbreviation().run(); return; }
                        const title = window.prompt(t('abbreviationPrompt', 'Enter the full form (e.g. HyperText Markup Language):'));
                        if (title) editor.chain().focus().setAbbreviation(title).run();
                    }}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)] transition-colors ${isActiveCached(editor, 'abbreviation') ? 'text-[var(--inscript-color-accent)] bg-[var(--inscript-color-active)]' : 'text-[var(--inscript-color-muted)]'}`}
                    title={t('abbreviation', 'Abbreviation')}
                >
                    <TextSelect size={16} />
                </button>
            )
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
                <button type="button"
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)] transition-colors ${isActiveCached(editor, 'code') ? 'text-[var(--inscript-color-accent)] bg-[var(--inscript-color-active)]' : 'text-[var(--inscript-color-muted)]'}`}
                    title={t('inlineCode', 'Inline Code')}
                >
                    <Code size={16} />
                </button>
            )
        },
        clearFormat: {
            id: 'clearFormat',
            render: () => (
                <button type="button"
                    onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                    className="w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)] transition-colors text-[var(--inscript-color-muted)]"
                    title={t('clearFormat', 'Clear Formatting')}
                >
                    <RemoveFormatting size={16} />
                </button>
            )
        },
        code: {
            id: 'code',
            render: () => (
                <button type="button"
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)] transition-colors ${isActiveCached(editor, 'codeBlock') ? 'text-[var(--inscript-color-accent)] bg-[var(--inscript-color-active)]' : 'text-[var(--inscript-color-muted)]'}`}
                    title={t('codeBlock', 'Code Block')}
                >
                    <Code size={16} />
                </button>
            )
        },
        quote: {
            id: 'quote',
            render: () => (
                <button type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)] transition-colors ${isActiveCached(editor, 'blockquote') ? 'text-[var(--inscript-color-accent)] bg-[var(--inscript-color-active)]' : 'text-[var(--inscript-color-muted)]'}`}
                    title={t('quote', 'Quote')}
                >
                    <Quote size={16} />
                </button>
            )
        }
    };
}

export const TextBubbleMenu = ({ editor, isReadonly, bubbleMenuConfig, onAddAbbreviation, scrollContainer, menuContainer }) => {
    useInscriptEditorTranslations();
    const { t } = useTranslation('inscript-editor');
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
