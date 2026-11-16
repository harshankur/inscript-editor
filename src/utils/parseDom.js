// The DOM the editor's parser reads, made to fit the editor's schema first. HTML from a Markdown
// renderer (marked, markdown-it) is shaped for a page, not for this schema, and ProseMirror's parser
// does not reshape it: a real comment node is invisible to it, an image (a block here) wrapped in a
// paragraph leaves an empty paragraph behind, and a list item that opens with an image, a code block,
// a quote or a disclosure has that block moved out of the list (an item must open with a paragraph). The caller's
// DOM is never changed: a copy is made when anything needs reshaping.
import { decodeCommentText } from './commentText.js';
import { DETAILS_NODE, NODE } from '../constants.js';
import { COLSPAN_LIMIT, ROWSPAN_LIMIT, TABLE_GROWTH_LIMIT, rowsExcess } from './tableSize.js';
import { childrenMoved, htmlInteger } from './dom.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const SHOW_COMMENT = 128;
/**
 * Blocks that cannot open a list item (its first child must be a paragraph), with the node each is
 * read as. A feature turned off (no such node) reads its tag as a mere wrapper of its text, which
 * opens no block: such a list item needs nothing added. Wrappers (div, figure, section) always count.
 */
const NON_PARAGRAPH_BLOCKS = {
    IMG: NODE.IMAGE, PRE: NODE.CODE_BLOCK, BLOCKQUOTE: NODE.BLOCKQUOTE, TABLE: NODE.TABLE, DIV: null,
    UL: NODE.BULLET_LIST, OL: NODE.ORDERED_LIST, H1: NODE.HEADING, H2: NODE.HEADING, H3: NODE.HEADING,
    H4: NODE.HEADING, H5: NODE.HEADING, H6: NODE.HEADING, HR: NODE.HORIZONTAL_RULE,
    DL: NODE.DEFINITION_LIST, FIGURE: null, SECTION: null, DETAILS: DETAILS_NODE,
};
const ALL_BLOCKS = new Set(Object.keys(NON_PARAGRAPH_BLOCKS));
const blocksBySchema = new WeakMap();
/** The blocks that cannot open a list item in this schema (all of them when it is not known). */
function blocksFor(schema) {
    if (!schema?.nodes) return ALL_BLOCKS;
    if (!blocksBySchema.has(schema)) {
        blocksBySchema.set(schema, new Set(Object.entries(NON_PARAGRAPH_BLOCKS).filter(([, node]) => node === null || schema.nodes[node]).map(([tag]) => tag)));
    }
    return blocksBySchema.get(schema);
}

const isBlankText = node => node.nodeType === TEXT_NODE && !node.nodeValue.trim();
const meaningfulChildren = el => Array.from(el.childNodes).filter(child => !isBlankText(child));

/** A paragraph that holds nothing but one image (how a renderer wraps `![alt](src)`). */
const isLoneImageParagraph = el => {
    if (el.nodeName !== 'P') return false;
    const children = meaningfulChildren(el);
    return children.length === 1 && children[0].nodeName === 'IMG';
};

/** A plain list item whose first child is a block that is not a paragraph. */
const opensWithBlock = (el, blocks) => {
    if (el.nodeName !== 'LI' || el.hasAttribute('data-type')) return false;
    const first = meaningfulChildren(el)[0];
    return !!first && first.nodeType === ELEMENT_NODE && blocks.has(first.nodeName);
};

// Tables are made rectangular (every row padded to the widest, spans and spans carried down from
// rows above counted). The cells that adds beyond those a table really has (its excess) are bounded,
// all tables of a parse together: past it, the tables of most excess are read as their cells'
// contents, so a few bytes of HTML (a huge colspan, one long row over many short ones, stacked
// rowspans, many tables) cannot make millions of cells and stop the page. A table rectangular
// already, however large, is read as it is.

/**
 * A cell's colspan or rowspan as a browser reads it (leading digits only: `1e5` is 1, `0x10` is 1),
 * at least 1 and at most `limit`. The editor's cells read theirs the same way.
 * @param {string | null | undefined} value
 * @param {number} limit
 */
export function htmlSpan(value, limit) {
    // Digits past what a number holds (Infinity) are as many as can be: the limit, as a browser reads them.
    const span = htmlInteger(value)?.value ?? 1;
    return span >= 1 ? Math.min(span, limit) : 1;
}

/** A table's own rows (not a nested table's). */
const rowsOf = table => Array.from(table.rows ?? []);

/**
 * A table's row groups (its head, bodies and foot, in that order, and rows outside any), each as its
 * rows: a browser ends a rowspan with its group.
 */
function rowGroupsOf(table) {
    const groups = [];
    for (const child of Array.from(table.children ?? [])) {
        if (child.nodeName === 'TR') {
            const last = groups[groups.length - 1];
            if (last?.loose) last.rows.push(child);
            else groups.push({ loose: true, rows: [child] });
        } else if (['THEAD', 'TBODY', 'TFOOT'].includes(child.nodeName)) {
            groups.push({ loose: false, rows: Array.from(child.rows ?? []) });
        }
    }
    return groups.map(group => group.rows);
}

/**
 * A table's excess: the cells it comes to once made rectangular (its widest row, spans and spans from
 * above counted, times its rows) beyond the cells it really has. A table rectangular already has
 * none, however large; a crafted one (a huge span, one long row over many short ones) a great deal.
 */
