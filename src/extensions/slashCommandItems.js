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
