import { Node, isMacOS, isiOS, mergeAttributes } from '@tiptap/core';
import { isHistoryTransaction } from '@tiptap/pm/history';
import { NodeSelection, Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Fragment, NodeRange, Slice } from '@tiptap/pm/model';
import { ReplaceAroundStep, canSplit } from '@tiptap/pm/transform';
import { editorT, onEditorLanguageChanged } from '../utils/editorT.js';
import { isOwnSummary, summaryChild } from '../utils/summaryChild.js';
import { followEditable } from './HostBridge.js';
import { DETAILS_NODE as DETAILS, DETAILS_SUMMARY_NODE as SUMMARY } from '../constants.js';
const revealKey = new PluginKey('detailsReveal');
/** The decoration that shows a closed disclosure's body (data-reveal), marked in its spec. */
// `cursor`: shown for an end of the selection in its body (not for a range passing over it).
const reveal = (pos, details, cursor = false) => Decoration.node(pos, pos + details.nodeSize, { 'data-reveal': '' }, { reveal: true, cursor });

/** The summary a new disclosure starts with (selected, so typing replaces it). */
const DEFAULT_SUMMARY = 'Details';

/**
 * Media a `<summary>` may hold inline in HTML that are blocks in this editor (an image, an embed): a
 * one-line summary cannot hold them.
 */
const SUMMARY_MEDIA = 'img, iframe, video, audio, embed, object';

/**
 * A `<details>` as the editor reads it: its summary first. A browser shows one with no `<summary>`
 * (or with it further down) all the same, so an empty summary is added, or the summary moved first,
 * rather than the body being pushed out of the disclosure. Media in the summary open the body, in
 * their order, rather than cutting the summary short at the first of them.
 * @param {HTMLElement} element
 * @returns {HTMLElement}
 */
function summaryFirst(element) {
    const summary = summaryChild(element);
    // The first thing in it a reader sees: blank text between tags does not count.
    const first = Array.from(element.childNodes).find(node => node.nodeType !== node.TEXT_NODE || node.nodeValue.trim() !== '');
    const others = Array.from(element.children).filter(child => child.nodeName === 'SUMMARY' && child !== summary);
    if (summary && first === summary && others.length === 0 && !summary.querySelector(SUMMARY_MEDIA)) return element;
    const copy = element.cloneNode(true);
    const moved = summaryChild(copy) ?? copy.ownerDocument.createElement('summary');
    // Only the first summary is one; a browser shows any other as text of the body.
    for (const extra of Array.from(copy.children).filter(child => child.nodeName === 'SUMMARY' && child !== moved)) {
        const paragraph = copy.ownerDocument.createElement('p');
        paragraph.append(...extra.childNodes);
        extra.replaceWith(paragraph);
    }
    copy.insertBefore(moved, copy.firstChild);
    moved.after(...moved.querySelectorAll(SUMMARY_MEDIA));
    return copy;
}

/** Blocks a `<summary>` may hold in HTML (a heading, a paragraph, a list); the editor's summary is one line. */
const SUMMARY_BLOCKS = [
    'address', 'article', 'aside', 'blockquote', 'dd', 'details', 'div', 'dl', 'dt', 'figcaption', 'figure',
    'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre',
    'section', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
].join(', ');

/**
 * A `<summary>` as the editor reads it: one line. Blocks in it (`<summary><h3>Title</h3></summary>`,
 * the `<p>` a renderer may add) give up their text, a space between two of them, rather than the
 * summary being left empty and its text pushed into the body.
 * @param {HTMLElement} element
 * @returns {HTMLElement}
 */
function summaryAsLine(element) {
    if (!element.querySelector(SUMMARY_BLOCKS)) return element;
    const copy = element.cloneNode(true);
    for (const block of Array.from(copy.querySelectorAll(SUMMARY_BLOCKS)).reverse()) {
        // A space only before more of the summary (not before a renderer's trailing line break).
        const after = block.nextSibling;
        const more = after && (after.nodeType !== after.TEXT_NODE || after.nodeValue.trim() !== '');
        const space = more && block.ownerDocument.createTextNode(' ');
        block.replaceWith(...block.childNodes, ...(space ? [space] : []));
    }
    return copy;
}

/**
 * The disclosure the selection is in: a selected disclosure itself, else the innermost one holding
 * the whole selection ({ node, pos, depth }), or null. The commands and the toolbar's Disclosure
 * button all go by this one.
 */
const detailsAround = selection => {
    if (selection.node?.type.name === DETAILS) {
        return { node: selection.node, pos: selection.from, depth: selection.$from.depth + 1 };
    }
    const { $from, to } = selection;
    for (let depth = $from.depth; depth > 0; depth--) {
        const node = $from.node(depth);
        if (node.type.name === DETAILS && to < $from.after(depth)) return { node, pos: $from.before(depth), depth };
    }
    return null;
};

/**
 * After closing the disclosure at `pos`, move whichever end of the selection is in its body to the
 * end of its summary, so the body really hides (a closed disclosure shows its body while the
 * selection is in it), or, when the other end is past the disclosure, to just after it; the rest
 * of the selection stays. A selection covering the whole body from
 * outside becomes a cursor at the end of the summary.
 * @param {import('@tiptap/pm/state').Transaction} tr
 * @param {number} pos
 * @param {import('@tiptap/pm/model').Node} details
 * @param {import('@tiptap/pm/state').Selection} selection - The selection before the transaction.
 */
