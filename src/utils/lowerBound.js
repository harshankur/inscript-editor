/**
 * The index of the first item at or after `pos` in a list sorted by position (its length when none
 * is): a binary search.
 * @template T
 * @param {T[]} sorted
 * @param {number} pos
 * @param {(item: T) => number} [positionOf] - An item's position (the item itself when not given).
 */
export function lowerBound(sorted, pos, positionOf = item => item) {
    let low = 0;
    let high = sorted.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (positionOf(sorted[mid]) < pos) low = mid + 1;
        else high = mid;
    }
    return low;
}
