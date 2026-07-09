import { Node, mergeAttributes } from '@tiptap/core';

export const DefinitionList = Node.create({
    name: 'definitionList',
    group: 'block',
    content: '(definitionTerm definitionDescription+)+',

    parseHTML() {
        return [{ tag: 'dl' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['dl', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            toggleDefinitionList: () => ({ commands }) => {
                return commands.toggleList(this.name, 'definitionTerm');
            },
        };
    },
});

export const DefinitionTerm = Node.create({
    name: 'definitionTerm',
    content: 'inline*',
    defining: true,

    parseHTML() {
        return [{ tag: 'dt' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['dt', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },
});

export const DefinitionDescription = Node.create({
    name: 'definitionDescription',
    content: 'block+',
    defining: true,

    parseHTML() {
        return [{ tag: 'dd' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['dd', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },
});
