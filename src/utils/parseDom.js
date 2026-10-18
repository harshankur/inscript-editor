// The DOM the editor's parser reads, made to fit the editor's schema first. HTML from a Markdown
// renderer (marked, markdown-it) is shaped for a page, not for this schema, and ProseMirror's parser
// does not reshape it: a real comment node is invisible to it, an image (a block here) wrapped in a
// paragraph leaves an empty paragraph behind, and a list item that opens with an image, a code block
// or a quote has that block moved out of the list (an item must open with a paragraph). The caller's
// DOM is never changed: a copy is made when anything needs reshaping.
import { decodeCommentText } from './commentText.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const SHOW_COMMENT = 128;
/** Blocks that cannot open a list item (its first child must be a paragraph). */
const NON_PARAGRAPH_BLOCKS = new Set(['IMG', 'PRE', 'BLOCKQUOTE', 'TABLE', 'DIV', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'DL', 'FIGURE', 'SECTION']);

const isBlankText = node => node.nodeType === TEXT_NODE && !node.nodeValue.trim();
const meaningfulChildren = el => Array.from(el.childNodes).filter(child => !isBlankText(child));

/** A paragraph that holds nothing but one image (how a renderer wraps `![alt](src)`). */
const isLoneImageParagraph = el => {
    if (el.nodeName !== 'P') return false;
    const children = meaningfulChildren(el);
    return children.length === 1 && children[0].nodeName === 'IMG';
};

/** A plain list item whose first child is a block that is not a paragraph. */
const opensWithBlock = el => {
    if (el.nodeName !== 'LI' || el.hasAttribute('data-type')) return false;
    const first = meaningfulChildren(el)[0];
    return !!first && first.nodeType === ELEMENT_NODE && NON_PARAGRAPH_BLOCKS.has(first.nodeName);
};

function needsWork(dom, doc) {
    if (typeof dom.querySelectorAll !== 'function') return false;
    const walker = doc.createTreeWalker(dom, SHOW_COMMENT);
    if (walker.nextNode()) return true;
    return Array.from(dom.querySelectorAll('p, li')).some(el => isLoneImageParagraph(el) || opensWithBlock(el));
}

/** `dom` reshaped for the schema (see the top of this file), or `dom` itself when it already fits. */
export function normalizeForParse(dom) {
    const doc = dom?.ownerDocument;
    if (!doc || typeof doc.createTreeWalker !== 'function' || !needsWork(dom, doc)) return dom;
    const copy = dom.cloneNode(true);

    // Real comments become the comment span the HtmlComment node parses from (text as an
    // attribute, never markup; decoded from what the Markdown save wrote).
    const comments = [];
    const walker = doc.createTreeWalker(copy, SHOW_COMMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) comments.push(node);
    for (const comment of comments) {
        if (comment.nodeType !== COMMENT_NODE || !comment.parentNode) continue;
        const span = doc.createElement('span');
        span.setAttribute('data-html-comment', decodeCommentText(comment.data));
        comment.parentNode.replaceChild(span, comment);
    }

    for (const paragraph of Array.from(copy.querySelectorAll('p')).filter(isLoneImageParagraph)) {
        paragraph.replaceWith(meaningfulChildren(paragraph)[0]);
    }
    for (const item of Array.from(copy.querySelectorAll('li')).filter(opensWithBlock)) {
        item.insertBefore(doc.createElement('p'), item.firstChild);
    }
    return copy;
}