function keepSelectionOutOfBody(tr, pos, details, selection) {
    const summaryEnd = summaryEndOf(pos, details);
    const bodyEnd = pos + details.nodeSize - 1;
    const inBody = at => at > summaryEnd && at < pos + details.nodeSize;
    const after = pos + details.nodeSize;
    const { anchor, head, from, to } = selection;
    if (inBody(anchor) || inBody(head)) {
        // The first text after the disclosure (looked for forwards, never back into its body).
        const keep = (at, other) => {
            if (!inBody(at)) return at;
            if (other < after) return summaryEnd;
            return Selection.findFrom(tr.doc.resolve(after), 1, true)?.from ?? summaryEnd;
        };
        tr.setSelection(TextSelection.between(tr.doc.resolve(keep(anchor, head)), tr.doc.resolve(keep(head, anchor))));
    } else if (from <= summaryEnd && to >= bodyEnd && !(from <= pos && to >= after)) {
        // A selection covering the whole body from its summary: the cursor goes to the end of the
        // summary. (One holding the whole disclosure stays: it does not show the body.)
        tr.setSelection(TextSelection.create(tr.doc, summaryEnd));
    }
}

/** Where a disclosure's summary text ends, and its body begins (the disclosure at `pos`). */
const summaryEndOf = (pos, details) => pos + details.firstChild.nodeSize;
const bodyStartOf = (pos, details) => summaryEndOf(pos, details) + 1;

/**
 * The disclosures a change split in two: ProseMirror fits a block put in a summary or beside it
 * (inserted, pasted, dropped, made by an input rule), where the disclosure cannot hold one, by
 * closing the disclosure there and opening it again after it. For each step in a summary or between
 * a disclosure's own children, the disclosure is followed through the rest of the change; it was
 * split when it is now two disclosures side by side where it was one (nothing else makes that: a
 * disclosure cannot be split, its second half having no summary).
 * @returns {number[]} Where each split disclosure's first half starts in the new document, last first.
 */
function splitDisclosures(transactions, doc) {
    const found = new Set();
    transactions.forEach((transaction, index) => {
        transaction.steps.forEach((step, stepIndex) => {
            // Only a step that puts something in can split (a deletion cannot).
            if (typeof step.from !== 'number' || !(step.slice?.size > 0)) return;
            const before = transaction.docs[stepIndex];
            for (const at of new Set([step.from, step.to])) {
                if (at > before.content.size) continue;
                const $at = before.resolve(at);
                const depth = $at.parent.type.name === SUMMARY ? $at.depth - 1 : $at.parent.type.name === DETAILS ? $at.depth : -1;
                if (depth < 1) continue;
                const start = $at.before(depth);
                const end = start + $at.node(depth).nodeSize;
                const from = followThrough(transactions, index, stepIndex, start, 1);
                const to = followThrough(transactions, index, stepIndex, end, -1);
                if (from === null || to === null) continue;
                const first = doc.nodeAt(from);
                if (first?.type.name !== DETAILS) continue;
                const middle = from + first.nodeSize;
                if (middle === to || middle >= doc.content.size) continue;
                const second = doc.nodeAt(middle);
                if (second?.type.name === DETAILS && second.firstChild?.type.name === SUMMARY && middle + second.nodeSize === to) found.add(from);
            }
        });
    });
    return [...found].sort((a, b) => b - a);
}

/**
 * A position before a transaction's step, where it is once the change is done (null if it was
 * deleted). Mapped one mapping at a time: appendMapping would take a sliced mapping whole.
 */
function followThrough(transactions, index, stepIndex, pos, assoc) {
    const mappings = [transactions[index].mapping.slice(stepIndex), ...transactions.slice(index + 1).map(later => later.mapping)];
    return mappings.reduce((result, mapping) => {
        if (result === null) return null;
        const mapped = mapping.mapResult(result, assoc);
        return mapped.deleted ? null : mapped.pos;
    }, pos);
}

/** The closed disclosures whose body holds a position, by where they start. */
function closedAround($pos) {
    const found = [];
    for (let depth = $pos.depth; depth > 0; depth--) {
        const node = $pos.node(depth);
        if (node.type.name === DETAILS && !node.attrs.open && $pos.index(depth) > 0) found.push($pos.before(depth));
    }
    return found;
}

/**
 * The closed disclosures a change put something in from outside, beside the cursor: it took the
 * cursor into the body from its summary (a block put there goes to the body) or from the start of
 * the block right after it (a line Backspace joins in), or, with the cursor in the body, it removed
 * the body's end (Delete at the end of its last line pulled the next block in). What was put there
 * would otherwise be hidden once the cursor leaves. Only these: an edit within a body the cursor is
 * in is in sight, and a change elsewhere (new content loaded, say) is not the reader's doing.
 */
