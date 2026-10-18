import { Code as TiptapCode } from '@tiptap/extension-code';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Fragment } from '@tiptap/pm/model';

/** The one newline a Markdown renderer always ends a fenced code block with. */
const TRAILING_NEWLINE = /\r?\n$/;

/**
 * Code blocks with syntax highlighting. A Markdown renderer ends every fenced code block's text
 * with a newline (CommonMark keeps none), which showed as an empty last line after every load: that
 * one newline is not part of the code.
 */
export const CodeBlock = CodeBlockLowlight.extend({
    parseHTML() {
        return (this.parent?.() ?? []).map(rule => ({
            ...rule,
            getContent: (node, schema) => {
                const text = (node.textContent || '').replace(TRAILING_NEWLINE, '');
                return text ? Fragment.from(schema.text(text)) : Fragment.empty;
            },
        }));
    },
});

/**
 * Inline code that keeps the marks around it. TipTap's excludes every other mark, so a linked
 * code span (`` [`npm`](https://www.npmjs.com/) `` in Markdown) lost its link on load, and bold
 * code its bold.
 */
export const Code = TiptapCode.extend({
    excludes: '',
});
