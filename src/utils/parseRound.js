/**
 * Which parse is under way, for answers kept while one runs (a parse reads the same element many
 * times). Each parse through the editor's parser begins a round of its own (beginParse), and a round
 * also ends at the next microtask, so an answer is never kept for a later parse that may read the
 * same element changed.
 */
let round = 0;
let ending = false;

/** The parse under way. */
export function parseRound() {
    if (!ending) {
        ending = true;
        queueMicrotask(() => { round += 1; ending = false; });
    }
    return round;
}

/** A new parse begins: nothing kept for an earlier one is reused. */
export function beginParse() {
    round += 1;
}
