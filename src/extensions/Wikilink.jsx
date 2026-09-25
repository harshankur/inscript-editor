import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useTranslation } from 'react-i18next';

// Bumping this plugin's revision gives every wikilink a new (empty) node decoration, which is
// how ProseMirror tells a node view to update without touching the document or the undo stack.
const wikilinkRefreshKey = new PluginKey('wikilinkRefresh');

const WikilinkComponent = (props) => {
    const { node, extension } = props;
    const { t } = useTranslation('inscript-editor');
    const { target, alias } = node.attrs;
    const { resolver } = extension.options;

    // The host resolver runs when the node view renders. Its answer can go stale when the host's
    // data changes (the target page gets created): the host then calls editor.commands.refreshWikilinks().
    let resolved = { exists: false, href: '#', onNavigate: null };
    if (resolver) {
        try { resolved = resolver(target) || resolved; } catch { /* host resolver threw: treat as missing */ }
    }

    const display = alias || target;
    // Existing links use the (themeable) link tokens; missing ones are muted and dashed.
    const className = `wikilink ${resolved.exists
        ? 'text-[var(--inscript-color-link)] hover:text-[var(--inscript-color-link-hover)] hover:underline'
        : 'text-[var(--inscript-color-muted)] opacity-80 decoration-dashed underline'} cursor-pointer transition-colors`;
    
    const handleClick = (e) => {
        if (resolved.onNavigate) {
            e.preventDefault();
            e.stopPropagation();
            resolved.onNavigate(target);
        }
    };
    
    return (
        <NodeViewWrapper as="span" className="inline-flex items-center">
            <a href={resolved.href} onClick={handleClick} className={className} data-wikilink="true" data-target={target} title={resolved.exists ? t('wikilinkGoTo', 'Go to {{target}}', { target }) : t('wikilinkCreate', 'Create {{target}}', { target })}>
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
        const revOf = decorations => (decorations || []).reduce((rev, d) => d.spec?.wikilinkRev ?? rev, 0);
        return ReactNodeViewRenderer(WikilinkComponent, {
            // TipTap only re-renders a React node view when its node changes; a refresh changes
            // just the decoration revision, so re-render (and re-resolve) on either.
            update: ({ oldNode, newNode, oldDecorations, newDecorations, updateProps }) => {
                if (oldNode.type !== newNode.type) return false;
                if (oldNode !== newNode || revOf(oldDecorations) !== revOf(newDecorations)) updateProps();
                return true;
            },
        });
    },
    
    addCommands() {
        return {
            insertWikilink: ({ target, alias }) => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: { target, alias }
                });
            },
            /** Re-run the resolver for every wikilink (after the host's pages changed). */
            refreshWikilinks: () => ({ tr, dispatch }) => {
                if (dispatch) tr.setMeta(wikilinkRefreshKey, true).setMeta('addToHistory', false);
                return true;
            },
        };
    },

    addProseMirrorPlugins() {
        const name = this.name;
        const build = (doc, rev) => {
            const decorations = [];
            doc.descendants((node, pos) => {
                if (node.type.name === name) decorations.push(Decoration.node(pos, pos + node.nodeSize, {}, { wikilinkRev: rev }));
            });
            return DecorationSet.create(doc, decorations);
        };
        return [
            new Plugin({
                key: wikilinkRefreshKey,
                state: {
                    init: () => ({ rev: 0, decorations: DecorationSet.empty }),
                    apply: (tr, value) => {
                        if (tr.getMeta(wikilinkRefreshKey)) {
                            const rev = value.rev + 1;
                            return { rev, decorations: build(tr.doc, rev) };
                        }
                        return tr.docChanged ? { ...value, decorations: value.decorations.map(tr.mapping, tr.doc) } : value;
                    },
                },
                props: {
                    decorations: state => wikilinkRefreshKey.getState(state).decorations,
                },
            }),
        ];
    },
});
