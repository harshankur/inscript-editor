// Makes a version's HTML safe to show as a static preview (the history panel). The editor's own
// YouTube node serializes a live youtube.com iframe, so rendering history HTML as-is contacted
// YouTube just by opening the panel, even for hosts using the click-to-load facade or their own
// trust list. A preview must never load third-party content or run anything. (The document's own
// images are shown: the editor shows them too.)

import { SCRIPT_SCHEMES, isShareAddress, protocolRelativeAsWeb, urlScheme, urlStart } from './url.js';
import { isHandlerAttribute } from './dom.js';

/** Elements that fetch or run third-party content: replaced by a placeholder naming the source. */
const EMBEDDING = 'iframe, frame, frameset, embed, object, portal, video, audio, webview, fencedframe';
/**
 * Elements with no place in a document preview: removed outright. SVG animation can set an
 * attribute to a script URL; an SVG image fetches from anywhere.
 */
const REMOVED = 'script, style, link, meta, base, noscript, template, form, animate, set, animateMotion, animateTransform, image, feImage, '
    // Raw-text elements and foreign content (MathML, SVG), which parse differently once the cleaned
    // HTML is parsed again: text in one can come back as live markup (mutation XSS). The editor's
    // own HTML never holds them.
    + 'xmp, noembed, noframes, plaintext, listing, math, svg';
const URL_ATTRS = ['href', 'src', 'action', 'formaction', 'xlink:href', 'data'];
/**
 * Attributes dropped: those that only ever fetch something extra or tell another site about this
 * page (a link's ping, a referrer policy), and those that name an element on the host's page (an id
 * or name shadows the page's own globals: DOM clobbering) or tie it to a form.
 */
const DROPPED_ATTRS = ['srcset', 'poster', 'background', 'lowsrc', 'dynsrc', 'ping', 'referrerpolicy', 'attributionsrc', 'id', 'name', 'form', 'target'];
const DATA_RASTER_IMAGE = /^data:image\/(png|jpeg|gif|webp|avif|bmp)[;,]/;
const DATA_IMAGE = /^data:image\//;
/**
 * A style that could load something (url(), image-set(), image(), cross-fade(), @import) or hide one
 * in an escape (`u\\72l(`) or a comment: dropped whole, rather than rewritten. Stricter than a
 * diagram's (FETCHING_CSS, which allows `url(#…)`): a version's styles need none of that.
 */
const FETCHING_STYLE = /\\|url\s*\(|image-set|image\s*\(|cross-fade|@import|expression|\/\*/i;

/**
 * Is this URL attribute value unsafe in a preview? Read the way browsers read it (see url.js:
 * `java\tscript:` is `javascript:`). Script URLs never pass; a data URL only as a raster image, or
 * any image as an <img>'s src (an image runs nothing in it; a link to one could).
 */
function isUnsafeUrl(value, imageSource = false) {
    const scheme = urlScheme(String(value));
    if (SCRIPT_SCHEMES.includes(scheme)) return true;
    if (scheme !== 'data') return false;
    const start = urlStart(String(value)).toLowerCase();
    // An image's own src: any image, SVG too (an <img> runs nothing in it), as the editor shows it.
    return !(imageSource ? DATA_IMAGE.test(start) : DATA_RASTER_IMAGE.test(start));
}
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
 * The HTML as inert nodes: every embed replaced by a placeholder, scripts/styles/forms and
 * foreign content removed, event handler attributes, script URLs and identities dropped, and form
 * controls disabled. Parsed in an inert <template>, so nothing loads or runs while it is cleaned.
 * Insert the nodes themselves (never their HTML parsed again, which can bring back what was cleaned).
 * Null where there is no DOM or nothing to show.
 *
 * @param {string} html
 * @param {(source: string) => string} placeholderText - Label for an embed, given its host name.
 * @returns {DocumentFragment | null}
 */
export function inertPreviewNodes(html, placeholderText = source => source) {
    if (!html || typeof document === 'undefined') return null;
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
        for (const attribute of Array.from(el.attributes)) {
            const { name } = attribute;
            const lower = name.toLowerCase();
            // A protocol-relative address as the web address it means, as the editor reads it.
            const web = URL_ATTRS.includes(lower) ? protocolRelativeAsWeb(attribute.value) : attribute.value;
            if (web !== attribute.value) el.setAttribute(name, web);
            const { value } = attribute;
            const imageSource = el.tagName === 'IMG' && lower === 'src';
            if (isHandlerAttribute(attribute) || DROPPED_ATTRS.includes(lower)
                || (URL_ATTRS.includes(lower) && (isUnsafeUrl(value, imageSource) || isShareAddress(value)))
                || (lower === 'style' && FETCHING_STYLE.test(value))) {
                el.removeAttribute(name);
            }
        }
        if (el.tagName === 'INPUT') el.removeAttribute('src');
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
    // A version's diagrams are never Mermaid's to draw: a page's own Mermaid (mermaid.run, or its
    // drawing on load) draws every `.mermaid` element, with the page's settings, looser maybe.
    root.querySelectorAll('.mermaid').forEach(el => el.classList.remove('mermaid'));
    return root;
}
