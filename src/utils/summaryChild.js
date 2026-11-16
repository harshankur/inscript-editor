/**
 * A `<details>` element's `<summary>`: its first child element of that name, or null. Shared by the
 * editor's parser (Details) and its Markdown writer.
 * @param {Element} element
 * @returns {Element|null}
 */
export function summaryChild(element) {
    return Array.from(element.children).find(child => child.nodeName === 'SUMMARY') ?? null;
}

/**
 * Whether an element is its `<details>` element's own summary (the first, the one a browser shows
 * and the editor reads); any other `<summary>` is text.
 * @param {Element|null|undefined} element
 * @returns {boolean}
 */
export function isOwnSummary(element) {
    // parentNode: the Markdown writer's DOM may not have parentElement.
    const parent = element?.parentNode;
    return element?.nodeName === 'SUMMARY' && parent?.nodeName === 'DETAILS' && summaryChild(parent) === element;
}