function closedBodiesEntered(transactions, oldState, newState) {
    const $head = oldState.selection.$head;
    const beside = [];
    if ($head.parent.type.name === SUMMARY) beside.push($head.before($head.depth - 1));
    if ($head.parentOffset === 0) {
        // The disclosure Backspace would join into: the block before the first ancestor that has one.
        for (let depth = $head.depth; depth > 0; depth--) {
            const index = $head.index(depth - 1);
            if (index === 0) continue;
            const before = $head.node(depth - 1).child(index - 1);
            if (before.type.name === DETAILS) beside.push($head.before(depth) - before.nodeSize);
            break;
        }
    }
    const candidates = new Set();
    for (const pos of beside) {
        if (oldState.doc.nodeAt(pos)?.attrs.open) continue;
        const mapped = followThrough(transactions, 0, 0, pos, 1);
        if (mapped !== null) candidates.add(mapped);
    }
    const entered = closedAround(newState.selection.$head).filter(pos => candidates.has(pos));
    // A closed body the selection was in, whose end the change removed: what followed the
    // disclosure is in it now (Delete at the end of its last line pulled the next block in).
    const { $anchor } = oldState.selection;
    for (const pos of new Set([...closedAround($head), ...closedAround($anchor)])) {
        const start = followThrough(transactions, 0, 0, pos, 1);
        const end = followThrough(transactions, 0, 0, pos + oldState.doc.nodeAt(pos).nodeSize, -1);
        const now = start === null ? null : newState.doc.nodeAt(start);
        if (end === null && now?.type.name === DETAILS && !now.attrs.open) entered.push(start);
    }
    return [...new Set(entered)];
}

/**
 * A range from a summary into its own body, as the summary's part and the body's part: ProseMirror
 * deleting it whole joins what is left of the body there onto the summary (a line, or what a quote
 * or a list held), where the summary is one line. Null for any other range.
 * @param {import('@tiptap/pm/model').Node} doc
 * @param {number} from
 * @param {number} to
 */
function rangeFromSummaryIntoBody(doc, from, to) {
    if (from >= to || to > doc.content.size) return null;
    const $from = doc.resolve(from);
    if ($from.parent.type.name !== SUMMARY) return null;
    const detailsPos = $from.before($from.depth - 1);
    const details = $from.node($from.depth - 1);
    const bodyStart = bodyStartOf(detailsPos, details);
    if (to <= bodyStart || to >= detailsPos + details.nodeSize - 1) return null;
    return { detailsPos, details, from, to, bodyStart, summaryEnd: $from.end() };
}

/**
 * Delete such a range as its two parts, the body's first (later in the document) so that neither
 * moves the other: the summary keeps what is before the range, the body what is after it.
 */
function deleteApart(tr, range) {
    tr.delete(range.bodyStart, range.to);
    tr.delete(range.from, range.summaryEnd);
}

/**
 * Delete a range as Backspace would: one from a summary into its own body as its two parts (the
 * summary keeps what is before it, the body what is after it), any other as it is. For a change
 * of its own that replaces a range (an image put in place of a selection).
 * @param {import('@tiptap/pm/state').Transaction} tr
 * @param {number} from
 * @param {number} to
 */
export function deleteKeepingDisclosures(tr, from, to) {
    const apart = rangeFromSummaryIntoBody(tr.doc, from, to);
    if (apart) deleteApart(tr, apart);
    else tr.delete(from, to);
}

/**
 * A change that only deleted a range from a summary into its own body (Backspace, cut, a command),
 * redone apart (see rangeFromSummaryIntoBody): the disclosure as it should be, to put in its place,
 * whatever the step ProseMirror made. Only a change of that one step (nothing else to carry over).
 * @returns {{ start: number, end: number, details: import('@tiptap/pm/model').Node, cursor: number } | null}
 */
function deletionRedoneApart(transactions, oldState, newState) {
    if (transactions.length !== 1 || transactions[0].steps.length !== 1) return null;
    const step = transactions[0].steps[0];
    if (typeof step.from !== 'number') return null;
    // A plain step's own range; one that lifts what is left (a replace around) reaches past the range
    // deleted, as far as the end of what it lifts: the selection it started from is that range.
    const { selection } = oldState;
    const widened = step instanceof ReplaceAroundStep && step.from === selection.from && step.to >= selection.to;
    const range = widened ? rangeFromSummaryIntoBody(oldState.doc, selection.from, selection.to) : rangeFromSummaryIntoBody(oldState.doc, step.from, step.to);
    if (!range) return null;
    // Nothing put in (only the structure ProseMirror closes and opens: no text, no leaf such as a rule).
    let put = false;
    step.slice?.content.descendants(node => { if (node.isLeaf) put = true; return !put; });
    if (put) return null;
    // The disclosure starts where it did (the change began inside it); what it is now is replaced.
    const now = newState.doc.nodeAt(range.detailsPos);
    if (now?.type.name !== DETAILS) return null;
    const end = range.detailsPos + now.nodeSize;
    const apart = oldState.tr;
    deleteApart(apart, range);
    const details = apart.doc.nodeAt(range.detailsPos);
    return details ? { start: range.detailsPos, end, details, cursor: range.from } : null;
}

/**
 * Where a change merged a body line into its summary: a range from a summary into its own body
 * deleted (or typed over, pasted over) joins what is left of that body line onto the summary, as
 * ProseMirror joins any two lines. Each is where that rest begins, now in the summary, with the
 * line it came from: split off again, it stays a line of the body.
 * @returns {{ pos: number, type: import('@tiptap/pm/model').NodeType, attrs: object }[]} Last first.
 */
