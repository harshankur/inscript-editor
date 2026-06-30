import { BubbleMenu } from '@tiptap/react/menus';
import { Bold, Code, Highlighter, Italic, Palette, Quote } from 'lucide-react';
import { ColorSelector } from '../ColorSelector.jsx';
import { FontSizeSelector } from '../FontSizeSelector.jsx';
import { LinkSelector } from '../LinkSelector.jsx';

export const TextBubbleMenu = ({ editor, isReadonly }) => {
    if (!editor) return null;
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
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('bold') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title="Bold"
                >
                    <Bold size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('italic') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title="Italic"
                >
                    <Italic size={16} />
                </button>
                <LinkSelector editor={editor} />
                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-1" />
                <FontSizeSelector editor={editor} />
                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-1" />
                <ColorSelector
                    icon={Highlighter}
                    title="Highlight"
                    activeColor={editor.getAttributes('highlight').color}
                    onChange={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
                    onRemove={() => editor.chain().focus().unsetHighlight().run()}
                    presets={['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff', '#fed7aa', '#fecaca']}
                    variant="highlight"
                />
                <ColorSelector
                    icon={Palette}
                    title="Text Color"
                    activeColor={editor.getAttributes('textStyle').color}
                    onChange={(color) => editor.chain().focus().setColor(color).run()}
                    onRemove={() => editor.chain().focus().unsetColor().run()}
                    presets={['#000000', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#71717a']}
                    variant="text"
                />
                <div className="w-px h-4 bg-zinc-100 dark:bg-zinc-800 mx-1" />
                <button
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('codeBlock') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title="Code Block"
                >
                    <Code size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`w-[38px] h-[38px] flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${editor.isActive('blockquote') ? 'text-yellow-400 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title="Quote"
                >
                    <Quote size={16} />
                </button>
            </div>
        </BubbleMenu>
    );
};
