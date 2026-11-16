/**
 * A diagram's SVG (what Mermaid drew from a document) as inert nodes to put in the page: parsed once
 * in an inert document (as HTML, which reads Mermaid's `<br>` and named entities as it writes them),
 * with anything that could run, load or navigate removed, whatever Mermaid's own settings were when it
 * drew (a host's page may set them looser, at any moment). Inserted as these nodes, never as markup
 * parsed again (where text could come back as live markup).
 */

import { childrenMoved, isHandlerAttribute } from './dom.js';

const HTML_MIME = 'text/html';
/** CSS comments: removed before a style is read (`:/**\/host` is `:host`). */
const CSS_COMMENT = /\/\*[\s\S]*?(?:\*\/|$)/g;
/** Elements removed with what they hold. */
const REMOVED = new Set([
    'script', 'iframe', 'object', 'embed', 'frame', 'frameset', 'link', 'meta', 'base', 'form', 'input', 'button',
    'textarea', 'select', 'audio', 'video', 'source', 'track', 'image', 'img', 'picture', 'portal', 'animate', 'set',
    'animatemotion', 'animatetransform', 'animatecolor', 'discard', 'handler', 'listener', 'feimage',
    'template', 'noscript', 'webview', 'fencedframe',
]);
/** A link is kept as its text: a diagram's link would take the reader's page away. */
const UNWRAPPED = new Set(['a']);
const LINK_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'data', 'srcset', 'poster', 'background', 'ping']);
/**
 * CSS that could load something, read with its escapes decoded (see decodedCss). A diagram's own
 * `url(#…)` (a gradient, a marker) is allowed; the history preview has a stricter list of its own
 * (FETCHING_STYLE).
 */
const FETCHING_CSS = /@import|url\s*\((?!\s*['"]?\s*#)|image-set|expression\s*\(|cross-fade|image\s*\(/i;
const CSS_HEX_ESCAPE = /\\([0-9a-f]{1,6})[ \t\n\r\f]?/gi;
const CSS_CHARACTER_ESCAPE = /\\([\s\S])/g;
const MAX_CODE_POINT = 0x10ffff;
const REPLACEMENT_CHARACTER = '\ufffd';
/**
 * CSS with its escapes read as a browser reads them (`u\72l(` is `url(`, `:ho\st` is `:host`), to be
 * checked: the text kept is left as it is, so a diagram's own escapes (a font name) still work.
 */
const decodedCss = css => css
    .replace(CSS_HEX_ESCAPE, (_escape, hex) => {
        const code = Number.parseInt(hex, 16);
        const surrogate = code >= 0xd800 && code <= 0xdfff;
        return code === 0 || code > MAX_CODE_POINT || surrogate ? REPLACEMENT_CHARACTER : String.fromCodePoint(code);
    })
    .replace(CSS_CHARACTER_ESCAPE, '$1');
/** Whether CSS (comments already removed) could load something or reach past the diagram. */
const unsafeCss = css => {
    const decoded = decodedCss(css);
    return FETCHING_CSS.test(decoded) || ESCAPING_CSS.test(decoded);
};
/**
 * CSS that would reach past the diagram's shadow root (it is drawn in one, see Mermaid.jsx): rules
 * for its host element, or for what is slotted into it.
 */
const ESCAPING_CSS = /:host|::?slotted|@font-face/i;
/** Attributes that are names or text, not presentation: not read as CSS. */
const NOT_CSS = name => name === 'class' || name === 'id' || name === 'role' || name.startsWith('aria-') || name.startsWith('data-');


function cleanElement(el) {
    for (const { name, localName, value } of Array.from(el.attributes)) {
        // By its local name, whatever its prefix (`x:href` is an href, namespaced or not).
        const lower = (localName || name).toLowerCase().split(':').pop();
        if (isHandlerAttribute({ name, localName }) || lower === 'name') el.removeAttribute(name);
        // Only a reference within the diagram (`#arrowhead`).
        else if (LINK_ATTRS.has(lower) && !value.trim().startsWith('#')) el.removeAttribute(name);
        // Any presentation value (a style, a fill, a mask) that could load something or reach past
        // the diagram, escapes and comments included.
        // A value with a comment is dropped whole.
        else if (!NOT_CSS(lower) && (/\/\*/.test(value) || unsafeCss(value))) {
            el.removeAttribute(name);
        }
    }
}

/**
 * @param {string} svgText
 * @param {Document} doc - The page the nodes go into.
 * @returns {Element | null} The cleaned <svg>, adopted into `doc`, or null when it is not one.
 */
export function cleanSvg(svgText, doc) {
    if (typeof svgText !== 'string' || !svgText.trim() || !doc?.defaultView?.DOMParser) return null;
    // An inert document: nothing in it runs or loads while it is cleaned.
    const parsed = new doc.defaultView.DOMParser().parseFromString(svgText, HTML_MIME);
    const root = parsed.body?.firstElementChild;
    if (!root || root.localName !== 'svg' || parsed.body.childElementCount !== 1) return null;

    for (const el of Array.from(root.getElementsByTagName('*'))) {
        // Removed already, with an ancestor.
        if (!root.contains(el)) continue;
        const name = el.localName.toLowerCase();
        if (REMOVED.has(name)) { el.remove(); continue; }
        if (name === 'style') {
            // Read without its comments, and kept so (a comment can split `:host`).
            const css = (el.textContent || '').replace(CSS_COMMENT, '');
            if (unsafeCss(css)) el.remove();
            else {
                el.textContent = css;
                // Its attributes as any element's (an `onload` on a style runs).
                cleanElement(el);
            }
            continue;
        }
        if (UNWRAPPED.has(name)) {
            el.replaceWith(childrenMoved(el));
            continue;
        }
        cleanElement(el);
    }
    cleanElement(root);
    return doc.importNode(root, true);
}