function linesMergedIntoSummary(transactions, doc) {
    const found = [];
    transactions.forEach((transaction, index) => {
        transaction.steps.forEach((step, stepIndex) => {
            if (typeof step.from !== 'number' || step.from === step.to) return;
            const before = transaction.docs[stepIndex];
            if (step.to > before.content.size) return;
            const $from = before.resolve(step.from);
            if ($from.parent.type.name !== SUMMARY) return;
            const detailsPos = $from.before($from.depth - 1);
            const details = $from.node($from.depth - 1);
            const $to = before.resolve(step.to);
            // Into this disclosure's body, short of the end of a line there (some of it left).
            if (step.to < bodyStartOf(detailsPos, details) || step.to >= detailsPos + details.nodeSize - 1) return;
            if (!$to.parent.isTextblock || $to.parentOffset >= $to.parent.content.size) return;
            const pos = followThrough(transactions, index, stepIndex, step.to, 1);
            if (pos === null || doc.resolve(pos).parent.type.name !== SUMMARY) return;
            found.push({ pos, type: $to.parent.type, attrs: $to.parent.attrs });
        });
    });
    return found.sort((a, b) => b.pos - a.pos);
}

/**
 * Join a split disclosure back into one, the second half's summary text back at the end of the first
 * half's summary and what was put in between them at the start of the body, the disclosure open so
 * it shows. Done in steps that keep the selection where it was.
 */
function joinSplitDisclosure(tr, pos) {
    const first = tr.doc.nodeAt(pos);
    const second = tr.doc.nodeAt(pos + first.nodeSize);
    const secondStart = pos + first.nodeSize;
    const text = second.firstChild.content;
    if (text.size) tr.delete(secondStart + 2, secondStart + 2 + text.size);
    tr.insert(summaryEndOf(pos, first), text);
    // From the end of the first half's body to the start of the second's: `</details><details><summary></summary>`.
    const firstContentEnd = pos + first.nodeSize - 1 + text.size;
    tr.delete(firstContentEnd, firstContentEnd + 4);
    tr.setNodeMarkup(pos, undefined, { ...first.attrs, open: true });
}

/**
 * Whether toggleDetails, in a disclosure, folds blocks of its body into a disclosure of their own
 * (nested) rather than unwrapping it: blocks of the body selected (a selection across them, or a
 * selected block), all of the selection in the body, where a disclosure can go. Text within one line
 * is no blocks.
 * @param {import('@tiptap/pm/state').EditorState} state
 * @returns {boolean}
 */
export function toggleNests(state) {
    const { selection } = state;
    const found = detailsAround(selection);
    if (!found) return false;
    const coversBlocks = selection.node ? selection.node.isBlock : !selection.$from.sameParent(selection.$to);
    return coversBlocks && selection.node !== found.node && selection.from >= bodyStartOf(found.pos, found.node)
        && selection.to <= found.pos + found.node.nodeSize - 1 && !!detailsWrapRange(state, true);
}

/** Whether the toolbar's Disclosure button is pressed: in a disclosure, a click unwrapping it. */
export const detailsActive = state => !!detailsAround(state.selection) && !toggleNests(state);

/**
 * The blocks setDetails wraps: the selected ones, or with `climb`, at the first level up that can
 * hold a disclosure (a list holds only its items, so a selection in one wraps the list).
 * @param {import('@tiptap/pm/state').EditorState} state
 * @param {boolean} climb
 * @returns {{ range: NodeRange, body: import('@tiptap/pm/model').Node[] } | null}
 */
export function detailsWrapRange(state, climb) {
    const { schema, selection } = state;
    const type = schema.nodes[DETAILS];
    // Cells selected: their contents are apart, one disclosure cannot hold them. A summary is one
    // line, no blocks to wrap (climbing out of it would wrap its whole disclosure).
    if (!type || '$anchorCell' in selection) return null;
    if (selection.$from.parent.type.name === SUMMARY || selection.$to.parent.type.name === SUMMARY) return null;
    let range = selection.$from.blockRange(selection.$to);
    while (range && !range.parent.canReplaceWith(range.startIndex, range.endIndex, type)) {
        range = climb && range.depth > 0 ? new NodeRange(selection.$from, selection.$to, range.depth - 1) : null;
    }
    if (!range) return null;
    const body = [];
    for (let index = range.startIndex; index < range.endIndex; index++) body.push(range.parent.child(index));
    return type.validContent(Fragment.from([schema.nodes[SUMMARY].create(), ...body])) ? { range, body } : null;
}

/**
 * A disclosure's summary: the line that stays visible, `<summary>`. Only inside a disclosure, and
 * always its first child.
 */
