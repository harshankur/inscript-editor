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
                        const { $from, $to } = selection;

                        // Find the block node that contains the selection
                        let startNodePos = $from.before(1);
                        let endNodePos = $to.after(1);

                        if (startNodePos !== undefined) {
                            decorations.push(
                                Decoration.node(startNodePos, startNodePos + doc.nodeAt(startNodePos).nodeSize, {
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
