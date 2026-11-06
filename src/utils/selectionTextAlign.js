import { cellAround } from '@tiptap/pm/tables';
import { cachedPerState, hasView } from './editorView.js';
import { readingAlign } from './cellAlignment.js';
import { COLUMN_ALIGN } from '../constants.js';

/** The table cell around a position (text in a list in a cell too), or null. */
const cellNodeAround = $pos => cellAround($pos)?.nodeAfter ?? null;

/**
 * The alignment of the paragraphs and headings the selection covers, as a reader sees it (see
 * readingAlign: in a table cell the cell's own alignment counts, as the table menu and the Markdown
 * writer read it): 'left' for text with none of its own, 'center', 'right' or 'justify' when they
 * all agree; null when they differ, when the selection holds a block that cannot be aligned (a code
 * block, an image, a rule), or before the editor has a view. Only the selected ranges are read (a
 * cell selection's cells, not the cells between them). Once per editor state.
 * @param {import('@tiptap/core').Editor} editor
 * @returns {'left'|'center'|'right'|'justify'|null}
 */
export function selectionTextAlign(editor) {
    if (!hasView(editor)) return null;
    return cachedPerState(editor.state, 'selectionTextAlign', () => {
        const { selection, doc } = editor.state;
        const seen = new Set();
        const read = (node, $pos) => {
            if (!('textAlign' in node.attrs)) { seen.add(null); return; }
            seen.add(readingAlign(cellNodeAround($pos)?.attrs.align, node.attrs.textAlign) ?? COLUMN_ALIGN.LEFT);
        };
        // A selected leaf block (an image) is read as itself; a selected inline node (a citation,
        // inline math) as the paragraph it sits in; a selected container (a quote, a list) by the
        // paragraphs in it, below.
        const { node: selected } = selection;
        if (selected?.isBlock && (selected.isAtom || selected.isTextblock)) read(selected, selection.$from);
        else if (selection.empty || (selected && !selected.isBlock)) read(selection.$from.parent, selection.$from);
        else {
            for (const range of selection.ranges) {
                const from = range.$from.pos;
                const to = range.$to.pos;
                doc.nodesBetween(from, to, (node, pos) => {
                    if (seen.size > 1) return false; // they differ already: nothing more to learn
                    if (node.isTextblock) {
                        // Only a block with selected text counts, not one the range merely touches at
                        // its edge (a selection ending at the start of the next paragraph).
                        const start = pos + 1;
                        const end = pos + node.nodeSize - 1;
                        const holdsSelection = node.content.size === 0 ? from <= start && start < to : start < to && end > from;
                        if (holdsSelection) read(node, doc.resolve(start));
                        return false;
                    }
                    // An image, a rule or an embed in the selection: text alignment does not reach it.
                    if (node.isBlock && node.isAtom) { seen.add(null); return false; }
                    return true;
                });
            }
        }
        if (seen.size === 0) read(selection.$from.parent, selection.$from);
        return seen.size === 1 ? [...seen][0] : null;
    });
}
