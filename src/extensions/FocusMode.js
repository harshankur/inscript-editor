import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const FocusModeBlock = Extension.create({
    name: 'focusModeBlock',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('focusModeBlock'),
                props: {
                    decorations: ({ doc, selection }) => {
                        const { isEditable, isFocused } = this.editor;
                        // Only apply active classes if the editor is actually focused and editable
                        if (!isEditable || !isFocused) return DecorationSet.empty;

                        const decorations = [];
                        const { $from } = selection;

                        // Position before the top-level block containing the selection. At depth 0
                        // (e.g. a NodeSelection on a top-level atom, or a gap cursor) `before(1)`
                        // returns the boundary position itself, where there may be no node — so guard
                        // `nodeAt` before reading `.nodeSize` (a gap cursor at the doc end would be null).
                        const startNodePos = $from.before(1);
                        const focusNode = doc.nodeAt(startNodePos);

                        if (focusNode) {
                            decorations.push(
                                Decoration.node(startNodePos, startNodePos + focusNode.nodeSize, {
                                    class: 'has-focus',
                                })
                            );
                        }

                        return DecorationSet.create(doc, decorations);
                    },
                },
            }),
        ];
    },
});