function tableExcess(table) {
    return rowsExcess(rowsOf(table).map(row => Array.from(row.cells ?? []).map(cell => ({
        colspan: htmlSpan(cell.getAttribute('colspan'), COLSPAN_LIMIT),
        rowspan: htmlSpan(cell.getAttribute('rowspan'), ROWSPAN_LIMIT),
    }))));
}

/** A rowspan of 0, which a browser reads as reaching the last row. */
const reachesLastRow = cell => /^[\t\n\f\r ]*\+?0+(?:\D|$)/.test(cell.getAttribute('rowspan') ?? '');

/** Whether a cell's rowspan is 0 or reaches past the `rowsLeft` rows from its own on. */
const overlongRowspan = (cell, rowsLeft) => reachesLastRow(cell) || htmlSpan(cell.getAttribute('rowspan'), ROWSPAN_LIMIT) > rowsLeft;


/** Whether a table has a rowspan past its row group's last row. */
const hasOverlongRowspan = table => rowGroupsOf(table).some(rows => rows.some((row, index) => Array.from(row.cells ?? []).some(cell => overlongRowspan(cell, rows.length - index))));

/**
 * Every rowspan cut to the rows left in its row group (one of 0 reaching to the group's last row), as a
 * browser reads it: the editor's table has one group, where a head cell's span would reach into the body.
 */
function clampRowspans(table) {
    for (const rows of rowGroupsOf(table)) {
        rows.forEach((row, index) => {
            for (const cell of Array.from(row.cells ?? [])) {
                if (overlongRowspan(cell, rows.length - index)) cell.setAttribute('rowspan', String(rows.length - index));
            }
        });
    }
}

/** A cell whose span a browser reads otherwise than it is written, or past the limits. */
const hasOddSpan = cell => ['colspan', 'rowspan'].some(name => {
    const value = cell.getAttribute(name);
    if (value === null) return false;
    const read = htmlSpan(value, name === 'colspan' ? COLSPAN_LIMIT : ROWSPAN_LIMIT);
    return String(read) !== value.trim();
});

function needsWork(dom, doc, blocks) {
    if (typeof dom.querySelectorAll !== 'function') return false;
    const walker = doc.createTreeWalker(dom, SHOW_COMMENT);
    if (walker.nextNode()) return true;
    // A table is copied only when something in it needs changing (its spans, or its size).
    const tables = Array.from(dom.querySelectorAll('table'));
    if (tables.length) {
        if (tables.some(hasOverlongRowspan) || Array.from(dom.querySelectorAll('td, th')).some(hasOddSpan)) return true;
        if (tables.reduce((sum, table) => sum + tableExcess(table), 0) > TABLE_GROWTH_LIMIT) return true;
    }
    return Array.from(dom.querySelectorAll('p, li')).some(el => isLoneImageParagraph(el) || opensWithBlock(el, blocks));
}

/** A table too large to make rectangular, read as its caption's and cells' contents in order (nothing lost). */
function unpackTable(table, doc) {
    // Gathered in a fragment, one at a time: a table may hold more cells than a call takes arguments.
    const parts = doc.createDocumentFragment();
    const holders = [table.caption, ...Array.from(table.rows ?? []).flatMap(row => Array.from(row.cells ?? []))];
    for (const holder of holders) {
        if (!holder) continue;
        const part = doc.createElement('div');
        part.appendChild(childrenMoved(holder));
        parts.appendChild(part);
    }
    table.replaceWith(parts);
}

/**
 * `dom` reshaped for the schema (see the top of this file), or `dom` itself when it already fits.
 * @param {Node} dom
 * @param {import('@tiptap/pm/model').Schema} [schema] - The schema it is read into (which blocks it has).
 */
export function normalizeForParse(dom, schema) {
    const doc = dom?.ownerDocument;
    const blocks = blocksFor(schema);
    if (!doc || typeof doc.createTreeWalker !== 'function' || !needsWork(dom, doc, blocks)) return dom;
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

    // A rowspan past its table's last row reaches no row (and makes the table plugin add rows for it).
    for (const table of Array.from(copy.querySelectorAll('table'))) clampRowspans(table);
    // Spans written as a browser reads them (and within the limits), then the largest tables unpacked
    // until all of them together fit.
    for (const cell of Array.from(copy.querySelectorAll('td, th')).filter(hasOddSpan)) {
        for (const [name, limit] of [['colspan', COLSPAN_LIMIT], ['rowspan', ROWSPAN_LIMIT]]) {
            if (cell.hasAttribute(name)) cell.setAttribute(name, String(htmlSpan(cell.getAttribute(name), limit)));
        }
    }
    const tables = Array.from(copy.querySelectorAll('table')).map(table => ({ table, cells: tableExcess(table) }));
    let total = tables.reduce((sum, { cells }) => sum + cells, 0);
    for (const { table, cells } of tables.sort((a, b) => b.cells - a.cells)) {
        if (total <= TABLE_GROWTH_LIMIT) break;
        if (!copy.contains(table)) continue;
        unpackTable(table, doc);
        total -= cells;
    }

    for (const paragraph of Array.from(copy.querySelectorAll('p')).filter(isLoneImageParagraph)) {
        paragraph.replaceWith(meaningfulChildren(paragraph)[0]);
    }
    for (const item of Array.from(copy.querySelectorAll('li')).filter(item => opensWithBlock(item, blocks))) {
        item.insertBefore(doc.createElement('p'), item.firstChild);
    }
    return copy;
}
