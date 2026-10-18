import { DEFAULT_TABLE_ALIGN, TABLE_ALIGN_ATTRIBUTE } from '../constants.js';
import { encodeCommentText } from '../utils/commentText.js';

/**
 * Does a turndown rule's filter match this node? Mirrors turndown's own matching: a tag
 * name, a list of tag names, or a predicate `(node, options) => boolean`.
 */
function ruleMatches(rule, node, options) {
    const { filter } = rule;
    if (typeof filter === 'function') return !!filter.call(rule, node, options);
    const tags = Array.isArray(filter) ? filter : [filter];
    return tags.some(tag => typeof tag === 'string' && tag.toUpperCase() === node.nodeName);
}

// --- Writing HTML that Markdown keeps as it is -------------------------------------------------
//
// Nodes Markdown has no syntax for are written as HTML. CommonMark keeps that HTML only on its own
// terms: a block of HTML ends at the first blank line (the rest is read as Markdown again), and
// between inline tags the text is Markdown. So kept HTML is written here, not taken from the DOM
// serializer: on one line (every line break a character reference), attribute values fully escaped
// (some serializers leave `<` raw in them), and, for nodes whose text is data rather than prose (a
// formula, an abbreviation, a wikilink target), every character Markdown would act on as a reference.

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const VOID_ELEMENTS = new Set(['AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT', 'LINK', 'META', 'SOURCE', 'TRACK', 'WBR']);
const LINE_BREAK = /\r?\n|\r/g;
const NEWLINE_REFERENCE = '&#10;';
/** Characters with a meaning in Markdown inline text. */
const MARKDOWN_PUNCTUATION = /[\\`*_[\]~|!#+\-.()]/g;

const escapeText = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttribute = value => value
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(LINE_BREAK, NEWLINE_REFERENCE).replace(/\t/g, '&#9;');

function encodeText(text, literal) {
    let encoded = escapeText(text).replace(LINE_BREAK, NEWLINE_REFERENCE);
    if (literal) encoded = encoded.replace(MARKDOWN_PUNCTUATION, ch => `&#${ch.charCodeAt(0)};`);
    return encoded;
}

/** `<tag attr="…">`, attributes escaped for a single line. */
function openTag(node) {
    const attrs = Array.from(node.attributes || []).map(a => ` ${a.name}="${escapeAttribute(a.value)}"`).join('');
    return `<${node.nodeName.toLowerCase()}${attrs}>`;
}

const closeTag = node => (VOID_ELEMENTS.has(node.nodeName) ? '' : `</${node.nodeName.toLowerCase()}>`);

/**
 * The node as one line of HTML. `literal`: its text is data, so no character in it may act as
 * Markdown (the text of inline HTML is otherwise parsed as Markdown).
 */
function serializeHtml(node, literal = false) {
    if (node.nodeType === TEXT_NODE) return encodeText(node.nodeValue, literal);
    if (node.nodeType !== ELEMENT_NODE) return '';
    if (VOID_ELEMENTS.has(node.nodeName)) return openTag(node);
    let inner = '';
    for (const child of node.childNodes) inner += serializeHtml(child, literal);
    return `${openTag(node)}${inner}${closeTag(node)}`;
}

/** A copy of `node` whose text is the exact source kept in `attribute` (turndown collapses text). */
function withSourceText(node, attribute) {
    const source = node.getAttribute(attribute);
    if (source === null) return node;
    const copy = node.cloneNode(false);
    copy.textContent = source;
    return copy;
}

const htmlBlock = node => `\n\n${serializeHtml(node)}\n\n`;
const rawBlock = (content, node) => htmlBlock(node);
const literalInline = (content, node) => serializeHtml(node, true);

// --- Where a node sits in its line -------------------------------------------------------------

const BLOCK_ELEMENTS = /^(P|DIV|LI|UL|OL|BLOCKQUOTE|H[1-6]|TD|TH|TR|TABLE|SECTION|PRE|DL|DT|DD|FIGURE|BODY|X-TURNDOWN)$/;
const isBlank = node => node.nodeType === TEXT_NODE && !node.nodeValue.trim();
const isBlockElement = node => !!node && BLOCK_ELEMENTS.test(node.nodeName);

