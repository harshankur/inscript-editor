/**
 * Lowlight for a document's code blocks, bounded. TipTap's code-block plugin highlights every code
 * block again whenever a change touches one, and some highlight.js grammars take quadratic time on
 * crafted text (a document can name its block's language), so large or many blocks froze the page on
 * load and on every keystroke. Here:
 * - a block's result is kept by the highlighting plugin (by its node: see codeHighlight.js), so an
 *   unchanged block costs nothing again, and results live only as long as their document;
 * - a block longer than HIGHLIGHT_LIMIT (AUTO_HIGHLIGHT_LIMIT when its language is guessed, which
 *   runs every grammar) is shown as plain text;
 * - the passes over documents in one turn of the page (one change; every editor the page makes at
 *   once) highlight for at most PASS_BUDGET_MS together: past it, the blocks not highlighted yet are
 *   shown as plain text this time (not kept), and later passes go on from the results kept.
 */

/** Characters a block with a named language may have and still be highlighted. */
export const HIGHLIGHT_LIMIT = 5000;
/** Characters a block whose language is guessed may have and still be highlighted. */
export const AUTO_HIGHLIGHT_LIMIT = 2000;
/** Highlighting time the passes of one turn of the page may take together, in ms. */
export const PASS_BUDGET_MS = 50;
const plain = value => ({ type: 'root', children: [{ type: 'text', value: String(value) }], data: { language: null, relevance: 0, plain: true } });
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * @param {object} lowlight - A lowlight instance (createLowlight).
 * @returns {object} The same API (highlight, highlightAuto, listLanguages, registered), bounded.
 */
export function boundedLowlight(lowlight) {
    // Time spent in this turn of the page: the passes of one turn (every editor on the page shares
    // this lowlight) are synchronous, so the turn ends at the next microtask.
    let passSpent = null;
    // Whether the pass under way has left a block plain for want of time (another pass will do it).
    let unfinished = false;
    const startTurn = () => {
        if (passSpent !== null) return;
        passSpent = 0;
        queueMicrotask(() => { passSpent = null; });
    };
    // A pass begins with beginPass (the highlighting plugin's), or else with the first call; it spends
    // from its turn's budget.
    const beginPass = () => {
        startTurn();
        unfinished = false;
    };
    const spend = ms => { passSpent += ms; };
    const overBudget = () => passSpent !== null && passSpent >= PASS_BUDGET_MS;

    // Highlighted within the turn's budget; past it, plain this time (another pass will do it).
    const timed = (make, value) => {
        if (overBudget()) {
            unfinished = true;
            return plain(value);
        }
        const started = now();
        const result = make();
        spend(now() - started);
        return result;
    };
    return {
        ...lowlight,
        beginPass,
        unfinished: () => unfinished,
        listLanguages: (...args) => lowlight.listLanguages(...args),
        registered: (...args) => (typeof lowlight.registered === 'function' ? lowlight.registered(...args) : false),
        highlight: (language, value, options) => {
            startTurn();
            const text = String(value);
            if (text.length > HIGHLIGHT_LIMIT) return plain(text);
            return timed(() => lowlight.highlight(language, text, options), text);
        },
        highlightAuto: (value, options) => {
            startTurn();
            const text = String(value);
            if (text.length > AUTO_HIGHLIGHT_LIMIT) return plain(text);
            return timed(() => lowlight.highlightAuto(text, options), text);
        },
    };
}
