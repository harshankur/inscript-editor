// Editor HTML -> Markdown (turndown + gfm + these rules) -> HTML (marked) -> editor: what was saved
// loads back as the same document, and no text in the document turns into live markup on the way.
import { afterAll, describe, expect, it } from 'vitest';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { marked } from 'marked';
import { applyInscriptEditorTurndownRules } from './turndownRules.js';
import { createEditor } from '../../tests/helpers/createEditor.js';

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
turndown.use(gfm);
applyInscriptEditorTurndownRules(turndown);

const editor = createEditor({}, { wikilink: { enabled: true } });
afterAll(() => editor.destroy());

const load = html => { editor.commands.setContent(html, { emitUpdate: false }); return editor; };
const normalize = html => load(html).getHTML();
const toMarkdown = html => turndown.turndown(html);
const fromMarkdown = md => marked.parse(md, { async: false });

/** Save `html` (as the editor writes it) and load it back. */
function roundTrip(html) {
    const before = normalize(html);
    const md = toMarkdown(before);
    const after = normalize(fromMarkdown(md));
    return { before, md, after, json: load(after).getJSON() };
}

const types = json => (json.content || []).map(node => node.type);
const findAll = (node, type, out = []) => {
    if (node.type === type) out.push(node);
    for (const child of node.content || []) findAll(child, type, out);
    return out;
};

// An inert probe: an element or a script URL in the rendered Markdown means document text leaked.
const PROBE = '<b data-probe="md">probe</b>';
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function leaks(md) {
    const t = document.createElement('template');
    t.innerHTML = fromMarkdown(md);
    const found = [];
    if (t.content.querySelector('[data-probe]')) found.push('probe element');
    for (const el of t.content.querySelectorAll('[href], [src]')) {
        const url = (el.getAttribute('href') ?? el.getAttribute('src')).replace(/[\u0000- ]/g, '');
        if (/^(javascript|vbscript):/i.test(url)) found.push(`${el.localName} script URL`);
    }
    return found;
}

describe('Markdown round trip: nodes come back as they were', () => {
    it.each([
        ['footnotes', '<p>Claim<sup data-footnote-ref="fn-1"></sup> more.</p><section data-footnotes="true"><div data-footnote-id="fn-1"><p>The note.</p></div></section>'],
        ['a multi-line Mermaid diagram', '<div class="mermaid" data-mermaid="flowchart TD\n    A[Start] --> B{Ok?}\n    B -->|yes| C[Done]"></div>'],
        ['a math block with a LaTeX comment line', '<div class="math-block" data-math="a + b % note\n+ c"></div>'],
        ['inline math with backslashes and Markdown characters', '<p>x <span class="math-inline" data-math="\\{x \\mid x > 0\\} a\\,b \\\\ c x\\_1 a*b*c `q`"></span> y</p>'],
        ['an abbreviation whose text has Markdown characters', '<p><abbr title="t">A\\_B*c*</abbr></p>'],
        ['a wikilink whose target has Markdown characters', '<p><a data-wikilink="" data-target="C *draft*">C *draft*</a></p>'],
        ['a comment alone in its paragraph', '<p><span data-html-comment=" keep me "></span></p><p>Text.</p>'],
        ['a comment alone in a list item', '<ul><li><p><span data-html-comment=" c "></span></p></li><li><p>b</p></li></ul>'],
        ['a comment at the start of a formatted line', '<p><span data-html-comment=" c "></span><strong>bold</strong> and <a href="https://e.com/">link</a></p>'],
        ['a comment after a hard break', '<p>first<br><span data-html-comment=" c "></span><em>second</em></p>'],
        ['comment text with a closing sequence and line breaks', '<p>a <span data-html-comment=" x --> y\n\nz "></span>b</p>'],
        ['an embed alone in a blockquote', '<blockquote><div data-embed-src="https://example.com/e" data-embed-gated="true"></div></blockquote>'],
        ['a checklist ending in an empty item', '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Book flights</p></li><li data-type="taskItem" data-checked="false"><p></p></li></ul>'],
        ['GFM column alignment', '<table><tbody><tr><th style="text-align: left"><p>L</p></th><th style="text-align: center"><p>C</p></th><th style="text-align: right"><p>R</p></th></tr><tr><td style="text-align: left"><p>1</p></td><td style="text-align: center"><p>2</p></td><td style="text-align: right"><p>3</p></td></tr></tbody></table>'],
        ['a backslash before a pipe in a table cell', '<table><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td><p><code>a\\|b</code></p></td><td><p>second</p></td></tr></tbody></table>'],
        ['italics inside a word', '<p>un<em>believ</em>able</p>'],
        ['bold around inline HTML after a letter', '<p>H<strong><sub>2</sub></strong>O</p>'],
        ['literal tildes', '<p>~5~ and ~~x~~</p>'],
        ['a paragraph that is only "#"', '<p>#</p>'],
        ['a paragraph that is only "1."', '<p>1.</p>'],
        ['a paragraph that is only "+"', '<p>+</p>'],
        ['a paragraph starting "1) "', '<p>1) item</p>'],
        ['a heading ending in " #"', '<h2>Issue #</h2>'],
        ['a hard break in a heading', '<h3>first<br>second</h3>'],
        ['two hard breaks in a row', '<p>a<br><br>b</p>'],
        ['a trailing hard break', '<p>end<br></p>'],
        ['two adjacent bullet lists', '<ul><li><p>a</p></li></ul><ul><li><p>b</p></li></ul>'],
        ['two adjacent ordered lists', '<ol><li><p>a</p></li></ol><ol><li><p>b</p></li></ol>'],
        ['two adjacent checklists', '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>a</p></li></ul><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>b</p></li></ul>'],
        ['empty paragraphs used as spacing', '<p>a</p><p></p><p></p><p>b</p>'],
        ['an ordered list whose first item is empty', '<ol><li><p></p></li><li><p>second</p></li></ol>'],
        ['an empty heading', '<p>a</p><h2></h2><p>b</p>'],
        ['an empty code block', '<p>a</p><pre><code></code></pre><p>b</p>'],
        ['a code block', '<pre><code class="language-js">const x = 1;\nconsole.log(x);</code></pre>'],
        ['text that looks like HTML or an entity', '<p>&lt;b&gt;bold&lt;/b&gt; &amp;copy; &lt;!-- x --&gt; &lt;https://example.com&gt;</p>'],
        ['a link around inline code', '<p><a href="https://www.npmjs.com/"><code>npm</code></a></p>'],
        ['bold inline code', '<p><strong><code>x</code></strong></p>'],
    ])('%s', (label, html) => {
        const { before, after } = roundTrip(html);
        expect(after).toBe(before);
    });

    it('a plain-text URL with an underscore comes back without backslashes', () => {
        const { json } = roundTrip('<p>see http://example.com/a_b_c now</p>');
        const text = findAll(json, 'text').map(n => n.text).join('');
        expect(text).toBe('see http://example.com/a_b_c now');
    });
});

