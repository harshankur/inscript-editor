import { Node } from '@tiptap/core';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import i18next from 'i18next';

/** Collapse runs of whitespace so a multi-line comment reads as one line in its chip. */
const collapse = text => text.replace(/\s+/g, ' ');

const COMMENT_NODE = 8;

/**
 * `dom` with every real `<!-- ... -->` comment node replaced by the comment span this node
 * parses from. ProseMirror's parser only ever visits elements and text, so without this a real
 * comment (what marked, markdown-it and most HTML carry, as opposed to officeParser's span)
 * vanished on load. The caller's DOM is never mutated: it is cloned when there is a comment.
 */
function withCommentSpans(dom) {
    const doc = dom?.ownerDocument;
    if (!doc || typeof doc.createTreeWalker !== 'function') return dom;
    const find = root => {
        const found = [];
        const walker = doc.createTreeWalker(root, 128 /* NodeFilter.SHOW_COMMENT */);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) found.push(node);
        return found;
    };
    if (find(dom).length === 0) return dom;
    const copy = dom.cloneNode(true);
    for (const comment of find(copy)) {
        if (comment.nodeType !== COMMENT_NODE || !comment.parentNode) continue;
        const span = doc.createElement('span');
        span.setAttribute('data-html-comment', comment.data); // attribute, never markup
        comment.parentNode.replaceChild(span, comment);
    }
    return copy;
}

/** ProseMirror's DOMParser, reading real comment nodes as source-comment nodes. */
class CommentAwareDOMParser extends ProseMirrorDOMParser {
    parse(dom, options) {
        return super.parse(withCommentSpans(dom), options);
    }

    parseSlice(dom, options) {
        return super.parseSlice(withCommentSpans(dom), options);
    }
}

/**
 * A source comment (`<!-- ... -->`) from the document: the author's hidden note. It is kept verbatim so a
 * Markdown/HTML round trip neither loses it nor turns it into visible text.
 *
 * An inline atom (a comment that stood on its own lines arrives wrapped in its own paragraph). It is
 * parsed from, and serialized back to, officeParser's `sourceAttributes` shape, an empty
 * `<span data-html-comment="raw text">`, so the saved HTML is exactly what the parser reads back. In the
 * editor it shows as a small non-editable chip, `<!-- … -->` with the full text on hover, so a writer can
 * see the note is there and delete it. The chip is a node view, so it never leaks into getHTML(). The
 * comment text is only ever set as text content or an attribute, never parsed as markup.
 */
export const HtmlComment = Node.create({
    name: 'htmlComment',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,

    addAttributes() {
        return {
            text: {
                default: '',
                parseHTML: dom => dom.getAttribute('data-html-comment') ?? '',
                renderHTML: attrs => ({ 'data-html-comment': attrs.text ?? '' }),
            },
        };
    },

    parseHTML() {
        // The canonical shape is the span; a div is accepted too (it wraps into a paragraph on load).
        return [{ tag: 'span[data-html-comment]' }, { tag: 'div[data-html-comment]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', HTMLAttributes];
    },

    // Every parse (initial content, setContent, insertContent, paste) goes through the parser
    // ProseMirror caches on the schema, and beforeCreate runs after the schema exists but before
    // the initial content is parsed. Installing the comment-aware parser there covers them all.
    onBeforeCreate() {
        const schema = this.editor?.schema;
        if (!schema || schema.cached.domParser instanceof CommentAwareDOMParser) return;
        schema.cached.domParser = new CommentAwareDOMParser(schema, ProseMirrorDOMParser.schemaRules(schema));
    },

    addNodeView() {
        return ({ node }) => {
            const text = node.attrs.text ?? '';
            const dom = document.createElement('span');
            dom.className = 'html-comment';
            dom.setAttribute('contenteditable', 'false'); // attribute, not the property: reflects everywhere
            dom.setAttribute('role', 'note');
            dom.setAttribute('aria-label', i18next.t('htmlComment', { ns: 'inscript-editor', defaultValue: 'Hidden comment' }));
            dom.title = text.trim();
            dom.textContent = `<!--${collapse(text)}-->`;
            return { dom };
        };
    },
});