function previousMeaningfulSibling(node) {
    let sibling = node.previousSibling;
    while (sibling && isBlank(sibling)) sibling = sibling.previousSibling;
    return sibling;
}

function nextMeaningfulSibling(node) {
    let sibling = node.nextSibling;
    while (sibling && isBlank(sibling)) sibling = sibling.nextSibling;
    return sibling;
}

/** Does nothing come before `node` on its line (in its block, or since a line break)? */
function startsLine(node) {
    for (let current = node; current && !isBlockElement(current); current = current.parentNode) {
        const previous = previousMeaningfulSibling(current);
        if (previous) return previous.nodeName === 'BR';
    }
    return true;
}

/** Does anything follow `node` on its line? */
function hasFollowingContent(node) {
    for (let current = node; current && !isBlockElement(current); current = current.parentNode) {
        const next = nextMeaningfulSibling(current);
        if (next) return next.nodeName !== 'BR';
    }
    return false;
}

/** Is `node` inside a table cell (a GFM cell is one line)? */
function insideTableCell(node) {
    for (let current = node.parentNode; current; current = current.parentNode) {
        if (current.nodeName === 'TD' || current.nodeName === 'TH') return true;
        if (current.nodeName === 'TABLE') return false;
    }
    return false;
}

/** The character just before / after `node` in the text flow ('' at the edge of its block). */
function adjacentCharacter(node, direction) {
    for (let current = node; current && !isBlockElement(current); current = current.parentNode) {
        const sibling = direction < 0 ? current.previousSibling : current.nextSibling;
        if (sibling) {
            if (sibling.nodeName === 'BR') return '\n';
            const text = sibling.textContent || '';
            if (text) return direction < 0 ? text[text.length - 1] : text[0];
            return sibling.nodeType === ELEMENT_NODE ? 'x' : '';
        }
    }
    return '';
}

// --- Formatting Markdown has no syntax for ---------------------------------------------------

/** Inline formatting the toolbar offers that Markdown cannot write: kept as its own HTML tag. */
const KEPT_INLINE_TAGS = ['mark', 'sub', 'sup', 'u'];
/** Alignments that are the page default, so a block carrying one is still plain Markdown. */
const DEFAULT_TEXT_ALIGNMENTS = ['left', 'start'];
const TEXT_ALIGN_PATTERN = /(?:^|;)\s*text-align\s*:\s*([a-z-]+)/i;
const ALIGNABLE_BLOCK_PATTERN = /^(P|H[1-6])$/;

/**
 * The element's own tags around its already-converted content, attributes included
 * (`<mark data-color="…" style="…">` + content + `</mark>`), so Markdown inside it stays Markdown.
 * An element with nothing in it writes nothing.
 */
function keepInlineTag(content, node) {
    if (!content.trim()) return '';
    return `${openTag(node)}${content}${closeTag(node)}`;
}

/** The non-default `text-align` a paragraph or heading carries, or null. */
function blockTextAlign(node) {
    if (!ALIGNABLE_BLOCK_PATTERN.test(node.nodeName)) return null;
    const match = TEXT_ALIGN_PATTERN.exec(node.getAttribute('style') || '');
    if (!match) return null;
    const align = match[1].toLowerCase();
    return DEFAULT_TEXT_ALIGNMENTS.includes(align) ? null : align;
}

// --- Emphasis, line breaks and lists, the CommonMark way --------------------------------------

const PUNCTUATION = /[\p{P}\p{S}]/u;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const WHITESPACE = /\s/;

/**
 * Emphasis written with Markdown delimiters only where CommonMark reads them back as emphasis.
 * Inside a word `_` is not emphasis, so `*` is used; a delimiter touching punctuation on its inner
 * side counts only with whitespace or punctuation on its outer side (`H**<sub>2</sub>**O` is
 * literal), so the emphasis is written as its HTML tag instead.
 */
function emphasis(content, node, delimiter, tag) {
    if (!content.trim()) return '';
    const before = adjacentCharacter(node, -1);
    const after = adjacentCharacter(node, 1);
    const marker = (WORD_CHARACTER.test(before) || WORD_CHARACTER.test(after)) ? delimiter.replace(/_/g, '*') : delimiter;
    const outerOk = ch => !ch || WHITESPACE.test(ch) || PUNCTUATION.test(ch);
    const opens = !PUNCTUATION.test(content[0]) || outerOk(before);
    const closes = !PUNCTUATION.test(content[content.length - 1]) || outerOk(after);
    return opens && closes ? `${marker}${content}${marker}` : `<${tag}>${content}</${tag}>`;
}

