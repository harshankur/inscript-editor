import { mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Table } from '@tiptap/extension-table';

const tableAlignKey = new PluginKey('tableAlign');

export const CustomTable = Table.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            align: {
                default: 'center',
                parseHTML: element => element.getAttribute('data-align') || 'center',
                renderHTML: () => ({}),
            },
        };
    },
    renderHTML({ node, HTMLAttributes }) {
        const a = node.attrs.align || 'center';
        return this.parent?.({
            node,
            HTMLAttributes: mergeAttributes(HTMLAttributes, {
                'data-align': a,
                style: `margin-left: ${a === 'left' ? '0' : 'auto'}; margin-right: ${a === 'right' ? '0' : 'auto'};`,
            }),
        });
    },
    addProseMirrorPlugins() {
        // When resizable:true, TipTap's Table.addNodeView() returns null and the columnResizing
        // plugin (added here by this.parent?.()) registers its own NodeView (TableView) which
        // creates div.tableWrapper > table. We cannot safely wrap that NodeView, so we use a
        // plugin instead: after each doc change we walk all table nodes and set margins directly
        // on the wrapper DOM. TableView.ignoreMutation() already ignores style changes on its
        // own wrapper div, so this causes no re-render loop.
        const parentPlugins = this.parent?.() || [];
        return [
            ...parentPlugins,
            new Plugin({
                key: tableAlignKey,
                view(editorView) {
                    const applyAll = () => {
                        editorView.state.doc.descendants((node, pos) => {
                            if (node.type.name !== 'table') return;
                            const dom = editorView.nodeDOM(pos);
                            if (!dom) return;
                            const a = node.attrs.align || 'center';
                            dom.style.marginLeft = a === 'left' ? '0' : 'auto';
                            dom.style.marginRight = a === 'right' ? '0' : 'auto';
                        });
                    };
                    return {
                        update(view, prevState) {
                            if (!prevState || !prevState.doc.eq(view.state.doc)) applyAll();
                        },
                    };
                },
            }),
        ];
    },
});
