import { findChildren } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { codeLanguage } from '../utils/codeLanguage.js';
import { touchesNodes } from '../utils/transactions.js';

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
 * A pass over the document: its decorations, and whether it left blocks plain (for another pass). A
 * block's result is kept by its node (`kept`), so an unchanged block costs nothing in the next pass.
 */
function decorations(doc, { name, lowlight, defaultLanguage }, kept) {
    lowlight.beginPass?.();
    const found = [];
    let highlighted = 0;
    const languages = lowlight.listLanguages();
    for (const block of findChildren(doc, node => node.type.name === name)) {
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
    return { set: DecorationSet.create(doc, found), unfinished: !!lowlight.unfinished?.(), highlighted };
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
                // Also after any change while a pass is unfinished (its blocks may be gone).
                if (retry || touchesCode(tr, options.name) || (current.unfinished && tr.docChanged)) return { ...decorations(tr.doc, options, kept), retry };
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
