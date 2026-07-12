import { useTranslation } from 'react-i18next';
import { BubbleMenu } from '@tiptap/react/menus';
import {
    Bold, Code, Highlighter, Italic, Palette, Quote,
    Underline as UnderlineIcon, Strikethrough,
    Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
    TextSelect,
} from 'lucide-react';
import { ColorSelector } from '../ColorSelector.jsx';
import { FontSizeSelector } from '../FontSizeSelector.jsx';
import { LinkSelector } from '../LinkSelector.jsx';
import { useInscriptEditorTranslations } from '../../hooks/useInscriptEditorTranslations.js';
import { BUBBLE_PRESETS } from '../../toolbar/presets.js';
import { DIVIDER } from '../../toolbar/toolRegistry.js';

function buildToolMap(editor, t) {
    return {
        bold: {
            id: 'bold',
            render: () => (
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('bold') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title={t('bold', 'Bold')}
                >
                    <Bold size={16} />
                </button>
            )
        },
        italic: {
            id: 'italic',
            render: () => (
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('italic') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title={t('italic', 'Italic')}
                >
                    <Italic size={16} />
                </button>
            )
        },
        underline: {
            id: 'underline',
            render: () => (
                <button
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('underline') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title={t('underline', 'Underline')}
                >
                    <UnderlineIcon size={16} />
                </button>
            )
        },
        strike: {
            id: 'strike',
            render: () => (
                <button
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('strike') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title={t('strike', 'Strikethrough')}
                >
                    <Strikethrough size={16} />
                </button>
            )
        },
        sub: {
            id: 'sub',
            render: () => (
                <button
                    onClick={() => editor.chain().focus().toggleSubscript().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('subscript') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title={t('subscript', 'Subscript')}
                >
                    <SubscriptIcon size={16} />
                </button>
            )
        },
        sup: {
            id: 'sup',
            render: () => (
                <button
                    onClick={() => editor.chain().focus().toggleSuperscript().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('superscript') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title={t('superscript', 'Superscript')}
                >
                    <SuperscriptIcon size={16} />
                </button>
            )
        },
        abbreviation: {
            id: 'abbreviation',
            render: () => (
                <button
                    onClick={() => editor.chain().focus().setAbbreviation().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('abbreviation') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
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
                <ColorSelector
                    icon={Highlighter}
                    title={t('highlight', 'Highlight')}
                    activeColor={editor.getAttributes('highlight').color}
                    onChange={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
                    onRemove={() => editor.chain().focus().unsetHighlight().run()}
                    presets={['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff', '#fed7aa', '#fecaca']}
                    variant="highlight"
                />
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
                    presets={['#000000', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#71717a']}
                    variant="text"
                />
            )
        },
        link: {
            id: 'link',
            render: () => <LinkSelector editor={editor} />
        },
        code: {
            id: 'code',
            render: () => (
                <button
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('codeBlock') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title={t('codeBlock', 'Code Block')}
                >
                    <Code size={16} />
                </button>
            )
        },
        quote: {
            id: 'quote',
            render: () => (
                <button
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('blockquote') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title={t('quote', 'Quote')}
                >
                    <Quote size={16} />
                </button>
            )
        }
    };
}

export const TextBubbleMenu = ({ editor, isReadonly, bubbleMenuConfig }) => {
    useInscriptEditorTranslations();
    const { t } = useTranslation('inscript-editor');

    if (!editor) return null;

    const activeConfig = bubbleMenuConfig ?? BUBBLE_PRESETS.full;
    const toolMap = buildToolMap(editor, t);

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={({ editor }) => {
                if (isReadonly || editor.isActive('image') || editor.isActive('youtube')) return false;
                const isCellSelection = '$anchorCell' in editor.state.selection;
                return !editor.state.selection.empty && !isCellSelection;
            }}
            tippyOptions={{ duration: 100, zIndex: 9999, maxWidth: '98vw', interactive: true }}
        >
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-xl flex items-center p-1 gap-1 flex-wrap overflow-visible max-w-[90vw] custom-scrollbar">
                {activeConfig.map((entry, idx) => {
                    if (entry === DIVIDER) {
                        return <div key={`div-${idx}`} className="w-px h-4 bg-zinc-100/50 dark:bg-zinc-800/50 mx-1 shrink-0" />;
                    }
                    const tool = toolMap[entry];
                    if (!tool) return null;
                    return <span key={`${entry}-${idx}`}>{tool.render()}</span>;
                })}
            </div>
        </BubbleMenu>
    );
};