describe('Markdown written by the rules', () => {
    it('writes the column alignment in the separator row', () => {
        const md = toMarkdown(normalize('<table><tbody><tr><th style="text-align: left"><p>L</p></th><th style="text-align: center"><p>C</p></th><th style="text-align: right"><p>R</p></th><th><p>N</p></th></tr><tr><td style="text-align: left"><p>1</p></td><td style="text-align: center"><p>2</p></td><td style="text-align: right"><p>3</p></td><td><p>4</p></td></tr></tbody></table>'));
        expect(md).toContain('| :--- | :---: | ---: | --- |');
    });

    it('keeps a table whose column mixes alignments as HTML', () => {
        const md = toMarkdown(normalize('<table><tbody><tr><th style="text-align: left"><p>L</p></th></tr><tr><td style="text-align: right"><p>1</p></td></tr></tbody></table>'));
        expect(md.startsWith('<table')).toBe(true);
    });

    it('writes kept HTML blocks on one line', () => {
        const md = toMarkdown(normalize('<div class="admonition" data-type="note"><p>first</p><pre><code>a\n\nb</code></pre></div>'));
        expect(md.split('\n')).toHaveLength(1);
        expect(md).toContain('a&#10;&#10;b');
    });

    it('wraps a comment that opens a line with more after it in an empty span', () => {
        expect(toMarkdown('<p><span data-html-comment=" c "></span><strong>bold</strong></p>')).toBe('<span><!-- c --></span>**bold**');
        expect(toMarkdown('<p>a <span data-html-comment=" c "></span> b</p>')).not.toContain('<span>');
    });

    it('writes an empty task item at the end so it loads back as a task', () => {
        const { json } = roundTrip('<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>a</p></li><li data-type="taskItem" data-checked="true"><p></p></li></ul>');
        expect(findAll(json, 'taskItem').map(n => n.attrs.checked)).toEqual([false, true]);
    });

    it('uses the alternate marker for every other adjacent list', () => {
        expect(toMarkdown('<ul><li>a</li></ul><ul><li>b</li></ul><ul><li>c</li></ul>')).toBe('*   a\n\n-   b\n\n*   c');
        expect(toMarkdown('<ol><li>a</li></ol><ol><li>b</li></ol>')).toBe('1.  a\n\n1)  b');
    });

    it('drops the trailing empty paragraph the editor keeps after a closing block', () => {
        expect(toMarkdown('<ul><li><p>a</p></li></ul><p></p>')).toBe('*   a');
    });

    it('writes brackets in link text as references (marked would read escaped ones as a link)', () => {
        const md = toMarkdown('<p><a href="https://example.com/">[x](javascript:void(0))</a></p>');
        expect(md).toBe('[&#91;x&#93;(javascript:void(0))](https://example.com/)');
    });

    it('leaves brackets in a code span inside link text alone', () => {
        expect(toMarkdown('<p><a href="https://example.com/"><code>a[0]</code></a></p>')).toBe('[`a[0]`](https://example.com/)');
    });
});

