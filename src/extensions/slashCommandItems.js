export const getDefaultSlashItems = (t, options = {}) => [
    {
        id: 'h1',
        title: t('heading1', 'Heading 1'),
        subtitle: t('h1Subtitle', 'Big section heading'),
        keywords: ['h1', 'heading', 'title'],
        group: 'text',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
        }
    },
    {
        id: 'h2',
        title: t('heading2', 'Heading 2'),
        subtitle: t('h2Subtitle', 'Medium section heading'),
        keywords: ['h2', 'heading', 'subtitle'],
        group: 'text',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
        }
    },
    {
        id: 'h3',
        title: t('heading3', 'Heading 3'),
        subtitle: t('h3Subtitle', 'Small section heading'),
        keywords: ['h3', 'heading', 'subtitle'],
        group: 'text',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
        }
    },
    {
        id: 'bulletList',
        title: t('bulletList', 'Bullet List'),
        subtitle: t('bulletListSubtitle', 'Create a simple bulleted list'),
        keywords: ['bullet', 'list', 'unordered'],
        group: 'list',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBulletList().run();
        }
    },
    {
        id: 'orderedList',
        title: t('orderedList', 'Numbered List'),
        subtitle: t('orderedListSubtitle', 'Create a list with numbering'),
        keywords: ['ordered', 'list', 'number'],
        group: 'list',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        }
    },
    ...(options.taskList !== false ? [{
        id: 'taskList',
        title: t('taskList', 'Task List'),
        subtitle: t('taskListSubtitle', 'Track tasks with a to-do list'),
        keywords: ['task', 'list', 'todo', 'check'],
        group: 'list',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleTaskList().run();
        }
    }] : []),
    ...(options.admonition !== false ? [
        {
            id: 'admonitionNote',
            title: t('admonitionNote', 'Admonition ▸ Note'),
            subtitle: t('admonitionNoteSubtitle', 'Add a note admonition'),
            keywords: ['admonition', 'note', 'info'],
            group: 'text',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setAdmonition('note').run();
            }
        },
        {
            id: 'admonitionTip',
            title: t('admonitionTip', 'Admonition ▸ Tip'),
            subtitle: t('admonitionTipSubtitle', 'Add a tip admonition'),
            keywords: ['admonition', 'tip', 'idea'],
            group: 'text',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setAdmonition('tip').run();
            }
        },
        {
            id: 'admonitionImportant',
            title: t('admonitionImportant', 'Admonition ▸ Important'),
            subtitle: t('admonitionImportantSubtitle', 'Add an important admonition'),
            keywords: ['admonition', 'important', 'warning'],
            group: 'text',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setAdmonition('important').run();
            }
        },
        {
            id: 'admonitionWarning',
            title: t('admonitionWarning', 'Admonition ▸ Warning'),
            subtitle: t('admonitionWarningSubtitle', 'Add a warning admonition'),
            keywords: ['admonition', 'warning', 'alert'],
            group: 'text',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setAdmonition('warning').run();
            }
        },
        {
            id: 'admonitionCaution',
            title: t('admonitionCaution', 'Admonition ▸ Caution'),
            subtitle: t('admonitionCautionSubtitle', 'Add a caution admonition'),
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
            title: t('footnote', 'Footnote'),
            subtitle: t('footnoteSubtitle', 'Insert a footnote reference'),
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
            title: t('citation', 'Citation'),
            subtitle: t('citationSubtitle', 'Insert a citation reference'),
            keywords: ['citation', 'reference', 'bibliography', 'key'],
            group: 'text',
            command: ({ editor, range }) => {
                const key = prompt('Enter Citation Key (e.g. author2026):', '');
                if (key) {
                    const label = prompt('Enter Inline Label (e.g. Author, 2026):', key);
                    const title = prompt('Enter Bibliography Entry detail (e.g. Full publication citation):', '');
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
            title: t('slash.mermaid', 'Mermaid Diagram'),
            subtitle: t('slash.mermaidDesc', 'Insert a mermaid diagram'),
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
            title: t('slash.math', 'Math Block'),
            subtitle: t('slash.mathDesc', 'Insert a LaTeX math block'),
            keywords: ['math', 'latex', 'formula'],
            group: 'text',
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).insertContent({ type: 'mathBlock' }).run();
            }
        }
    ] : []),
    {
        id: 'blockquote',
        title: t('quote', 'Quote'),
        subtitle: t('quoteSubtitle', 'Capture a quote'),
        keywords: ['quote', 'blockquote'],
        group: 'text',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        }
    },
    {
        id: 'codeBlock',
        title: t('codeBlock', 'Code Block'),
        subtitle: t('codeBlockSubtitle', 'Insert a block of code'),
        keywords: ['code', 'block', 'pre'],
        group: 'text',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        }
    },
    {
        id: 'table',
        title: t('insertTable', 'Table'),
        subtitle: t('tableSubtitle', 'Insert a 3x3 table'),
        keywords: ['table', 'grid'],
        group: 'media',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        }
    },
    ...(options.onShowMediaLibrary ? [{
        id: 'image',
        title: t('insertImage', 'Image'),
        subtitle: t('imageSubtitle', 'Upload or select an image'),
        keywords: ['image', 'picture', 'photo'],
        group: 'media',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            options.onShowMediaLibrary();
        }
    }] : []),
    ...(options.onAddYoutube ? [{
        id: 'youtube',
        title: t('embedYoutube', 'YouTube Video'),
        subtitle: t('youtubeSubtitle', 'Embed a YouTube video'),
        keywords: ['youtube', 'video', 'embed'],
        group: 'media',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            options.onAddYoutube();
        }
    }] : []),
    {
        id: 'horizontalRule',
        title: t('horizontalRule', 'Divider'),
        subtitle: t('hrSubtitle', 'Insert a horizontal line'),
        keywords: ['hr', 'divider', 'line', 'horizontal rule'],
        group: 'text',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        }
    }
];
