import { Mark, mergeAttributes } from '@tiptap/core';

export const Abbreviation = Mark.create({
    name: 'abbreviation',

    addAttributes() {
        return {
            title: {
                default: null,
                parseHTML: element => element.getAttribute('title'),
                renderHTML: attributes => {
                    if (!attributes.title) return {};
                    return { title: attributes.title };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'abbr[title]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['abbr', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setAbbreviation: (title) => ({ commands }) => {
                return commands.setMark(this.name, { title });
            },
            toggleAbbreviation: (title) => ({ commands }) => {
                return commands.toggleMark(this.name, { title });
            },
            unsetAbbreviation: () => ({ commands }) => {
                return commands.unsetMark(this.name);
            },
        };
    },
});