describe('Markdown round trip keeps document text as text', () => {
    const SHAPES = {
        paragraph: s => `<p>${esc(s)}</p>`,
        mathInline: s => `<p>a <span class="math-inline" data-math="">${esc(s)}</span> b</p>`,
        mathBlock: s => `<div class="math-block" data-math="">${esc(s)}</div>`,
        mermaid: s => `<div class="mermaid">${esc(s)}</div>`,
        citation: s => `<p><span class="citation" data-key="${esc(s)}" data-label="${esc(s)}" title="${esc(s)}">x</span></p>`,
        abbreviation: s => `<p><abbr title="${esc(s)}">${esc(s)}</abbr></p>`,
        comment: s => `<p>a <span data-html-comment="${esc(s)}"></span> b</p>`,
        commentAlone: s => `<p><span data-html-comment="${esc(s)}"></span></p>`,
        admonition: s => `<div class="admonition" data-type="note"><p>${esc(s)}</p><pre><code>${esc(s)}</code></pre></div>`,
        youtubeLabel: s => `<div data-youtube-video="dQw4w9WgXcQ" data-embed-label="${esc(s)}"></div>`,
        highlight: s => `<p><mark>${esc(s)}</mark></p>`,
        gfmTable: s => `<table><tbody><tr><th><p>h</p></th></tr><tr><td><p>${esc(s)}</p></td></tr></tbody></table>`,
        layoutImage: s => `<img src="https://example.com/a.png" alt="${esc(s)}" title="${esc(s)}" data-width="50%">`,
        linkText: s => `<p><a href="https://example.com/">${esc(s)}</a></p>`,
    };
    const INPUTS = [
        PROBE,
        `a\n\n${PROBE}`,
        `a\n\n    ${PROBE}`,
        `a\n</div>${PROBE}`,
        `a\n>${PROBE}`,
        `--> ${PROBE}`,
        `"\n\n${PROBE}`,
        `x\n\n[l](javascript:void(0))`,
        `x|<[l](javascript:void(0))${PROBE}`,
        `x\`$[l](javascript:void(0))\\${PROBE}`,
    ];

    it.each(Object.entries(SHAPES))('%s', (label, build) => {
        const found = [];
        for (const input of INPUTS) {
            const md = toMarkdown(normalize(build(input)));
            const leaked = leaks(md);
            if (leaked.length) found.push({ input, md, leaked });
        }
        expect(found).toEqual([]);
    });
});

describe('loading Markdown renderer output', () => {
    it('a lone image loads without an empty paragraph before it', () => {
        expect(types(load(fromMarkdown('Intro\n\n![alt](a.png)\n\nOutro')).getJSON())).toEqual(['paragraph', 'image', 'paragraph']);
    });

    it.each([
        ['an image', '- first\n- ![shot](s.png)', 'image'],
        ['a code block', '- ```\n  npm test\n  ```\n- next', 'codeBlock'],
        ['a blockquote', '- > quoted\n- next', 'blockquote'],
    ])('a list item that opens with %s keeps it inside the list', (label, md, type) => {
        const json = load(fromMarkdown(md)).getJSON();
        // The list, then only the empty paragraph the editor keeps after a closing block.
        expect(types(json)).toEqual(['bulletList', 'paragraph']);
        expect(findAll(json.content[0], type)).toHaveLength(1);
    });

    it('a fenced code block has no extra trailing newline', () => {
        const json = load(fromMarkdown('```js\nconst x = 1;\n```')).getJSON();
        expect(json.content[0].content[0].text).toBe('const x = 1;');
    });
});
