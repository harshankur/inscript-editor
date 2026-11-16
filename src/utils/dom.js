/**
 * An element's children moved into a fragment, one at a time (an element may hold more children than
 * a call takes arguments, so never spread into append or replaceWith).
 * @param {Element} element
 * @returns {DocumentFragment}
 */
export function childrenMoved(element) {
    const fragment = element.ownerDocument.createDocumentFragment();
    while (element.firstChild) fragment.appendChild(element.firstChild);
    return fragment;
}

/**
 * Whether an attribute is an event handler (`onload`, `xlink:onclick`), by its name or local name,
 * whatever its prefix. Shared by the diagram cleaner and the history preview.
 * @param {{ name: string, localName?: string }} attribute
 */
export const isHandlerAttribute = ({ name, localName }) => [name, localName || name].some(n => n.toLowerCase().split(':').pop().startsWith('on'));

/** A whole number at the start of an attribute's value, as a browser reads one (spaces, `+`, digits). */
const HTML_INTEGER = /^[\t\n\f\r ]*\+?(\d+)(?:\.\d*)?(%)?/;

/**
 * An attribute's value read as a browser reads a whole number or a dimension (`colspan`, `height`): its
 * leading digits (`1e5` is 1, `0x10` is 0), and whether a `%` follows them; null when it starts with none.
 * @param {unknown} value
 * @returns {{ value: number, percent: boolean } | null}
 */
export function htmlInteger(value) {
    const match = HTML_INTEGER.exec(String(value ?? ''));
    return match ? { value: Number.parseInt(match[1], 10), percent: match[2] === '%' } : null;
}
