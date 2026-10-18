import { getHostHandlers } from './HostBridge.js';

// Read a host handler live: <InscriptEditor>'s prop or the editorOptions one through the editor's
// host bridge (options.hostHandlersRef is refreshed every render by useInscriptEditor), falling
// back to a plain editorOptions value. The slash menu, the toolbar and the selection menu share it.
const handler = (options, name, editor) => getHostHandlers(editor)[name] ?? options.hostHandlersRef?.current?.[name] ?? options[name];

/**
 * An item whose `title`/`subtitle` are resolved through `t` every time they are read, so the
 * menu (and its filtering) follows an i18n language switch made after the editor was created.
 * The keys stay on the item (`titleKey`, `subtitleKey`) for hosts that translate themselves.
 */
function localized(t, { titleKey, titleDefault, subtitleKey, subtitleDefault, ...item }) {
    return Object.defineProperties({ ...item, titleKey, subtitleKey }, {
        title: { get: () => t(titleKey, titleDefault), enumerable: true },
        subtitle: { get: () => t(subtitleKey, subtitleDefault), enumerable: true },
    });
}

export const getDefaultSlashItems = (t, options = {}) => [
    {
        id: 'h1',
        titleKey: 'heading1', titleDefault: 'Heading 1',
        subtitleKey: 'h1Subtitle', subtitleDefault: 'Big section heading',
        keywords: ['h1', 'heading', 'title'],
        group: 'text',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
        }
    },
    {
        id: 'h2',
        titleKey: 'heading2', titleDefault: 'Heading 2',
        subtitleKey: 'h2Subtitle', subtitleDefault: 'Medium section heading',
        keywords: ['h2', 'heading', 'subtitle'],
        group: 'text',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
        }
    },
    {
        id: 'h3',
        titleKey: 'heading3', titleDefault: 'Heading 3',
        subtitleKey: 'h3Subtitle', subtitleDefault: 'Small section heading',
        keywords: ['h3', 'heading', 'subtitle'],
        group: 'text',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
        }
    },
    {
        id: 'bulletList',
        titleKey: 'bulletList', titleDefault: 'Bullet List',
        subtitleKey: 'bulletListSubtitle', subtitleDefault: 'Create a simple bulleted list',
        keywords: ['bullet', 'list', 'unordered'],
        group: 'list',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBulletList().run();
        }
    },
    {
        id: 'orderedList',
        titleKey: 'orderedList', titleDefault: 'Numbered List',
        subtitleKey: 'orderedListSubtitle', subtitleDefault: 'Create a list with numbering',
        keywords: ['ordered', 'list', 'number'],
        group: 'list',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        }
    },
    ...(options.taskList !== false ? [{
        id: 'taskList',
        titleKey: 'taskList', titleDefault: 'Task List',
        subtitleKey: 'taskListSubtitle', subtitleDefault: 'Track tasks with a to-do list',
        keywords: ['task', 'list', 'todo', 'check'],
        group: 'list',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleTaskList().run();
        }
    }] : []),
    ...(options.admonition !== false ? [
        {
            id: 'admonitionNote',
            titleKey: 'admonitionNote', titleDefault: 'Admonition ▸ Note',
            subtitleKey: 'admonitionNoteSubtitle', subtitleDefault: 'Add a note admonition',
            keywords: ['admonition', 'note', 'info'],
            group: 'text',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setAdmonition('note').run();
            }
        },
        {
            id: 'admonitionTip',
            titleKey: 'admonitionTip', titleDefault: 'Admonition ▸ Tip',
            subtitleKey: 'admonitionTipSubtitle', subtitleDefault: 'Add a tip admonition',
            keywords: ['admonition', 'tip', 'idea'],
            group: 'text',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setAdmonition('tip').run();
            }
        },
        {
            id: 'admonitionImportant',
            titleKey: 'admonitionImportant', titleDefault: 'Admonition ▸ Important',
            subtitleKey: 'admonitionImportantSubtitle', subtitleDefault: 'Add an important admonition',
            keywords: ['admonition', 'important', 'warning'],
            group: 'text',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setAdmonition('important').run();
            }
        },
        {
            id: 'admonitionWarning',
            titleKey: 'admonitionWarning', titleDefault: 'Admonition ▸ Warning',
            subtitleKey: 'admonitionWarningSubtitle', subtitleDefault: 'Add a warning admonition',
            keywords: ['admonition', 'warning', 'alert'],
            group: 'text',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setAdmonition('warning').run();
            }
        },
        {
            id: 'admonitionCaution',
            titleKey: 'admonitionCaution', titleDefault: 'Admonition ▸ Caution',
            subtitleKey: 'admonitionCautionSubtitle', subtitleDefault: 'Add a caution admonition',
            keywords: ['admonition', 'caution', 'danger'],
            group: 'text',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setAdmonition('caution').run();
            }
        }
    ] : []),
    ...(options.footnote !== false ? [
        {
            id: 'footnote',
            titleKey: 'footnote', titleDefault: 'Footnote',
            subtitleKey: 'footnoteSubtitle', subtitleDefault: 'Insert a footnote reference',
            keywords: ['footnote', 'reference', 'citation'],
            group: 'text',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).insertFootnote().run();
            }
        }
    ] : []),
    ...(options.citation !== false ? [
        {
            id: 'citation',
            titleKey: 'citation', titleDefault: 'Citation',
            subtitleKey: 'citationSubtitle', subtitleDefault: 'Insert a citation reference',
            keywords: ['citation', 'reference', 'bibliography', 'key'],
            group: 'text',
            command: ({ editor, range }) => {
                // Let a host own citation entry via editorOptions.onAddCitation (its own
                // modal + an .insertCitation() call), mirroring the image/youtube slash
                // items. Otherwise fall back to native prompts (shared i18n keys with the
                // toolbar's citation button).
                const onAddCitation = handler(options, 'onAddCitation', editor);
                if (onAddCitation) {
                    editor.chain().focus().deleteRange(range).run();
                    onAddCitation();
                    return;
                }
                const key = window.prompt(t('citationKeyPrompt', 'Enter citation key (e.g. author2026):'), '');
                if (key) {
                    const label = window.prompt(t('citationLabelPrompt', 'Enter inline label (e.g. Author, 2026):'), key);
                    const title = window.prompt(t('citationTitlePrompt', 'Enter bibliography entry details:'), '');
                    editor.chain().focus().deleteRange(range).insertCitation({ key, label: label || key, title: title || '' }).run();
                } else {
                    editor.chain().focus().deleteRange(range).run();
                }
            }
        }
    ] : []),
    ...(options.mermaid !== false ? [
        {
            id: 'mermaid',
            titleKey: 'slash.mermaid', titleDefault: 'Mermaid Diagram',
            subtitleKey: 'slash.mermaidDesc', subtitleDefault: 'Insert a mermaid diagram',
            keywords: ['mermaid', 'diagram', 'chart'],
            group: 'media',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).insertContent({ type: 'mermaid' }).run();
            }
        }
    ] : []),
    ...(options.math !== false ? [
        {
            id: 'math',
            titleKey: 'slash.math', titleDefault: 'Math Block',
            subtitleKey: 'slash.mathDesc', subtitleDefault: 'Insert a LaTeX math block',
            keywords: ['math', 'latex', 'formula'],
            group: 'text',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).insertContent({ type: 'mathBlock' }).run();
            }
        }
    ] : []),
    {
        id: 'blockquote',
        titleKey: 'quote', titleDefault: 'Quote',
        subtitleKey: 'quoteSubtitle', subtitleDefault: 'Capture a quote',
        keywords: ['quote', 'blockquote'],
        group: 'text',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        }
    },
    {
        id: 'codeBlock',
        titleKey: 'codeBlock', titleDefault: 'Code Block',
        subtitleKey: 'codeBlockSubtitle', subtitleDefault: 'Insert a block of code',
        keywords: ['code', 'block', 'pre'],
        group: 'text',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        }
    },
    {
        id: 'table',
        titleKey: 'insertTable', titleDefault: 'Table',
        subtitleKey: 'tableSubtitle', subtitleDefault: 'Insert a 3x3 table',
        keywords: ['table', 'grid'],
        group: 'media',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        }
    },
    // Offered only while a host handler exists (read when the menu opens: a prop given later counts).
    {
        id: 'image',
        titleKey: 'insertImage', titleDefault: 'Image',
        subtitleKey: 'imageSubtitle', subtitleDefault: 'Upload or select an image',
        keywords: ['image', 'picture', 'photo'],
        group: 'media',
        isAvailable: ({ editor }) => typeof handler(options, 'onShowMediaLibrary', editor) === 'function',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            handler(options, 'onShowMediaLibrary', editor)();
        }
    },
    {
        id: 'youtube',
        titleKey: 'embedYoutube', titleDefault: 'YouTube Video',
        subtitleKey: 'youtubeSubtitle', subtitleDefault: 'Embed a YouTube video',
        keywords: ['youtube', 'video', 'embed'],
        group: 'media',
        isAvailable: ({ editor }) => typeof handler(options, 'onAddYoutube', editor) === 'function',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            handler(options, 'onAddYoutube', editor)();
        }
    },
    {
        id: 'horizontalRule',
        titleKey: 'horizontalRule', titleDefault: 'Divider',
        subtitleKey: 'hrSubtitle', subtitleDefault: 'Insert a horizontal line',
        keywords: ['hr', 'divider', 'line', 'horizontal rule'],
        group: 'text',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertDivider().run();
        }
    }
].map(item => localized(t, item));
