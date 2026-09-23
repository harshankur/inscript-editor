import { Node } from '@tiptap/core';
import i18next from 'i18next';

/** Collapse runs of whitespace so a multi-line comment reads as one line in its chip. */
const collapse = text => text.replace(/\s+/g, ' ');

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
