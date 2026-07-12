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
                parseHTML: dom => dom.getAttribute('data-key'),
                renderHTML: attrs => ({ 'data-key': attrs.key }),
            },
            label: {
                default: '',
                parseHTML: dom => dom.getAttribute('data-label'),
                renderHTML: attrs => ({ 'data-label': attrs.label }),
            },
            title: {
                default: '',
                parseHTML: dom => dom.getAttribute('title'),
                renderHTML: attrs => ({ 'title': attrs.title }),
            }
        };
    },

    parseHTML() {
        return [{ tag: 'span.citation' }];
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
