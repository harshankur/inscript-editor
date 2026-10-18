// A source comment's text as written inside `<!-- ... -->`, and back. Two things cannot be written
// literally: what would close the comment early (`-->`, `--!>`, a leading `>` or `->`), and, in a
// comment inside a line of text, a line break: Markdown reads the next line on its own (a blank
// line ends the paragraph, a line starting with `>` or `</div>` opens a quote or an HTML block), so
// the rest of the comment would be read as Markdown and HTML. Both are written as character
// references, and read back exactly. A comment standing alone keeps its line breaks.

const COMMENT_CLOSERS = /--(!?)>/g;
const LINE_BREAK = /\r?\n|\r/g;

const ENCODED_CLOSERS = /--(!?)&gt;/g;
const ENCODED_NEWLINE = /&#10;/g;
const ENCODED_LEADING_GT = '&gt;';
const ENCODED_LEADING_ARROW = '-&gt;';

/**
 * The comment text, safe to write between `<!--` and `-->` in HTML or Markdown.
 * `keepLineBreaks`: the comment stands alone on its lines (an HTML block), where they are safe.
 */
export function encodeCommentText(text, { keepLineBreaks = false } = {}) {
    let encoded = String(text ?? '').replace(COMMENT_CLOSERS, '--$1&gt;');
    if (encoded.startsWith('>')) encoded = `${ENCODED_LEADING_GT}${encoded.slice(1)}`;
    else if (encoded.startsWith('->')) encoded = `${ENCODED_LEADING_ARROW}${encoded.slice(2)}`;
    return keepLineBreaks ? encoded : encoded.replace(LINE_BREAK, '&#10;');
}

/** The original text of a comment written by encodeCommentText (other comments pass through). */
export function decodeCommentText(text) {
    let decoded = String(text ?? '').replace(ENCODED_NEWLINE, '\n').replace(ENCODED_CLOSERS, '--$1>');
    if (decoded.startsWith(ENCODED_LEADING_GT)) decoded = `>${decoded.slice(ENCODED_LEADING_GT.length)}`;
    else if (decoded.startsWith(ENCODED_LEADING_ARROW)) decoded = `->${decoded.slice(ENCODED_LEADING_ARROW.length)}`;
    return decoded;
}
