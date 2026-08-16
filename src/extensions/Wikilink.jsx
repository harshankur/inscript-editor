import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

const WikilinkComponent = (props) => {
    const { node, extension } = props;
    const { target, alias } = node.attrs;
    const { resolver } = extension.options;
    
    let resolved = { exists: false, href: '#', onNavigate: null };
    if (resolver) {
        resolved = resolver(target) || resolved;
    }
    
    const display = alias || target;
    // Missing links are usually styled slightly muted or dashed
    const className = `wikilink ${resolved.exists 
        ? 'text-indigo-600 dark:text-indigo-400 hover:underline' 
        : 'text-zinc-500 dark:text-zinc-400 opacity-80 decoration-dashed underline'} cursor-pointer transition-colors`;
    
    const handleClick = (e) => {
        if (resolved.onNavigate) {
            e.preventDefault();
            e.stopPropagation();
            resolved.onNavigate(target);
        }
    };
    
    return (
        <NodeViewWrapper as="span" className="inline-flex items-center">
            <a href={resolved.href} onClick={handleClick} className={className} data-wikilink="true" data-target={target} title={resolved.exists ? `Go to ${target}` : `Create ${target}`}>
                {display}
            </a>
        </NodeViewWrapper>
    );
};

export const Wikilink = Node.create({
    name: 'wikilink',
    group: 'inline',
    inline: true,
    atom: true,

    addOptions() {
        return {
            resolver: null,
        };
    },

    addAttributes() {
        return {
            target: {
                default: null,
                parseHTML: element => element.getAttribute('data-target'),
                renderHTML: attributes => (attributes.target ? { 'data-target': attributes.target } : {}),
            },
            alias: {
                default: null,
                // The node is an atom, so ProseMirror discards its text content on
                // parse — fall back to the anchor's visible text for the alias when
                // `data-alias` is absent (officeParser emits the alias as link text),
                // unless that text is just the target repeated.
                parseHTML: element => {
                    const explicit = element.getAttribute('data-alias');
                    if (explicit) return explicit;
                    const text = element.textContent?.trim();
                    const target = element.getAttribute('data-target');
                    return text && text !== target ? text : null;
                },
                renderHTML: attributes => (attributes.alias ? { 'data-alias': attributes.alias } : {}),
            },
        };
    },

    parseHTML() {
        return [
            // Accept any `data-wikilink` value, not only the exact "true".
            {
                tag: 'a[data-wikilink]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const display = HTMLAttributes['data-alias'] || HTMLAttributes['data-target'];
        return ['a', mergeAttributes({ 'data-wikilink': 'true' }, HTMLAttributes), display];
    },

    addNodeView() {
        return ReactNodeViewRenderer(WikilinkComponent);
    },
    
    addCommands() {
        return {
            insertWikilink: ({ target, alias }) => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: { target, alias }
                });
            }
        };
    }
});
