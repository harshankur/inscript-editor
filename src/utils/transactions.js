/** Does this transaction replace the whole document in one step (setContent, a load)? */
export function replacesWholeDocument(tr) {
    const size = tr.before.content.size;
    return tr.steps.some(step => step.from === 0 && step.to === size && step.slice !== undefined);
}

/**
 * A check of a transaction, worked out once per transaction (several plugins ask the same of it).
 * @template T
 * @param {(tr: import('@tiptap/pm/state').Transaction) => T} check
 * @returns {(tr: import('@tiptap/pm/state').Transaction) => T}
 */
export function perTransaction(check) {
    const answers = new WeakMap();
    return tr => {
        if (!answers.has(tr)) answers.set(tr, check(tr));
        return answers.get(tr);
    };
}

const rangeOfOne = perTransaction(tr => changedRangeOf([tr]));

/**
 * Where transactions put content or changed a node's attributes, in the last one's document: from the
 * first such place to the end of the last (null: nowhere). Read from their steps, never from a
 * difference of the documents, which cannot tell where content went when it repeats its neighbour.
 */
export function changedRange(transactions) {
    // One transaction's range is asked for by several plugins: worked out once.
    return transactions.length === 1 ? rangeOfOne(transactions[0]) : changedRangeOf(transactions);
}

function changedRangeOf(transactions) {
    // One span covering them all, mapped on through each later step (a merge may take thousands).
    let span = null;
    const cover = (from, to) => {
        span = span ? { from: Math.min(span.from, from), to: Math.max(span.to, to) } : { from, to };
    };
    for (const tr of transactions) {
        tr.steps.forEach((step, index) => {
            const map = tr.mapping.maps[index];
            if (span) span = { from: map.map(span.from, -1), to: map.map(span.to, 1) };
            map.forEach((_oldStart, _oldEnd, from, to) => cover(from, to));
            // An attribute or mark step moves nothing: what it changed (a node, or a run of inline content).
            if (typeof step.attr === 'string' && Number.isInteger(step.pos)) cover(step.pos, step.pos + 1);
            else if (step.mark && Number.isInteger(step.from) && Number.isInteger(step.to)) cover(step.from, step.to);
            else if (step.mark && Number.isInteger(step.pos)) cover(step.pos, step.pos + 1);
        });
    }
    return span;
}

/**
 * Whether a transaction changed the document where it holds (or held) a node `test` takes: in what
 * the change put in (its range in the new document) or what it took out or changed (that range in the
 * document before it). A block turned into another kind (a code block into a paragraph) is both.
 * @param {import('@tiptap/pm/state').Transaction} tr
 * @param {(node: import('@tiptap/pm/model').Node) => boolean} test
 * @param {{ inline?: boolean, whole?: boolean }} [options] - `inline`: the nodes are inline (looked for in
 *   text blocks too). `whole`: only a node the change put in, took out or changed itself (its attributes)
 *   counts: one starting in the changed range, not one it only edited inside (text typed in it).
 */
export function touchesNodes(tr, test, { inline = false, whole = false } = {}) {
    if (!tr.docChanged) return false;
    const range = changedRange([tr]);
    if (!range) return false;
    const inverted = tr.mapping.invert();
    const holds = (doc, from, to) => {
        const start = Math.max(0, Math.min(from, to));
        const end = Math.min(Math.max(from, to), doc.content.size);
        let found = false;
        doc.nodesBetween(start, end, (node, pos) => {
            if (found) return false;
            if (test(node) && (!whole || (pos >= start && pos < Math.max(end, start + 1)))) found = true;
            return !found && (inline || !node.isTextblock);
        });
        return found;
    };
    return holds(tr.doc, range.from, range.to) || holds(tr.before, inverted.map(range.from, -1), inverted.map(range.to, 1));
}