export const DetailsSummary = Node.create({
    name: SUMMARY,
    content: 'inline*',
    defining: true,
    selectable: false,

    parseHTML() {
        // Only a disclosure's own summary, its first child: a <summary> anywhere else (a second one,
        // one in a wrapper in the body, one outside any disclosure) is text, as a browser shows it.
        return [{
            tag: 'summary',
            context: `${DETAILS}/`,
            getAttrs: element => (isOwnSummary(element) ? null : false),
            contentElement: summaryAsLine,
        }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['summary', mergeAttributes(HTMLAttributes), 0];
    },

    // Drawn in the editor as a plain block, saved as <summary>: a browser treats a <summary> as a
    // control even outside <details> (End, Home and Space misbehave in it while editing).
    addNodeView() {
        return () => {
            const dom = document.createElement('div');
            dom.className = 'inscript-details-summary';
            return { dom, contentDOM: dom };
        };
    },
});

/**
 * A disclosure, `<details><summary>…</summary>…</details>`: a summary that stays visible, then any
 * blocks a reader shows or hides. `open` is the document's own state (`<details open>`), set by the
 * toggle beside the summary in an editable editor, as a task's checkbox is. A read-only editor opens
 * and closes it for the reader only. A closed disclosure still shows its body while the cursor is in
 * it (moved there by the arrow keys, say), so nothing is ever edited unseen.
 */
export const Details = Node.create({
    name: DETAILS,
    group: 'block',
    content: `${SUMMARY} block+`,
    defining: true,

    addAttributes() {
        return {
            open: {
                default: false,
                parseHTML: element => element.hasAttribute('open'),
                renderHTML: attributes => (attributes.open ? { open: '' } : {}),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'details', contentElement: summaryFirst }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['details', mergeAttributes(HTMLAttributes), 0];
    },

    addStorage() {
        // The node views' redraws, and what stops following editability.
        return { views: new Set(), stopFollowing: null };
    },

    // Read-only turned on or off, however it is done (setEditable with or without an update event):
    // every disclosure is redrawn.
    onBeforeCreate() {
        const { storage } = this;
        storage.stopFollowing = followEditable(this.editor, () => { for (const show of storage.views) show(); });
    },

    onDestroy() {
        this.storage.stopFollowing?.();
    },

    addNodeView() {
        const { editor } = this;
        const { views } = this.storage;
        return ({ node, getPos, decorations }) => {
            let current = node;
            const hasReveal = decos => (decos ?? []).some(deco => deco.spec?.reveal === true);
            const hasCursorIn = decos => (decos ?? []).some(deco => deco.spec?.reveal === true && deco.spec.cursor);
            let revealed = hasReveal(decorations);
            let cursorIn = hasCursorIn(decorations);
            // A read-only reader's own open or closed, never written to the document.
            let readerOpen = null;
            const isOpen = () => (!editor.isEditable && readerOpen !== null ? readerOpen : !!current.attrs.open);
            // What the view shows now (it may still show a reader's own state from read-only).
            const isShown = () => dom.hasAttribute('data-open');

            const dom = document.createElement('div');
            dom.className = 'inscript-details';
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'inscript-details-toggle';
            toggle.setAttribute('contenteditable', 'false');
            const content = document.createElement('div');
            content.className = 'inscript-details-content';
            dom.append(toggle, content);

            // What the toggle last said (written again only when it changes, or the language does).
            let drawn = null;
            const show = () => {
                if (editor.isEditable) readerOpen = null;
                // Shown is open, or a closed body the selection is in (the reveal decoration).
                const open = isOpen() || (editor.isEditable && revealed);
                const label = open ? editorT('detailsHide', 'Hide content', {}, editor) : editorT('detailsShow', 'Show content', {}, editor);
                if (drawn?.open === open && drawn.label === label) return;
                drawn = { open, label };
                toggle.setAttribute('aria-expanded', String(open));
                toggle.setAttribute('aria-label', label);
                toggle.title = label;
                if (open) dom.setAttribute('data-open', '');
                else dom.removeAttribute('data-open');
            };

            // The toggle keeps the editor's selection where it is.
            toggle.addEventListener('mousedown', event => event.preventDefault());
            toggle.addEventListener('click', event => {
                event.preventDefault();
                if (!editor.isEditable) {
                    readerOpen = !isOpen();
                    show();
                    return;
                }
                const pos = typeof getPos === 'function' ? getPos() : null;
                if (typeof pos !== 'number') return;
                // The toggle does the opposite of what the reader sees: open (a reader's own state left
                // from read-only counts), or a closed body shown while the selection is in it.
                const closing = isShown();
                readerOpen = null;
                const tr = editor.state.tr;
                if (closing !== !!current.attrs.open) {
                    // Already so in the document: a shown closed body hides (the selection leaves
                    // it), and a reader's own state from read-only is dropped.
                    if (closing) keepSelectionOutOfBody(tr, pos, current, editor.state.selection);
                    if (tr.selectionSet) editor.view.dispatch(tr);
                    show();
                    return;
                }
                tr.setNodeMarkup(pos, undefined, { ...current.attrs, open: !closing });
                if (closing) keepSelectionOutOfBody(tr, pos, current, editor.state.selection);
                editor.view.dispatch(tr);
            });

            const stopLanguage = onEditorLanguageChanged(editor, show);
            // Turning read-only on or off changes who decides (the document, or the reader): the
            // extension's plugin view tells every view (see addProseMirrorPlugins).
            views.add(show);
            show();

            return {
                dom,
                contentDOM: content,
                update(next, nextDecorations) {
                    if (next.type !== current.type) return false;
                    // A different disclosure drawn here (new content loaded): a reader's own open or
                    // closed was for the one before.
                    const same = next.eq(current);
                    if (!same) readerOpen = null;
                    current = next;
                    const wasCursorIn = cursorIn;
                    revealed = hasReveal(nextDecorations);
                    cursorIn = hasCursorIn(nextDecorations);
                    // Read-only, the selection taken into a closed body (the outline going to a
                    // heading in it) opens it for the reader, who can close it again. Only a move
                    // of the selection's end into it: not a range passing over it, nor where new
                    // content left it.
                    if (!editor.isEditable && same && cursorIn && !wasCursorIn) readerOpen = true;
                    show();
                    return true;
                },
                stopEvent: event => toggle.contains(event.target),
                ignoreMutation: mutation => mutation.type !== 'selection' && !content.contains(mutation.target),
                destroy() {
                    stopLanguage();
                    views.delete(show);
                },
            };
        };
    },

    addCommands() {
        return {
            /**
             * Wrap the selected blocks in a disclosure, its summary selected for typing: at the first
             * level up that can hold one (a selection in a list wraps the list, as a list holds only
             * its items).
             */
            setDetails: () => ({ state, tr, dispatch }) => {
                const { schema } = state;
                const type = schema.nodes[DETAILS];
                const found = detailsWrapRange(state, true);
                if (!found) return false;
                const { range, body } = found;
                const emptySummary = schema.nodes[SUMMARY].create();
                if (dispatch) {
                    // The summary's text only when it is made (a dry run, say for the toolbar, needs none).
                    // A host may translate the default summary to nothing: an empty summary then.
                    const text = editorT('detailsSummaryDefault', DEFAULT_SUMMARY, {}, this.editor);
                    const summary = text ? schema.nodes[SUMMARY].create(null, schema.text(text)) : emptySummary;
                    tr.replaceWith(range.start, range.end, type.create({ open: true }, Fragment.from([summary, ...body])));
                    const summaryStart = range.start + 2;
                    tr.setSelection(TextSelection.create(tr.doc, summaryStart, summaryStart + text.length));
                }
                return true;
            },
            /** Unwrap the disclosure around the selection: its summary becomes a paragraph, its body stays. */
            unsetDetails: () => ({ state, tr, dispatch }) => {
                const found = detailsAround(state.selection);
                if (!found) return false;
                const { node: details, pos } = found;
                const summary = details.firstChild;
                const $at = state.doc.resolve(pos);
                const blocks = [];
                if (summary.content.size > 0) blocks.push(state.schema.nodes.paragraph.create(null, summary.content));
                details.forEach((child, offset, index) => { if (index > 0) blocks.push(child); });
                const parent = $at.parent;
                const index = $at.index();
                if (!parent.canReplace(index, index + 1, Fragment.from(blocks))) return false;
                if (dispatch) {
                    // The selection stays on what it was on: inside, everything moves back by the
                    // disclosure's opening token, and by an empty summary, which goes; after it, by
                    // what the disclosure lost in size.
                    const end = pos + details.nodeSize;
                    const bodyStart = bodyStartOf(pos, details);
                    const emptySummary = summary.content.size === 0;
                    const newSize = blocks.reduce((size, block) => size + block.nodeSize, 0);
                    const keep = at => {
                        if (at <= pos) return at;
                        if (at >= end) return at - details.nodeSize + newSize;
                        if (emptySummary && at < bodyStart) return pos + 1;
                        return at - 1 - (emptySummary ? summary.nodeSize : 0);
                    };
                    const { anchor, head } = state.selection;
                    tr.replaceWith(pos, end, blocks);
                    const clamp = at => Math.min(Math.max(at, 0), tr.doc.content.size);
                    tr.setSelection(TextSelection.between(tr.doc.resolve(clamp(keep(anchor))), tr.doc.resolve(clamp(keep(head)))));
                }
                return true;
            },
            /** Unwrap the disclosure around the selection, or wrap the selected blocks in one. */
            // In a disclosure it unwraps it, unless blocks of its body are selected (a selection
            // across blocks, or a block such as an image selected), which it folds into a disclosure
            // of their own, nested, where one can go there. Text within one line is no blocks.
            toggleDetails: () => ({ state, commands }) => {
                if (!detailsAround(state.selection)) return commands.setDetails();
                return (toggleNests(state) && commands.setDetails()) || commands.unsetDetails();
            },
            /** Open or close the disclosure around the selection (`<details open>`). */
            setDetailsOpen: open => ({ state, tr, dispatch }) => {
                const found = detailsAround(state.selection);
                if (!found) return false;
                const { node: details, pos } = found;
                if (dispatch) {
                    if (details.attrs.open !== !!open) tr.setNodeMarkup(pos, undefined, { ...details.attrs, open: !!open });
                    // Closed with the selection in its body (closed already, shown only for the
                    // selection, too): the selection leaves it, so it hides.
                    if (!open) keepSelectionOutOfBody(tr, pos, details, state.selection);
                }
                return true;
            },
        };
    },

    addKeyboardShortcuts() {
        const inSummary = state => state.selection.empty && state.selection.$from.parent.type.name === SUMMARY;
        // Enter with a range from the summary into its own body: the range goes, the summary and the
        // body each keeping what is left of them, and the cursor starts the body.
        const fromSummaryIntoBody = editor => {
            const { state } = editor;
            const range = rangeFromSummaryIntoBody(state.doc, state.selection.from, state.selection.to);
            if (!range) return false;
            const tr = state.tr;
            if (!range.details.attrs.open) tr.setNodeAttribute(range.detailsPos, 'open', true);
            deleteApart(tr, range);
            tr.setSelection(Selection.findFrom(tr.doc.resolve(range.from + 1), 1, true) ?? TextSelection.create(tr.doc, range.from));
            editor.view.dispatch(tr.scrollIntoView());
            return true;
        };
        // A selection within one summary (a range in it, or just the cursor).
        const withinSummary = state => {
            const { $from, $to } = state.selection;
            return $from.parent.type.name === SUMMARY && $from.sameParent($to);
        };
        // Backspace at the very start of the summary unwraps the disclosure. At the start of the body
        // it never pulls the body's first block into the one-line summary: an empty first block goes
        // (unless it is the only one), and otherwise the cursor moves up to the summary. Right after
        // a closed disclosure, an empty line just goes (the disclosure selected); a line joined into
        // a closed body opens it (see the plugin), so it stays in sight.
        const backspace = ({ editor }) => {
            const { state } = editor;
            const { $from, empty } = state.selection;
            if (inSummary(state)) return $from.parentOffset === 0 ? editor.commands.unsetDetails() : false;
            if (!empty || $from.parentOffset !== 0 || !$from.parent.isTextblock) return false;
            // An empty code block is the code block's own to turn into a line first.
            if ($from.parent.content.size === 0 && $from.parent.type.spec.code) return false;
            const index = $from.index($from.depth - 1);
            const before = index > 0 ? $from.node($from.depth - 1).child(index - 1) : null;
            if (before?.type.name === DETAILS && !before.attrs.open) {
                const detailsPos = $from.before() - before.nodeSize;
                if ($from.parent.content.size === 0) {
                    const tr = state.tr.delete($from.before(), $from.after());
                    tr.setSelection(NodeSelection.create(tr.doc, detailsPos));
                    editor.view.dispatch(tr);
                    return true;
                }
            }
            const depth = $from.depth - 1;
            if (depth < 1 || $from.node(depth).type.name !== DETAILS || $from.index(depth) !== 1) return false;
            const details = $from.node(depth);
            const summaryEnd = summaryEndOf($from.before(depth), details);
            const tr = state.tr;
            if ($from.parent.content.size === 0 && details.childCount > 2) tr.delete($from.before(), $from.after());
            tr.setSelection(TextSelection.create(tr.doc, summaryEnd));
            editor.view.dispatch(tr.scrollIntoView());
            return true;
        };
        // Delete at the end of the summary never pulls the body's first block into it: an empty first
        // block of an open body goes (unless it is the only one, the body needing one), and otherwise
        // nothing happens.
        const del = ({ editor }) => {
            const { state } = editor;
            const { $from } = state.selection;
            if (!inSummary(state) || $from.parentOffset !== $from.parent.content.size) return false;
            const details = $from.node($from.depth - 1);
            const first = details.child(1);
            // Only in sight: a closed body is not edited from its summary.
            if (details.attrs.open && first.isTextblock && first.content.size === 0 && details.childCount > 2) {
                const at = $from.after();
                editor.view.dispatch(state.tr.delete(at, at + first.nodeSize));
            }
            return true;
        };
        return {
            // Enter in the summary goes on into the body (opening it): what follows the cursor starts
            // the body's first paragraph. Selected text is replaced; a selected key is kept, the line
            // breaking before it (as Enter does anywhere). One replace step (and the open, a step
            // that moves nothing), so the editor's keyboardShortcut command replays it whole.
            Enter: ({ editor }) => {
                const { state } = editor;
                if (!withinSummary(state)) return fromSummaryIntoBody(editor);
                const { selection, schema } = state;
                const from = selection.from;
                const to = selection instanceof NodeSelection ? selection.from : selection.to;
                const $from = state.doc.resolve(from);
                const depth = $from.depth - 1;
                const details = $from.node(depth);
                const rest = $from.parent.content.cut(state.doc.resolve(to).parentOffset);
                const bodyStart = $from.after();
                // An empty first paragraph in the body takes what follows (none is added beside it).
                const first = details.child(1);
                const reuse = first.type.name === 'paragraph' && first.content.size === 0;
                const tr = state.tr;
                if (!details.attrs.open) tr.setNodeAttribute($from.before(depth), 'open', true);
                // From the cursor to the start of the body (into the empty paragraph it reuses): the
                // summary closes at the cursor, and a paragraph holding the rest follows.
                const slice = new Slice(Fragment.from([schema.nodes[SUMMARY].create(), schema.nodes.paragraph.create(null, rest)]), 1, reuse ? 1 : 0);
                tr.replace(from, reuse ? bodyStart + 1 : bodyStart, slice);
                tr.setSelection(TextSelection.create(tr.doc, from + 2));
                editor.view.dispatch(tr.scrollIntoView());
                return true;
            },
            // Every key that deletes backward or forward, as the editor's own keymap binds them (some
            // only on a Mac, where they are its deleting keys; elsewhere they are the browser's).
            Backspace: backspace,
            'Shift-Backspace': backspace,
            'Mod-Backspace': backspace,
            Delete: del,
            'Mod-Delete': del,
            ...(isMacOS() || isiOS() ? {
                'Ctrl-h': backspace,
                'Alt-Backspace': backspace,
                'Ctrl-d': del,
                'Ctrl-Alt-Backspace': del,
                'Alt-Delete': del,
                'Alt-d': del,
            } : {}),
        };
    },

    addProseMirrorPlugins() {
        const { editor } = this;
        return [
            new Plugin({
                key: revealKey,
                // A block put in a summary (inserted, pasted, dropped, by any command) goes to the
                // start of the body: a disclosure ProseMirror split in two to fit it is joined again.
                // A range from the summary into the body, deleted, leaves the summary one line: what
                // is left of the body line stays in the body.
                // A change that takes the cursor into a closed body from outside it (that block, a
                // line Backspace joined in) opens the disclosure, so what it put there stays in sight.
                // Undo and redo put back what was, as it was.
                appendTransaction: (transactions, oldState, newState) => {
                    if (!transactions.some(transaction => transaction.docChanged) || transactions.some(isHistoryTransaction)) return null;
                    // A deletion from a summary into its body, redone apart (the disclosure put back
                    // as it should be).
                    const redone = deletionRedoneApart(transactions, oldState, newState);
                    if (redone) {
                        const tr = newState.tr.replaceWith(redone.start, redone.end, redone.details);
                        return tr.setSelection(TextSelection.create(tr.doc, redone.cursor));
                    }
                    const split = splitDisclosures(transactions, newState.doc);
                    const merged = linesMergedIntoSummary(transactions, newState.doc);
                    const closed = closedBodiesEntered(transactions, oldState, newState);
                    if (!split.length && !merged.length && !closed.length) return null;
                    const tr = newState.tr;
                    for (const pos of split) joinSplitDisclosure(tr, pos);
                    // A body line merged into its summary is split off again (as a paragraph where
                    // its own kind cannot hold what it has).
                    for (const { pos, type, attrs } of merged) {
                        const at = tr.mapping.map(pos, 1);
                        const types = [{ type, attrs }];
                        if (canSplit(tr.doc, at, 1, types)) tr.split(at, 1, types);
                        else if (canSplit(tr.doc, at, 1)) tr.split(at, 1, [{ type: tr.doc.type.schema.nodes.paragraph }]);
                    }
                    for (const pos of closed) {
                        const at = tr.mapping.map(pos, 1);
                        const details = tr.doc.nodeAt(at);
                        if (details?.type.name === DETAILS && !details.attrs.open) tr.setNodeMarkup(at, undefined, { ...details.attrs, open: true });
                    }
                    return tr;
                },
                // A closed disclosure shows its body while the cursor is in it (data-reveal), so
                // nothing is edited unseen; a read-only reader opens and closes it themselves.
                // Worked out again only when the document or the selection changes.
                state: {
                    init: (_config, state) => revealedBodies(state),
                    apply: (tr, value, _oldState, newState) => (tr.docChanged || tr.selectionSet ? revealedBodies(newState) : value),
                },
                props: {
                    // Typing or pasting over a range from a summary into its body: the range goes
                    // apart (see rangeFromSummaryIntoBody), then what was typed or pasted goes where
                    // it began.
                    handleTextInput: (view, from, to, text) => {
                        const range = rangeFromSummaryIntoBody(view.state.doc, from, to);
                        if (!range) return false;
                        const tr = view.state.tr;
                        deleteApart(tr, range);
                        view.dispatch(tr.insertText(text, range.from).scrollIntoView());
                        return true;
                    },
                    handlePaste: (view, _event, slice) => {
                        const { from, to } = view.state.selection;
                        const range = rangeFromSummaryIntoBody(view.state.doc, from, to);
                        if (!range) return false;
                        const tr = view.state.tr;
                        deleteApart(tr, range);
                        tr.setSelection(TextSelection.create(tr.doc, range.from)).replaceSelection(slice);
                        view.dispatch(tr.scrollIntoView().setMeta('paste', true).setMeta('uiEvent', 'paste'));
                        return true;
                    },
                    // Read-only too: there it opens the disclosure for the reader (see the node view).
                    decorations: state => revealKey.getState(state),
                },
            }),
        ];
    },
});

/** The closed disclosures the selection reaches into, drawn shown (the reveal decoration). */
function revealedBodies(state) {
    const found = new Map();
    // A selection covering part of a closed body shows it (nothing is edited unseen). One holding
    // the whole disclosure (selected, or passed over by a drag) sees it as a whole: it stays as it
    // is, and nothing moves under the pointer.
    const { from, to, empty } = state.selection;
    if (!empty) {
        state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.isTextblock || node.isLeaf) return false;
            if (node.type.name !== DETAILS) return true;
            if (from <= pos && to >= pos + node.nodeSize) return false;
            if (!node.attrs.open && to > bodyStartOf(pos, node) && from < pos + node.nodeSize - 1) found.set(pos, reveal(pos, node));
            return true;
        });
    }
    // Either end of the selection in a closed body shows it.
    for (const $pos of [state.selection.$anchor, state.selection.$head]) {
        for (const pos of closedAround($pos)) found.set(pos, reveal(pos, state.doc.nodeAt(pos), true));
    }
    return found.size ? DecorationSet.create(state.doc, [...found.values()]) : null;
}
