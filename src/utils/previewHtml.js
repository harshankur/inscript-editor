// Makes a version's HTML safe to show as a static preview (the history panel). The editor's own
// YouTube node serializes a live youtube.com iframe, so rendering history HTML as-is contacted
// YouTube just by opening the panel, even for hosts using the click-to-load facade or their own
// trust list. A preview must never load third-party content or run anything.

/** Elements that fetch or run third-party content: replaced by a placeholder naming the source. */
const EMBEDDING = 'iframe, frame, frameset, embed, object, portal, video, audio';
/** Elements with no place in a document preview: removed outright. */
const REMOVED = 'script, style, link, meta, base, noscript, template, form';
const URL_ATTRS = ['href', 'src', 'action', 'formaction', 'xlink:href', 'poster', 'data', 'srcset'];
const UNSAFE_URL = /^\s*(javascript|vbscript|data:text\/html)/i;
/** Block-level tags: whitespace-only text between two of them is layout noise (the content
 *  rules use white-space: pre-wrap, so it would render as blank lines). */
const BLOCK_TAGS = new Set([
    'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'DL', 'DT', 'DD', 'TABLE', 'COLGROUP', 'COL',
    'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'BLOCKQUOTE', 'PRE', 'HR', 'DIV', 'FIGURE', 'SECTION',
]);
const isBlock = node => node?.nodeType === 1 && BLOCK_TAGS.has(node.tagName);
/** The fragment root, or a block element (an inline parent's edges are not block boundaries). */
const isBlockParent = node => node?.nodeType === 11 || isBlock(node);

function sourceHost(src) {
    if (!src) return '';
    try {
        return new URL(src, typeof location !== 'undefined' ? location.href : 'https://localhost/').hostname || src;
    } catch {
        return src;
    }
}

/**
 * The HTML with every embed replaced by a placeholder, scripts/styles/forms removed, event
 * handler attributes and script URLs dropped, and form controls disabled. Parsed in an inert
 * <template>, so nothing loads or runs while it is cleaned. Returns '' where there is no DOM.
 *
 * @param {string} html
 * @param {(source: string) => string} placeholderText - Label for an embed, given its host name.
 */
export function inertPreviewHtml(html, placeholderText = source => source) {
    if (!html || typeof document === 'undefined') return '';
    const template = document.createElement('template');
    template.innerHTML = html;
    const root = template.content;

    root.querySelectorAll(REMOVED).forEach(el => el.remove());
    root.querySelectorAll(EMBEDDING).forEach(el => {
        const placeholder = document.createElement('div');
        placeholder.className = 'inscript-preview-embed';
        placeholder.textContent = placeholderText(sourceHost(el.getAttribute('src') || el.getAttribute('data') || ''));
        el.replaceWith(placeholder);
    });
    root.querySelectorAll('*').forEach(el => {
        for (const { name, value } of Array.from(el.attributes)) {
            const lower = name.toLowerCase();
            if (lower.startsWith('on') || (URL_ATTRS.includes(lower) && UNSAFE_URL.test(value))) el.removeAttribute(name);
        }
        if (el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
            el.setAttribute('disabled', '');
        }
    });
    const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
    const blank = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentNode;
        const boundary = sibling => (sibling ? isBlock(sibling) : isBlockParent(parent));
        if (!/\S/.test(node.nodeValue) && boundary(node.previousSibling) && boundary(node.nextSibling)
            && parent?.nodeName !== 'PRE' && parent?.nodeName !== 'CODE') {
            blank.push(node);
        }
    }
    blank.forEach(node => node.remove());
    return template.innerHTML;
}
