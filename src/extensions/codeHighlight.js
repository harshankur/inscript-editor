import { findChildren } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { codeLanguage } from '../utils/codeLanguage.js';
import { changedRange, replacesWholeDocument, touchesNodes } from '../utils/transactions.js';

/**
 * Code blocks highlighted with a (bounded) lowlight, as TipTap's own lowlight plugin does, and also
 * again after a pass the lowlight left unfinished (its time budget spent, see boundedLowlight): once
 * the page is free, until every block is done. TipTap's plugin only highlights again when a change
 * touches a code block, so blocks a pass left plain stayed plain.
 */
const CODE_HIGHLIGHT = 'inscriptCodeHighlight';

function parseNodes(nodes, className = []) {
    return nodes.flatMap(node => {
        const classes = [...className, ...(node.properties ? node.properties.className : [])];
        if (node.children) return parseNodes(node.children, classes);
        return { text: node.value, classes };
    });
}

/**
 * A pass over some code blocks (`{ node, pos }`): their decorations, how many it highlighted, and
 * whether it left blocks plain (for another pass). A block's result is kept by its node (`kept`), so
 * an unchanged block costs nothing in the next pass.
 */
function blockDecorations(blocks, { lowlight, defaultLanguage }, kept) {
    lowlight.beginPass?.();
    const found = [];
    let highlighted = 0;
    const languages = lowlight.listLanguages();
    for (const block of blocks) {
        let from = block.pos + 1;
        // A name only (a document's value may be anything; see codeLanguage).
        const language = codeLanguage(block.node.attrs.language) || codeLanguage(defaultLanguage);
        const known = language && (languages.includes(language) || lowlight.registered?.(language));
        let result = kept.get(block.node);
        if (!result) {
            result = known ? lowlight.highlight(language, block.node.textContent) : lowlight.highlightAuto(block.node.textContent);
            // A block left plain for want of time is not kept: a later pass highlights it.
            if (!result.data?.plain) kept.set(block.node, result);
        }
        if (!result.data?.plain) highlighted += 1;
        for (const node of parseNodes(result.value || result.children || [])) {
            const to = from + node.text.length;
            if (node.classes.length) found.push(Decoration.inline(from, to, { class: node.classes.join(' ') }));
            from = to;
        }
    }
    return { found, unfinished: !!lowlight.unfinished?.(), highlighted };
}

/** A pass over the whole document: its decorations, and whether it left blocks plain. */
function decorations(doc, options, kept) {
    const { found, unfinished, highlighted } = blockDecorations(findChildren(doc, node => node.type.name === options.name), options, kept);
    return { set: DecorationSet.create(doc, found), unfinished, highlighted };
}

/**
 * The decorations after a change that touched code: those of the code blocks in or around what it
 * changed made again, every other block's carried over (typing in one block never redoes the rest).
 * Where it changed and no code block is left (one turned into a paragraph, or code joined to a
 * paragraph before it), the decorations of the text blocks at its edges go, whole.
 */
function changedDecorations(tr, current, options, kept) {
    const range = changedRange([tr]);
    const size = tr.doc.content.size;
    let from = Math.max(0, Math.min(range.from, size));
    let to = Math.max(from, Math.min(range.to, size));
    // The text blocks the change starts and ends in, whole: text joined into one keeps no decoration
    // from the block it came from.
    const $from = tr.doc.resolve(from);
    const $to = tr.doc.resolve(to);
    if ($from.parent.isTextblock) from = $from.start();
    if ($to.parent.isTextblock) to = $to.end();
    const blocks = [];
    tr.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === options.name) {
            blocks.push({ node, pos });
            return false;
        }
        return !node.isTextblock;
    });
    for (const { node, pos } of blocks) {
        from = Math.min(from, pos);
        to = Math.max(to, pos + node.nodeSize);
    }
    const pass = blockDecorations(blocks, options, kept);
    const mapped = current.set.map(tr.mapping, tr.doc);
    return { set: mapped.remove(mapped.find(from, to)).add(tr.doc, pass.found), unfinished: pass.unfinished, highlighted: pass.highlighted };
}

/**
 * Whether a transaction may change what a code block shows: its steps changed the document in or
 * around one (text typed, a language set, a block put in, turned into another kind), wherever the
 * selection is (see touchesNodes).
 */
const touchesCode = (tr, name) => touchesNodes(tr, node => node.type.name === name);

/**
 * @param {{ name: string, lowlight: object, defaultLanguage?: string | null }} options - lowlight
 *   from boundedLowlight (its `beginPass()` starts a pass, `unfinished()` says it left blocks plain).
 */
export function codeHighlightPlugin(options) {
    // A key of its own for each plugin (an editor may have more than one kind of code block).
    const codeHighlightKey = new PluginKey(CODE_HIGHLIGHT);
    const kept = new WeakMap();
    return new Plugin({
        key: codeHighlightKey,
        state: {
            init: (_config, { doc }) => decorations(doc, options, kept),
            apply: (tr, current) => {
                const retry = !!tr.getMeta(codeHighlightKey);
                // The whole document again: a pass of our own, or any change while a pass is unfinished
                // (its blocks may be gone).
                if (retry || (current.unfinished && tr.docChanged) || replacesWholeDocument(tr)) return { ...decorations(tr.doc, options, kept), retry };
                if (touchesCode(tr, options.name)) return { ...changedDecorations(tr, current, options, kept), retry: false };
                return { ...current, set: current.set.map(tr.mapping, tr.doc) };
            },
        },
        props: {
            decorations: state => codeHighlightKey.getState(state).set,
        },
        // Another pass while the last one left blocks plain, after the page has had its turn, as long as
        // passes still highlight more blocks than before (results the lowlight no longer keeps would
        // otherwise have it go round for ever).
        view: view => {
            let timer = null;
            let best = -1;
            const again = () => {
                const { unfinished, highlighted, retry } = codeHighlightKey.getState(view.state);
                // Progress is weighed between passes of our own only: an edit starts afresh.
                if (!unfinished || !retry) best = -1;
                if (timer !== null || !unfinished || highlighted <= best) return;
                best = highlighted;
                timer = setTimeout(() => {
                    timer = null;
                    if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(codeHighlightKey, true).setMeta('addToHistory', false));
                }, 0);
            };
            again();
            return { update: again, destroy: () => { if (timer !== null) clearTimeout(timer); } };
        },
    });
}
