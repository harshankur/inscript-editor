import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Info, Lightbulb, AlertTriangle, AlertOctagon, Flame } from 'lucide-react';

const icons = {
    note: Info,
    tip: Lightbulb,
    important: AlertTriangle, // Or something else
    warning: AlertOctagon,
    caution: Flame,
};

const AdmonitionComponent = ({ node, updateAttributes }) => {
    const type = node.attrs.admonitionType || 'note';
    const Icon = icons[type] || Info;

    return (
        <NodeViewWrapper className={`admonition admonition-${type}`} data-type={type}>
            <div className="admonition-header" contentEditable={false}>
                <Icon size={20} className="admonition-icon" />
                <span className="admonition-title">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
            </div>
            <NodeViewContent className="admonition-content" />
        </NodeViewWrapper>
    );
};

export const Admonition = Node.create({
    name: 'admonition',

    group: 'block',

    content: 'block+',

    defining: true,

    addAttributes() {
        return {
            admonitionType: {
                default: 'note',
                parseHTML: element => element.getAttribute('data-type'),
                renderHTML: attributes => {
                    return {
                        'data-type': attributes.admonitionType,
                        class: `admonition admonition-${attributes.admonitionType}`,
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div.admonition',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(AdmonitionComponent);
    },

    addCommands() {
        return {
            setAdmonition: (type = 'note') => ({ commands }) => {
                return commands.wrapIn(this.name, { admonitionType: type });
            },
            toggleAdmonition: (type = 'note') => ({ commands }) => {
                return commands.toggleNode(this.name, 'paragraph', { admonitionType: type });
            },
        };
    },
});
