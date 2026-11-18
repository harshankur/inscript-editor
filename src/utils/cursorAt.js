import { TextSelection } from '@tiptap/pm/state';
import { GapCursor } from '@tiptap/pm/gapcursor';

/**
 * A cursor right at a position: in a line, there; between blocks, at the start of the next block's
 * first line when nothing comes before it (a paragraph, a list's first item), else a gap cursor
 * there (typing makes a line), else at the end of the line just before; null where none can be.
 * Never one in text further on (past a rule, in a table). Shared by image files put in and a cursor a
 * command leaves between blocks (see ImageFiles.js, ValidSelection.js).
 * @param {import('@tiptap/pm/model').Node} doc
 * @param {number} pos
 * @returns {import('@tiptap/pm/state').Selection | null}
 */
export function cursorAt(doc, pos) {
    const $pos = doc.resolve(pos);
    if ($pos.parent.inlineContent) return TextSelection.create(doc, pos);
    let inner = pos;
    let node = $pos.nodeAfter;
    // Into a list or a quote, not a table (its cells are not lines after the position).
    while (node && !node.isTextblock && !node.isAtom && !node.type.spec.isolating && node.firstChild) {
        inner += 1;
        node = node.firstChild;
    }
    if (node?.isTextblock) return TextSelection.create(doc, inner + 1);
    // (GapCursor.valid is ProseMirror's own rule, not promised to stay: asked only where it is.)
    if (typeof GapCursor.valid === 'function' && GapCursor.valid($pos)) return new GapCursor($pos);
    // Right after a line (no gap cursor beside a line): at its end.
    return $pos.nodeBefore?.isTextblock ? TextSelection.create(doc, pos - 1) : null;
}
