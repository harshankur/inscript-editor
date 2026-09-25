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

const raw = (content, node) => node.outerHTML;
const rawBlock = (content, node) => `\n\n${node.outerHTML}\n\n`;

// --- Tables ----------------------------------------------------------------------------

const closestTable = node => {
    let el = node.parentNode;
    while (el && el.nodeName !== 'TABLE') el = el.parentNode;
    return el;
};

const tableRows = table => Array.from(table.rows || []);

/**
 * Can this table be written as a GFM table without losing anything? Anything GFM can't
 * express keeps the table as raw HTML instead: merged cells, a header column or a missing
 * header row, resized columns, a non-default alignment, and cells holding more than one
 * paragraph (or any other block) or a paragraph with its own alignment.
 */
function isGfmTable(table) {
    if (table.__inscriptGfm !== undefined) return table.__inscriptGfm;
    const verdict = (() => {
        const align = table.getAttribute('data-align');
        if (align && align !== 'center') return false;
        const rows = tableRows(table);
        if (rows.length === 0) return false;
        const width = rows[0].cells.length;
        if (width === 0) return false;
        return rows.every((row, r) => {
            if (row.cells.length !== width) return false;
            return Array.from(row.cells).every(cell => {
                if (cell.nodeName !== (r === 0 ? 'TH' : 'TD')) return false;
                if ((cell.getAttribute('colspan') || '1') !== '1') return false;
                if ((cell.getAttribute('rowspan') || '1') !== '1') return false;
                if (cell.hasAttribute('colwidth') || cell.hasAttribute('data-colwidth')) return false;
                const blocks = Array.from(cell.children);
                if (blocks.length > 1) return false;
                return blocks.length === 0 || (blocks[0].nodeName === 'P' && !blocks[0].hasAttribute('style'));
            });
        });
    })();
    // Memoized on the node: the row and cell rules ask about the same table once per cell.
    table.__inscriptGfm = verdict;
    return verdict;
}

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

    // Preserve Mermaid
    add('inscriptMermaid', {
        filter: node => node.nodeName === 'DIV' && node.classList.contains('mermaid'),
        replacement: rawBlock,
    });

    // Preserve Math Block
    add('inscriptMathBlock', {
        filter: node => node.nodeName === 'DIV' && node.classList.contains('math-block'),
        replacement: rawBlock,
    });

    // Source comments: write the hidden note back as a real Markdown/HTML comment. The text comes from
    // an attribute, so neutralize anything that would close the comment early (mirrors officeParser).
    add('inscriptHtmlComment', {
        filter: node => (node.nodeName === 'SPAN' || node.nodeName === 'DIV') && node.hasAttribute('data-html-comment'),
        replacement: (content, node) => {
            let text = node.getAttribute('data-html-comment') || '';
            text = text.replace(/--!?>/g, m => `${m.slice(0, -1)}&gt;`);
            if (text.startsWith('>')) text = `&gt;${text.slice(1)}`;
            else if (text.startsWith('->')) text = `-&gt;${text.slice(2)}`;
            return `<!--${text}-->`;
        }
    });

    // Preserve Math Inline
    add('inscriptMathInline', {
        filter: node => node.nodeName === 'SPAN' && node.classList.contains('math-inline'),
        replacement: raw,
    });

    // Preserve Admonitions
    add('inscriptAdmonition', {
        filter: node => node.nodeName === 'DIV' && node.classList.contains('admonition'),
        replacement: rawBlock,
    });

    // Preserve Definition Lists
    add('inscriptDefinitionList', {
        filter: ['dl'],
        replacement: rawBlock,
    });

    // Preserve Abbreviations
    add('inscriptAbbreviation', {
        filter: ['abbr'],
        replacement: raw,
    });

    // Preserve Wikilinks
    add('inscriptWikilink', {
        filter: node => node.nodeName === 'A' && node.hasAttribute('data-wikilink'),
        replacement: raw,
    });

    // Preserve Footnotes section
    add('inscriptFootnotesSection', {
        filter: node => node.nodeName === 'DIV' && node.getAttribute('data-type') === 'footnotes',
        replacement: rawBlock,
    });

    // Preserve Footnote references
    add('inscriptFootnoteRef', {
        filter: node => node.nodeName === 'SUP' && !!node.querySelector('a[data-footnote-ref]'),
        replacement: raw,
    });

    // Citations keep their key, label and bibliography details (otherwise they became the
    // escaped text `\[label\]`). They parse back via `span.citation`.
    add('inscriptCitation', {
        filter: node => node.nodeName === 'SPAN' && node.classList.contains('citation'),
        replacement: raw,
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
        replacement: raw,
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
        // Mirrors turndown's own listItem replacement (7.2), so a checklist is laid out exactly
        // like the service's other lists, with the task marker after the bullet.
        replacement: (content, node, options) => {
            const prefix = `${options?.bulletListMarker || '*'}   `;
            const marker = node.getAttribute('data-checked') === 'true' ? '[x]' : '[ ]';
            const isParagraph = /\n$/.test(content);
            content = content.replace(/^\n+|\n+$/g, '') + (isParagraph ? '\n' : '');
            content = content.replace(/\n/gm, `\n${' '.repeat(prefix.length)}`);
            return `${prefix}${marker} ${content}${node.nextSibling ? '\n' : ''}`;
        },
    });

    // Tables. The editor's tables always carry a <colgroup> (which made turndown-plugin-gfm keep
    // every one as raw HTML) and a <p> in every cell (which broke the rows when it didn't). A
    // table GFM can express becomes a GFM table; any other keeps its HTML (see isGfmTable).
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
            const table = closestTable(node);
            if (tableRows(table)[0] !== node) return `\n${content}`;
            const separator = Array.from(node.cells).map((cell, i) => `${i === 0 ? '| ' : ' '}--- |`).join('');
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
            : `\n\n${node.outerHTML}\n\n`),
    });

    // Route blank nodes to the rule that claims them. Turndown copies options.blankReplacement
    // into its rule set when the service is constructed, so the live hook is rules.blankRule;
    // a duck-typed `{ addRule }` object has neither, and is left alone.
    const blankRule = turndownService.rules?.blankRule;
    if (blankRule && typeof blankRule.replacement === 'function') {
        const fallback = blankRule.replacement;
        blankRule.replacement = function inscriptBlankReplacement(content, node, options) {
            const rule = claimed.find(r => ruleMatches(r, node, options));
            return rule ? rule.replacement(content, node, options) : fallback.call(this, content, node, options);
        };
        if (turndownService.options) turndownService.options.blankReplacement = blankRule.replacement;
    }
}
