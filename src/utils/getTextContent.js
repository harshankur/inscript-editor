/**
 * The text of an HTML string. Without a DOM (server-side rendering) the tags are skipped with a
 * single scan: a pattern over the string re-scanned to the end from every unclosed `<` and took
 * seconds on long input.
 */
export const getTextContent = (html) => {
    if (typeof DOMParser === 'undefined') return stripTags(html || '');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};

function stripTags(html) {
    let text = '';
    let index = 0;
    while (index < html.length) {
        const open = html.indexOf('<', index);
        if (open === -1) { text += html.slice(index); break; }
        text += html.slice(index, open);
        const close = html.indexOf('>', open + 1);
        // An unclosed `<` is not a tag: it and the rest are text (as with the pattern it replaces).
        if (close === -1) { text += html.slice(open); break; }
        index = close + 1;
    }
    return text;
}