const HEADING_PATTERN = /^H[1-6]$/;

function insideHeading(node) {
    for (let current = node.parentNode; current; current = current.parentNode) {
        if (HEADING_PATTERN.test(current.nodeName)) return true;
        if (isBlockElement(current)) return false;
    }
    return false;
}

/**
 * A hard line break. Markdown's own (two spaces, newline) ends a heading, makes a blank line when
 * two follow each other, and is dropped at the end of a paragraph: those are written as `<br>`.
 */
function lineBreak(content, node, options) {
    const previous = previousMeaningfulSibling(node);
    const next = nextMeaningfulSibling(node);
    if (insideHeading(node) || previous?.nodeName === 'BR' || next?.nodeName === 'BR' || !hasFollowingContent(node)) return '<br>';
    return `${options.br}\n`;
}

/**
 * Escaped brackets (`\[`, `\]`) in Markdown text as character references; other escapes, and
 * code spans (where a reference would show literally), kept as they are.
 */
function bracketsAsReferences(markdown) {
    let out = '';
    for (let i = 0; i < markdown.length; i++) {
        const ch = markdown[i];
        if (ch === '`') {
            const run = /^`+/.exec(markdown.slice(i))[0];
            const close = markdown.indexOf(run, i + run.length);
            const end = close === -1 ? i + run.length : close + run.length;
            out += markdown.slice(i, end);
            i = end - 1;
            continue;
        }
        if (ch !== '\\' || i + 1 >= markdown.length) { out += ch; continue; }
        const next = markdown[i + 1];
        out += next === '[' ? '&#91;' : next === ']' ? '&#93;' : `${ch}${next}`;
        i += 1;
    }
    return out;
}

const isList = node => node?.nodeName === 'UL' || node?.nodeName === 'OL';

/**
 * How many lists of the same kind come right before this one. CommonMark merges adjacent lists
 * that use the same marker, so every other one uses the alternate marker.
 */
function adjacentListsBefore(list) {
    let count = 0;
    for (let previous = previousMeaningfulSibling(list); isList(previous) && previous.nodeName === list.nodeName; previous = previousMeaningfulSibling(previous)) {
        if (previous.nodeType !== ELEMENT_NODE) break;
        count += 1;
    }
    return count;
}

/** The list item's marker with its padding: `*   `, `-   `, `3.  ` or `3)  `. */
function listItemPrefix(node, options) {
    const list = node.parentNode;
    const alternate = isList(list) && adjacentListsBefore(list) % 2 === 1;
    if (list?.nodeName === 'OL') {
        const start = list.getAttribute('start');
        const index = Array.prototype.indexOf.call(list.children, node);
        return `${start ? Number(start) + index : index + 1}${alternate ? ')' : '.'}  `;
    }
    const bullet = options?.bulletListMarker || '*';
    return `${alternate ? (bullet === '-' ? '*' : '-') : bullet}   `;
}

/** Mirrors turndown's own listItem replacement (7.2), with the marker from listItemPrefix. */
function listItem(content, node, options, marker = '') {
    const prefix = listItemPrefix(node, options);
    const isParagraph = /\n$/.test(content);
    let body = content.replace(/^\n+|\n+$/g, '') + (isParagraph ? '\n' : '');
    body = body.replace(/\n/gm, `\n${' '.repeat(prefix.length)}`);
    const lead = marker ? `${marker} ` : '';
    return `${prefix}${lead}${body}${node.nextSibling ? '\n' : ''}`;
}

// --- Tables ----------------------------------------------------------------------------

const closestTable = node => {
    let el = node.parentNode;
    while (el && el.nodeName !== 'TABLE') el = el.parentNode;
    return el;
};

const tableRows = table => Array.from(table.rows || []);

const GFM_ALIGNMENTS = ['left', 'center', 'right'];
const CELL_ALIGN_STYLE = /^\s*text-align\s*:\s*(left|center|right)\s*;?\s*$/i;

/** A cell's alignment: null for none, false when its style holds anything GFM cannot write. */
function cellAlign(cell) {
    const style = cell.getAttribute('style');
    if (!style || !style.trim()) return null;
    const match = CELL_ALIGN_STYLE.exec(style);
    return match ? match[1].toLowerCase() : false;
}

/** A GFM separator cell for an alignment. */
const separatorCell = align => (align === 'left' ? ':---' : align === 'center' ? ':---:' : align === 'right' ? '---:' : '---');

/**
 * Can this table be written as a GFM table without losing anything? Anything GFM can't
 * express keeps the table as raw HTML instead: merged cells, a header column or a missing
 * header row, resized columns, a non-default table placement, cells of one column aligned
 * differently, a backslash before a pipe (GFM reads the pair as an escaped pipe, also inside
 * code), and cells holding more than one paragraph (or any other block) or a paragraph with its
 * own alignment. Memoized on the node with the column alignments and the header row: the row
 * and cell rules ask about the same table once per cell.
 */
function gfmTableInfo(table) {
    if (table.__inscriptGfm !== undefined) return table.__inscriptGfm;
    const info = (() => {
        const align = table.getAttribute(TABLE_ALIGN_ATTRIBUTE);
        if (align && align !== DEFAULT_TABLE_ALIGN) return null;
        const rows = tableRows(table);
        if (rows.length === 0) return null;
        const width = rows[0].cells.length;
        if (width === 0) return null;
        const columns = new Array(width).fill(undefined);
        const ok = rows.every((row, r) => {
            if (row.cells.length !== width) return false;
            return Array.from(row.cells).every((cell, c) => {
                if (cell.nodeName !== (r === 0 ? 'TH' : 'TD')) return false;
                if ((cell.getAttribute('colspan') || '1') !== '1') return false;
                if ((cell.getAttribute('rowspan') || '1') !== '1') return false;
                if (cell.hasAttribute('colwidth') || cell.hasAttribute('data-colwidth')) return false;
                if (cell.innerHTML.includes('\\|')) return false;
                const cellAlignment = cellAlign(cell);
                if (cellAlignment === false) return false;
                if (columns[c] === undefined) columns[c] = cellAlignment;
                else if (columns[c] !== cellAlignment) return false;
                const blocks = Array.from(cell.children);
                if (blocks.length > 1) return false;
                return blocks.length === 0 || (blocks[0].nodeName === 'P' && !blocks[0].hasAttribute('style'));
            });
        });
        if (!ok) return null;
        return { header: rows[0], columns: columns.map(a => (GFM_ALIGNMENTS.includes(a) ? a : null)) };
    })();
    table.__inscriptGfm = info;
    return info;
}

const isGfmTable = table => gfmTableInfo(table) !== null;

const inGfmTable = node => {
    const table = closestTable(node);
    return !!table && isGfmTable(table);
};

/** One GFM cell: inline content only, pipes escaped, line breaks as <br>. */
function gfmCell(content, node) {
    const text = content
        .replace(/^\n+|\n+$/g, '')
        .replace(/ {2}\n/g, '<br>')
        .replace(/\n+/g, ' ')
        .replace(/\|/g, '\\|')
        .trim();
    const first = node.parentNode.firstElementChild === node;
    return `${first ? '| ' : ' '}${text} |`;
}

// --- Text ------------------------------------------------------------------------------

/**
 * Escapes turndown (7.2) does not make, applied after its own. Each turns text that would be read
 * as syntax into the same text: HTML (`<b>`, `&copy;`), strikethrough (`~`), a heading or list
 * opened by a line that is only `#`, `+` or `1.`, an ordered list with `1)`, a heading's closing
 * `#`s, and a bare URL, which GFM would turn into a link (`https\://`, `www\.`).
 */
const EXTRA_ESCAPES = [
    [/</g, '\\<'],
    [/&(?=#?[a-zA-Z0-9]+;)/g, '\\&'],
    [/~/g, '\\~'],
    [/^(#{1,6})$/, '\\$1'],
    [/(\s)#(#*)$/, '$1\\#$2'],
    [/^\+$/, '\\+'],
    [/^(\d+)\.$/, '$1\\.'],
    [/^(\d+)\)(?=\s|$)/, '$1\\)'],
    [/\b(https?|ftp):\/\//gi, '$1\\://'],
    [/\bwww\./gi, 'www\\.'],
];

function escapeWith(baseEscape) {
    return text => EXTRA_ESCAPES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), baseEscape(String(text)));
}

// --- Empty blocks ------------------------------------------------------------------------

const TURNDOWN_ROOT_ID = 'turndown-root';
const isTopLevel = node => {
    const parent = node.parentNode;
    return !parent || parent.id === TURNDOWN_ROOT_ID || parent.nodeName === 'BODY' || parent.nodeName === 'BLOCKQUOTE';
};

// ----------------------------------------------------------------------------------------

/**
 * Applies custom Turndown rules for inscript-editor specific nodes.
 * This ensures that custom nodes (Mermaid, Math, Admonitions, etc.)
 * are preserved as raw HTML or properly formatted when saving to markdown,
 * preventing data loss during the HTML -> MD -> HTML round-trip.
 *
 * Works with a real TurndownService (with or without turndown-plugin-gfm; apply this after
 * `use(gfm)` so these rules take precedence) and with any duck-typed `{ addRule }` object.
 *
 * @param {TurndownService} turndownService
 */
export function applyInscriptEditorTurndownRules(turndownService) {
    // Turndown decides an element is "blank" (no text, no media) BEFORE it consults any rule,
    // and hands blank elements to its blank rule, which writes nothing. Several editor nodes are
    // empty on purpose (a source comment is an empty span, a gated embed an empty div), so every
    // rule registered here is also offered those blank nodes first (see the end of this function).
    const claimed = [];
    const add = (key, rule) => {
        claimed.push(rule);
        turndownService.addRule(key, rule);
    };

    // Lists, emphasis and line breaks, written so CommonMark reads back what was written (see the
    // helpers above). Registered first, so the editor-specific rules below win where they overlap.
    add('inscriptListItem', {
        filter: node => node.nodeName === 'LI' && node.getAttribute('data-type') !== 'taskItem',
        replacement: (content, node, options) => listItem(content, node, options),
    });
    add('inscriptEmphasis', {
        filter: ['em', 'i'],
        replacement: (content, node, options) => emphasis(content, node, options?.emDelimiter || '_', 'em'),
    });
    add('inscriptStrong', {
        filter: ['strong', 'b'],
        replacement: (content, node, options) => emphasis(content, node, options?.strongDelimiter || '**', 'strong'),
    });
    // Links, as turndown writes them inline (7.2), except that brackets in the link text are
    // references: marked reads escaped brackets there (`\[l\](javascript:…)`) as a nested link.
    add('inscriptLink', {
        filter: (node, options) => node.nodeName === 'A' && !!node.getAttribute('href')
            && !node.hasAttribute('data-wikilink') && (options?.linkStyle ?? 'inlined') === 'inlined',
        replacement: (content, node) => {
            const href = node.getAttribute('href').replace(/([()])/g, '\\$1');
            const rawTitle = node.getAttribute('title');
            const title = rawTitle ? ` "${rawTitle.replace(/(\n+\s*)+/g, '\n').replace(/"/g, '\\"')}"` : '';
            return `[${bracketsAsReferences(content)}](${href}${title})`;
        },
    });
    add('inscriptLineBreak', {
        filter: ['br'],
        replacement: lineBreak,
    });

    // Registered before the node rules, so every more specific rule below (citations and inline
    // math are spans, footnote references are <sup>) wins over these: turndown tries the last rule
    // added first.
    //
    // Highlight, subscript, superscript and underline have no Markdown syntax, and without a rule
    // turndown keeps only their text ("H<sub>2</sub>O" saved as "H2O"). They keep their tag, and a
    // coloured highlight its colour; what is inside still becomes Markdown.
    add('inscriptInlineFormat', {
        filter: KEPT_INLINE_TAGS,
        replacement: keepInlineTag,
    });
    // Text colour and font size are a styled <span>: kept the same way.
    add('inscriptStyledSpan', {
        filter: node => node.nodeName === 'SPAN' && node.hasAttribute('style'),
        replacement: keepInlineTag,
    });
    // A centred, right-aligned or justified paragraph or heading keeps its alignment as HTML;
    // one with the default alignment stays plain Markdown.
    add('inscriptAlignedBlock', {
        filter: node => blockTextAlign(node) !== null,
        replacement: rawBlock,
    });

    // Mermaid diagrams and math blocks: the source from its attribute (turndown has already
    // collapsed the text's line breaks).
    add('inscriptMermaid', {
        filter: node => node.nodeName === 'DIV' && node.classList.contains('mermaid'),
        replacement: (content, node) => htmlBlock(withSourceText(node, 'data-mermaid')),
    });
    add('inscriptMathBlock', {
        filter: node => node.nodeName === 'DIV' && node.classList.contains('math-block'),
        replacement: (content, node) => htmlBlock(withSourceText(node, 'data-math')),
    });

    // Source comments: written back as a real Markdown/HTML comment, encoded so nothing in it can
    // close it early or break out of its line (read back by HtmlComment); one standing alone on its
    // lines keeps its line breaks. A comment that opens a line
    // with more after it would start an HTML block, which swallows the rest of the line as raw
    // HTML: it is wrapped in an empty span, which keeps the line a paragraph.
    add('inscriptHtmlComment', {
        filter: node => (node.nodeName === 'SPAN' || node.nodeName === 'DIV') && node.hasAttribute('data-html-comment'),
        replacement: (content, node) => {
            const opensLine = startsLine(node);
            const followed = hasFollowingContent(node);
            const alone = opensLine && !followed && !insideTableCell(node);
            const comment = `<!--${encodeCommentText(node.getAttribute('data-html-comment') || '', { keepLineBreaks: alone })}-->`;
            return opensLine && followed ? `<span>${comment}</span>` : comment;
        },
    });

    add('inscriptMathInline', {
        filter: node => node.nodeName === 'SPAN' && node.classList.contains('math-inline'),
        replacement: (content, node) => serializeHtml(withSourceText(node, 'data-math'), true),
    });

    add('inscriptAdmonition', {
        filter: node => node.nodeName === 'DIV' && node.classList.contains('admonition'),
        replacement: rawBlock,
    });

    add('inscriptDefinitionList', {
        filter: ['dl'],
        replacement: rawBlock,
    });

    // Abbreviations and wikilinks: their text is data, never Markdown.
    add('inscriptAbbreviation', {
        filter: ['abbr'],
        replacement: literalInline,
    });
    add('inscriptWikilink', {
        filter: node => node.nodeName === 'A' && node.hasAttribute('data-wikilink'),
        replacement: literalInline,
    });

    // Footnotes: the editor writes an empty `sup[data-footnote-ref]` and a `section[data-footnotes]`
    // (older shapes, an anchor inside the sup and a footnotes div, are kept too).
    add('inscriptFootnotesSection', {
        filter: node => (node.nodeName === 'SECTION' && node.hasAttribute('data-footnotes'))
            || (node.nodeName === 'DIV' && node.getAttribute('data-type') === 'footnotes'),
        replacement: rawBlock,
    });
    add('inscriptFootnoteRef', {
        filter: node => node.nodeName === 'SUP'
            && (node.hasAttribute('data-footnote-ref') || !!node.querySelector('a[data-footnote-ref]')),
        replacement: literalInline,
    });

    // Citations keep their key, label and bibliography details (otherwise they became the
    // escaped text `\[label\]`). They parse back via `span.citation`.
    add('inscriptCitation', {
        filter: node => node.nodeName === 'SPAN' && node.classList.contains('citation'),
        replacement: literalInline,
    });

    // Generic embeds always serialize to the gated, empty `div[data-embed-src][data-embed-gated]`
    // (raw third-party iframes are never re-emitted). Kept as that div, it parses back as an embed.
    add('inscriptEmbed', {
        filter: node => node.nodeName === 'DIV' && node.hasAttribute('data-embed-src'),
        replacement: rawBlock,
    });

    // YouTube videos keep their wrapper (id, width, alignment, caption). A host with its own
    // syntax (a shortcode, say) registers its rule after this one, and that rule wins.
    add('inscriptYoutube', {
        filter: node => node.nodeName === 'DIV' && node.hasAttribute('data-youtube-video'),
        replacement: rawBlock,
    });

    // Images resized or aligned in the editor keep that layout as raw HTML; a plain image
    // (full width, centered) stays a Markdown image.
    add('inscriptLayoutImage', {
        filter: node => {
            if (node.nodeName !== 'IMG') return false;
            const width = node.getAttribute('data-width');
            const align = node.getAttribute('data-align');
            return (!!width && width !== '100%') || (!!align && align !== 'center');
        },
        replacement: literalInline,
    });

    // Checklists as GFM task items (`- [x] Done`). The editor wraps the checkbox in a <label>,
    // where turndown-plugin-gfm's own task rule (checkbox directly inside the LI) never matches,
    // so the checked state was lost. The label is dropped and the marker written by the item.
    add('inscriptTaskCheckbox', {
        filter: node => node.nodeName === 'LABEL'
            && node.parentNode?.nodeName === 'LI'
            && node.parentNode.getAttribute('data-type') === 'taskItem',
        replacement: () => '',
    });
    add('inscriptTaskItem', {
        filter: node => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem',
        replacement: (content, node, options) => listItem(content, node, options, node.getAttribute('data-checked') === 'true' ? '[x]' : '[ ]'),
    });

    // Tables. The editor's tables always carry a <colgroup> (which made turndown-plugin-gfm keep
    // every one as raw HTML) and a <p> in every cell (which broke the rows when it didn't). A
    // table GFM can express becomes a GFM table; any other keeps its HTML (see gfmTableInfo).
    add('inscriptTableColgroup', {
        filter: ['colgroup'],
        replacement: () => '',
    });
    add('inscriptTableCell', {
        filter: node => (node.nodeName === 'TH' || node.nodeName === 'TD') && inGfmTable(node),
        replacement: gfmCell,
    });
    add('inscriptTableRow', {
        filter: node => node.nodeName === 'TR' && inGfmTable(node),
        replacement: (content, node) => {
            const info = gfmTableInfo(closestTable(node));
            if (info.header !== node) return `\n${content}`;
            const separator = info.columns.map((align, i) => `${i === 0 ? '| ' : ' '}${separatorCell(align)} |`).join('');
            return `\n${content}\n${separator}`;
        },
    });
    add('inscriptTableSection', {
        filter: node => ['THEAD', 'TBODY', 'TFOOT'].includes(node.nodeName) && inGfmTable(node),
        replacement: content => content,
    });
    add('inscriptTable', {
        filter: ['table'],
        replacement: (content, node) => (isGfmTable(node)
            ? `\n\n${content.replace(/^\n+|\n+$/g, '')}\n\n`
            : htmlBlock(node)),
    });

    // Text: the escapes turndown leaves out (see EXTRA_ESCAPES). Only a real TurndownService
    // has an escape to extend.
    if (typeof turndownService.escape === 'function') {
        turndownService.escape = escapeWith(turndownService.escape.bind(turndownService));
    }

    // Blank nodes. Turndown copies options.blankReplacement into its rule set when the service is
    // constructed, so the live hook is rules.blankRule; a duck-typed `{ addRule }` object has
    // neither, and is left alone. In order:
    // - a node one of these rules claims gets that rule (the last added wins, as in turndown);
    // - a container that only holds blank nodes (a paragraph holding just a comment, a blockquote
    //   holding just an embed) gets the rule it would have had, around what those nodes wrote;
    // - an empty code block, heading or list item is still written (Markdown has them), and an
    //   empty paragraph between other blocks is kept as `<p></p>`;
    // - anything else is turndown's own blank handling.
    const rules = turndownService.rules;
    const blankRule = rules?.blankRule;
    if (blankRule && typeof blankRule.replacement === 'function') {
        const fallback = blankRule.replacement;
        const ruleFor = (node, options) => (rules.array || []).find(r => r !== blankRule && ruleMatches(r, node, options)) || rules.defaultRule;
        blankRule.replacement = function inscriptBlankReplacement(content, node, options) {
            const claim = [...claimed].reverse().find(r => ruleMatches(r, node, options));
            if (claim) return claim.replacement(content, node, options);
            if (content.trim() || node.nodeName === 'PRE' || HEADING_PATTERN.test(node.nodeName)) {
                const rule = ruleFor(node, options);
                if (rule) return rule.replacement(content, node, options);
            }
            if (node.nodeName === 'P' && isTopLevel(node) && nextMeaningfulSibling(node)) return '\n\n<p></p>\n\n';
            return fallback.call(this, content, node, options);
        };
        if (turndownService.options) turndownService.options.blankReplacement = blankRule.replacement;
    }
}
