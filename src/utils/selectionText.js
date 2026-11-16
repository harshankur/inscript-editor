/**
 * The selected text within one block, as the commands that turn it into an inline node (a key, a
 * formula) read it.
 */

const SPACE = /^\s$/;
const isCode = mark => mark.type.spec.code;

/** Whether a range's text, or a cursor's place (code on both sides of it), is inline code. */
export function inInlineCode(doc, from, to) {
    if (from === to) {
        const $pos = doc.resolve(from);
        return [$pos.nodeBefore, $pos.nodeAfter].every(node => node?.isText && node.marks.some(isCode));
    }
    let found = false;
    doc.nodesBetween(from, to, node => {
        if (node.isText && node.marks.some(isCode)) found = true;
    });
    return found;
}

/**
 * A range without the spaces at its edges (a double-click often takes one along), a leaf node
 * counted by its text (leafText): what is left of it, or an empty range at its end when it is all
 * spaces.
 * @param {import('@tiptap/pm/model').Node} doc
 * @param {number} from
 * @param {number} to
 * @param {(node: import('@tiptap/pm/model').Node) => string} leafText
 */
export function withoutEdgeSpaces(doc, from, to, leafText) {
    const charAt = pos => doc.textBetween(pos, pos + 1, ' ', leafText);
    let start = from;
    let end = to;
    while (start < end && SPACE.test(charAt(start))) start += 1;
    while (end > start && SPACE.test(charAt(end - 1))) end -= 1;
    return start === end ? { from: to, to } : { from: start, to: end };
}

/**
 * The formatting all of a range's text shares (a bold word's bold, a linked word's link), for the
 * node it becomes; formatting on only part of it is left off. Null when the range holds no text.
 * @param {import('@tiptap/pm/model').Node} doc
 * @param {number} from
 * @param {number} to
 * @returns {readonly import('@tiptap/pm/model').Mark[] | null}
 */
export function sharedMarks(doc, from, to) {
    let shared = null;
    doc.nodesBetween(from, to, node => {
        if (!node.isText) return;
        shared = shared === null ? node.marks : shared.filter(mark => mark.isInSet(node.marks));
    });
    return shared;
}

/**
 * Whether a range holds only text, and those inline nodes that count as text (`counts`): nothing
 * that is not text to a node made from it (a footnote, a citation), and that it would delete.
 * @param {import('@tiptap/pm/model').Node} doc
 * @param {number} from
 * @param {number} to
 * @param {(node: import('@tiptap/pm/model').Node) => boolean} counts
 */
export function onlyTextBetween(doc, from, to, counts) {
    let onlyText = true;
    doc.nodesBetween(from, to, node => {
        if (node.isInline && !node.isText && !counts(node)) onlyText = false;
    });
    return onlyText;
}
