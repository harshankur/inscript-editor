import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state';
import { cursorAt } from '../utils/cursorAt.js';

const validSelectionKey = new PluginKey('inscriptValidSelection');

/** Whether a selection is a text cursor outside text (between blocks: no text goes there). */
const strayCursor = selection => selection instanceof TextSelection && selection.empty && !selection.$head.parent.inlineContent;

/**
 * A text cursor never left where no text goes. A command may leave one between blocks (TipTap 3.34's
 * divider does, from a selection running from one block into another): typing there goes nowhere, and
 * the next command reads a cursor in no block. Any change that leaves one has it put right there, as
 * a cursor can be (see cursorAt: the line it sits against, a gap cursor between blocks that hold none,
 * the end of the line before); else the nearest selection ProseMirror finds there. A range is left
 * as it is, whatever its ends: it keeps what it spans (select-all on a document that opens with a
 * video holds the video too).
 */
export const ValidSelection = Extension.create({
    name: 'validSelection',
    addProseMirrorPlugins() {
        return [new Plugin({
            key: validSelectionKey,
            appendTransaction(transactions, _oldState, state) {
                if (!transactions.some(tr => tr.selectionSet || tr.docChanged)) return null;
                const { selection } = state;
                if (!strayCursor(selection)) return null;
                const { $head } = selection;
                // Else ProseMirror's nearest selection (never text far on, past a table's cells).
                const near = cursorAt(state.doc, $head.pos) ?? Selection.near($head);
                return state.tr.setSelection(near);
            },
        })];
    },
});
