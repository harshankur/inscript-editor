import { Node, mergeAttributes } from '@tiptap/core';

export const Citation = Node.create({
    name: 'citation',
    group: 'inline',
    inline: true,
    atom: true,

    addAttributes() {
        return {
            key: {
                default: '',
                // officeParser's default (flag-off) emission uses `data-citation-key`;
                // its opt-in emission and our own render use `data-key`.
                parseHTML: dom => dom.getAttribute('data-key') || dom.getAttribute('data-citation-key') || '',
                // Omit the attribute entirely when empty for a cleaner round-trip.
                renderHTML: attrs => (attrs.key ? { 'data-key': attrs.key } : {}),
            },
            label: {
                default: '',
                // Default the label to the key when absent — officeParser's opt-in
                // emission carries only `data-key`/`data-citation-key`.
                parseHTML: dom => dom.getAttribute('data-label')
                    || dom.getAttribute('data-key')
                    || dom.getAttribute('data-citation-key')
                    || '',
                renderHTML: attrs => (attrs.label ? { 'data-label': attrs.label } : {}),
            },
            title: {
                default: '',
                parseHTML: dom => dom.getAttribute('title') || '',
                renderHTML: attrs => (attrs.title ? { 'title': attrs.title } : {}),
            }
        };
    },

    parseHTML() {
        return [
            { tag: 'span.citation' },
            // officeParser's default (flag-off) citation shape.
            { tag: 'cite[data-citation-key]' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const label = HTMLAttributes['data-label'] || HTMLAttributes['data-key'] || 'Citation';
        return [
            'span',
            mergeAttributes(HTMLAttributes, {
                class: 'citation cursor-help bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded text-[0.9em] font-medium border border-emerald-500/20 select-all',
            }),
            `[${label}]`
        ];
    },

    addCommands() {
        return {
            insertCitation: (attributes) => ({ chain }) => {
                return chain().insertContent({ type: this.name, attrs: attributes }).run();
            },
        };
    },
});
