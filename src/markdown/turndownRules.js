/**
 * Applies custom Turndown rules for inscript-editor specific nodes.
 * This ensures that custom nodes (Mermaid, Math, Admonitions, etc.)
 * are preserved as raw HTML or properly formatted when saving to markdown,
 * preventing data loss during the HTML -> MD -> HTML round-trip.
 *
 * @param {TurndownService} turndownService
 */
export function applyInscriptEditorTurndownRules(turndownService) {
    // Preserve Mermaid
    turndownService.addRule('inscriptMermaid', {
        filter: node => node.nodeName === 'DIV' && node.classList.contains('mermaid'),
        replacement: (content, node) => `\n\n${node.outerHTML}\n\n`
    });

    // Preserve Math Block
    turndownService.addRule('inscriptMathBlock', {
        filter: node => node.nodeName === 'DIV' && node.classList.contains('math-block'),
        replacement: (content, node) => `\n\n${node.outerHTML}\n\n`
    });

    // Source comments: write the hidden note back as a real Markdown/HTML comment. The text comes from
    // an attribute, so neutralize anything that would close the comment early (mirrors officeParser).
    turndownService.addRule('inscriptHtmlComment', {
        filter: node => node.nodeName === 'SPAN' && node.hasAttribute('data-html-comment'),
        replacement: (content, node) => {
            let text = node.getAttribute('data-html-comment') || '';
            text = text.replace(/--!?>/g, m => `${m.slice(0, -1)}&gt;`);
            if (text.startsWith('>')) text = `&gt;${text.slice(1)}`;
            else if (text.startsWith('->')) text = `-&gt;${text.slice(2)}`;
            return `<!--${text}-->`;
        }
    });

    // Preserve Math Inline
    turndownService.addRule('inscriptMathInline', {
        filter: node => node.nodeName === 'SPAN' && node.classList.contains('math-inline'),
        replacement: (content, node) => node.outerHTML
    });

    // Preserve Admonitions
    turndownService.addRule('inscriptAdmonition', {
        filter: node => node.nodeName === 'DIV' && node.classList.contains('admonition'),
        replacement: (content, node) => `\n\n${node.outerHTML}\n\n`
    });

    // Preserve Definition Lists
    turndownService.addRule('inscriptDefinitionList', {
        filter: ['dl'],
        replacement: (content, node) => `\n\n${node.outerHTML}\n\n`
    });

    // Preserve Abbreviations
    turndownService.addRule('inscriptAbbreviation', {
        filter: ['abbr'],
        replacement: (content, node) => node.outerHTML
    });

    // Preserve Wikilinks
    turndownService.addRule('inscriptWikilink', {
        filter: node => node.nodeName === 'A' && node.hasAttribute('data-wikilink'),
        replacement: (content, node) => node.outerHTML
    });

    // Preserve Footnotes section
    turndownService.addRule('inscriptFootnotesSection', {
        filter: node => node.nodeName === 'DIV' && node.getAttribute('data-type') === 'footnotes',
        replacement: (content, node) => `\n\n${node.outerHTML}\n\n`
    });

    // Preserve Footnote references
    turndownService.addRule('inscriptFootnoteRef', {
        filter: node => node.nodeName === 'SUP' && node.querySelector('a[data-footnote-ref]'),
        replacement: (content, node) => node.outerHTML
    });
}
