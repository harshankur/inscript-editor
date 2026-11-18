// Security regressions: each case is an attack a hostile document, paste, history entry or host
// value could make, and what the editor does instead. Grouped by where the attack comes in.
import { afterEach, describe, expect, it, vi } from 'vitest';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { marked } from 'marked';
import { render, act } from '@testing-library/react';
import { createEditor } from './helpers/createEditor.js';
import { applyInscriptEditorTurndownRules } from '../src/markdown/turndownRules.js';
import { inertPreviewNodes } from '../src/utils/previewHtml.js';
import { inertPreviewHtml } from './helpers/inertPreviewHtml.js';
import { documentImageSrc, isDocumentImageSrc, pageHref, webHref } from '../src/utils/url.js';
import { cssLength, imageHeight } from '../src/utils/layout.js';
import { normalizeFontSize } from '../src/extensions/FontSize.js';
import { extractYoutubeIdFromUrl } from '../src/utils/youtubeUrl.js';
import { imageFilesOf } from '../src/extensions/ImageFiles.js';
import { boundedLowlight, HIGHLIGHT_LIMIT, AUTO_HIGHLIGHT_LIMIT } from '../src/utils/boundedLowlight.js';
import { setExternalOpener } from '../src/extensions/HostBridge.js';
import { BibliographyPanel } from '../src/components/BibliographyPanel.jsx';

// The denial-of-service tests time whole loads of crafted documents: room for a slow, shared CI
// runner (they catch blow-ups of seconds to minutes, not small slowdowns).
vi.setConfig({ testTimeout: 30000 });

let editor;
let element;
afterEach(() => { editor?.destroy(); element?.remove(); editor = null; element = null; vi.restoreAllMocks(); });

const mount = (content, editorOptions = {}, options = {}) => {
    element = document.createElement('div');
    document.body.appendChild(element);
    editor = createEditor({ element, content, ...options }, editorOptions);
    return editor;
};
/** An editor rendered by React, for its React node views (embeds, wikilinks, footnotes). */
const mountReact = async (content, editorOptions = {}) => {
    const { EditorContent } = await import('@tiptap/react');
    editor = createEditor({ content }, editorOptions);
    const view = render(<EditorContent editor={editor} />);
    element = view.container;
    return editor;
};

describe('links', () => {
    it('never keep a document\'s target, rel or class (a page-wide invisible link, the top window sent away)', () => {
        mount('<p><a href="https://phish.example" target="_top" rel="opener" class="fixed inset-0 z-50 opacity-0">x</a></p>');
        const html = editor.getHTML();
        expect(html).not.toMatch(/_top|opener"|fixed|inset-0/);
        expect(html).toContain('href="https://phish.example"');
        // Not from JSON either.
        editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'y', marks: [{ type: 'link', attrs: { href: 'https://a.example', target: '_top', class: 'fixed' } }] }] }] });
        expect(editor.getHTML()).not.toMatch(/_top|fixed/);
    });

    it('keep the host\'s own target, rel and class', () => {
        mount('<p><a href="https://a.example" target="_top">x</a></p>', { link: { HTMLAttributes: { target: '_blank', rel: 'noopener', class: 'host-link' } } });
        expect(editor.getHTML()).toBe('<p><a target="_blank" rel="noopener" class="host-link" href="https://a.example">x</a></p>');
    });

    it('link on paste never links an address a link may not have', () => {
        globalThis.ClipboardEvent ??= class extends Event { constructor(type, init) { super(type, init); this.clipboardData = init?.clipboardData ?? null; } };
        const pasteOver = url => {
            editor?.destroy();
            element?.remove();
            mount('<p>select me</p>');
            editor.commands.setTextSelection({ from: 1, to: 7 });
            editor.view.pasteText(url);
            return editor.getHTML();
        };
        expect(pasteOver('file:///etc/passwd')).not.toContain('<a');
        expect(pasteOver('javascript:alert(1)')).not.toContain('<a');
        expect(pasteOver('https://ok.example/')).toContain('href="https://ok.example/"');
    });

    it('a link clicked in a read-only document opens through the host\'s opener, never in place of the app', () => {
        mount('<p><a href="https://ok.example/page">x</a> <a href="#local">y</a></p>', {}, { editable: false });
        const open = vi.fn();
        setExternalOpener(editor, open);
        const anchors = element.querySelectorAll('a');
        const web = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
        anchors[0].dispatchEvent(web);
        expect(web.defaultPrevented).toBe(true);
        expect(open).toHaveBeenCalledWith('https://ok.example/page');
        const local = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
        anchors[1].dispatchEvent(local);
        expect(local.defaultPrevented).toBe(false);
        expect(open).toHaveBeenCalledTimes(1);
    });

    it('a link on the page\'s own site is left to it, and one to another machine is no link at all', () => {
        // A share path (backslashes) is refused as a link's address; `//host` is read as the web
        // address it means, whatever page the editor is drawn in.
        mount('<p><a href="//cdn.example/b">a</a> <a href="\\\\evil.example\\c">c</a> <a href="/page">b</a></p>', {}, { editable: false });
        expect(editor.getHTML()).not.toContain('evil.example');
        expect(editor.getHTML()).toContain('href="https://cdn.example/b"');
        const open = vi.fn();
        setExternalOpener(editor, open);
        // A link on the page's own site is left to it (its router, or its own page).
        const page = [...element.querySelectorAll('a')].find(a => a.getAttribute('href') === '/page');
        const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
        page.dispatchEvent(click);
        expect(click.defaultPrevented).toBe(false);
        expect(open).not.toHaveBeenCalled();
        expect(pageHref('\\\\evil.example\\x')).toBeNull();
        expect(pageHref('/\\evil.example/x')).toBeNull();
    });

    it('while editing, a wikilink to another site opens outside the page on a Cmd/Ctrl click only', async () => {
        await mountReact('<p><a data-wikilink data-target="A">A</a></p>', { wikilink: { enabled: true, resolver: () => ({ exists: true, href: 'https://wiki.example/A' }) } });
        const open = vi.fn();
        setExternalOpener(editor, open);
        await vi.waitFor(() => expect(element.querySelector('a[data-wikilink]')).not.toBeNull());
        const plain = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
        act(() => { element.querySelector('a[data-wikilink]').dispatchEvent(plain); });
        expect(plain.defaultPrevented).toBe(true);
        expect(open).not.toHaveBeenCalled();
        act(() => { element.querySelector('a[data-wikilink]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true })); });
        expect(open).toHaveBeenCalledWith('https://wiki.example/A');
    });

    it('with no opener, a read-only click opens a new tab without access back to this page', () => {
        mount('<p><a href="https://ok.example/">x</a></p>', {}, { editable: false });
        const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
        element.querySelector('a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
        expect(windowOpen).toHaveBeenCalledWith('https://ok.example/', '_blank', 'noopener,noreferrer');
    });
});

describe('addresses', () => {
    it('webHref takes only an absolute http(s) URL, normalized', () => {
        expect(webHref('https://a.example/x y')).toBe('https://a.example/x%20y');
        // A protocol-relative address (as embed codes give) is a web address over https.
        expect(webHref('//a.example/x')).toBe('https://a.example/x');
        for (const value of ['/account/delete', '\\\\attacker\\share\\x.exe', '/\\attacker\\x', '/C:/x', 'file:///x', 'javascript:alert(1)', '', null]) {
            expect(webHref(value)).toBeNull();
        }
    });

    it('pageHref takes a page on the host\'s site or a web address, nothing else', () => {
        expect(pageHref('#page')).toBe('#page');
        expect(pageHref('/wiki/Page')).toBe('/wiki/Page');
        expect(pageHref('https://a.example/')).toBe('https://a.example/');
        for (const value of ['javascript:alert(1)', 'data:text/html,x', '\\\\host\\share', '/\\host', 'file:///x']) {
            expect(pageHref(value)).toBeNull();
        }
    });

    it('isDocumentImageSrc refuses script, non-image data and a share on another machine', () => {
        for (const value of ['https://a.example/a.png', 'assets/a.png', 'data:image/png;base64,AA==', 'file:///pictures/a.png', 'asset://localhost/a.png']) {
            expect(isDocumentImageSrc(value)).toBe(true);
        }
        for (const value of ['javascript:alert(1)', 'data:text/html,x', '\\\\attacker\\share\\a.png', 'file://attacker/share/a.png']) {
            expect(isDocumentImageSrc(value)).toBe(false);
        }
    });
});

describe('document nodes', () => {
    it('an image keeps no dangerous src, and a bounded height', () => {
        mount('<img src="javascript:alert(1)"><img src="\\\\attacker\\share\\a.png"><img src="https://ok.example/a.png" height="99999">');
        const html = editor.getHTML();
        expect(html).not.toMatch(/javascript:|attacker/);
        expect(html).toContain('src="https://ok.example/a.png"');
        expect(html).toContain('height="10000"');
    });

    it('sizes from a document are bounded', () => {
        expect(cssLength('100000vw')).toBe('100vw');
        expect(cssLength('99999px')).toBe('4000px');
        expect(cssLength('50%')).toBe('50%');
        expect(normalizeFontSize('100000px')).toBe('200');
        expect(normalizeFontSize('11pt')).toBe('11pt');
        expect(imageHeight('abc')).toBeNull();
    });

    it('an embed with a relative source is not framed (it would load the host\'s own page)', async () => {
        await mountReact('<iframe src="/account/delete?confirm=1"></iframe>');
        await vi.waitFor(() => expect(element.textContent).toContain('Embed unavailable'));
        expect(element.querySelector('iframe')).toBeNull();
    });

    it('a wikilink shows only a page or web href from its resolver', async () => {
        await mountReact('<p><a data-wikilink data-target="A">A</a></p>', { wikilink: { enabled: true, resolver: () => ({ exists: true, href: 'data:text/html,<script>x</script>' }) } });
        await vi.waitFor(() => expect(element.querySelector('a[data-wikilink]')).not.toBeNull());
        expect(element.querySelector('a[data-wikilink]').getAttribute('href')).toBe('#');
    });

    it('a formula is drawn with trust off and bounded expansion and sizes', async () => {
        const katex = (await import('katex')).default;
        const renderToString = vi.spyOn(katex, 'renderToString');
        const { EditorContent } = await import('@tiptap/react');
        editor = createEditor({ content: '<p><span class="math-inline" data-math="x^2"></span></p>' });
        render(<EditorContent editor={editor} />);
        await vi.waitFor(() => expect(renderToString).toHaveBeenCalled());
        expect(renderToString.mock.calls[0][1]).toMatchObject({ trust: false, maxExpand: 1000, maxSize: 50 });
    });
});

describe('denial of service', () => {
    it('a tiny table with a huge colspan, or one long row over many short ones, stays small', () => {
        const start = Date.now();
        mount('<table><tr><td colspan="1000000">a</td></tr><tr><td>b</td></tr></table>');
        expect(editor.getHTML().length).toBeLessThan(200000);
        editor.commands.setContent(`<table><tr><td colspan="1000">x</td></tr>${'<tr><td>y</td></tr>'.repeat(60)}</table>`);
        expect(editor.state.doc.firstChild.type.name).not.toBe('table');
        expect(editor.state.doc.textContent).toContain('x');
        expect(Date.now() - start).toBeLessThan(10000);
    });

    it('many tables, stacked rowspans, or a span written as 1e5 cannot amplify either', () => {
        const start = Date.now();
        const table = `<table><tr><td colspan="1000">a</td></tr>${'<tr><td>b</td></tr>'.repeat(18)}</table>`;
        mount(table.repeat(8));
        const cellsOf = () => { let n = 0; editor.state.doc.descendants(node => { if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') n += 1; }); return n; };
        expect(cellsOf()).toBeLessThanOrEqual(20000);
        editor.commands.setContent('<table>' + '<tr><td colspan="1000" rowspan="20">x</td></tr>'.repeat(20) + '</table>');
        expect(cellsOf()).toBeLessThanOrEqual(20000);
        editor.commands.setContent('<table><tr><td colspan="1e5">a</td><td colspan="0x186a0">b</td></tr><tr><td>c</td></tr></table>');
        expect(cellsOf()).toBeLessThan(10);
        expect(Date.now() - start).toBeLessThan(10000);
    });

    it('a table pasted into a table cannot grow it past the limit, nor carry a rowspan past its rows', () => {
        const rows = '<tr><td>r</td></tr>'.repeat(200);
        mount(`<table>${rows}</table>`);
        const cellsOf = () => { let n = 0; editor.state.doc.descendants(node => { if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') n += 1; }); return n; };
        // A real paste (ProseMirror's own path): the table plugin's handler grows the table it lands in.
        globalThis.ClipboardEvent ??= class extends Event { constructor(type, init) { super(type, init); this.clipboardData = init?.clipboardData ?? null; } };
        const paste = html => editor.view.pasteHTML(html);
        const start = Date.now();
        editor.commands.setTextSelection(4);
        paste('<table><tr><td colspan="1000">x</td></tr></table>');
        expect(cellsOf()).toBeLessThanOrEqual(20000);
        expect(editor.state.doc.textContent).toContain('x');
        paste('<table><tr><td colspan="1000" rowspan="65534">y</td></tr></table>');
        expect(cellsOf()).toBeLessThanOrEqual(20000);
        expect(Date.now() - start).toBeLessThan(10000);
        // Read from HTML, a rowspan past the last row reaches no further.
        editor.commands.setContent('<table><tr><td rowspan="65534">a</td><td>b</td></tr><tr><td>c</td></tr></table>');
        expect(editor.getHTML()).not.toContain('65534');
    });

    it('an ordinary table, spans and all, is read as it is', () => {
        mount('<table><tr><th>a</th><th colspan="2">b</th></tr><tr><td>1</td><td>2</td><td>3</td></tr></table>');
        expect(editor.getHTML()).toContain('<th colspan="2"><p>b</p></th>');
    });

    it('a long GFM task list loads in linear time', () => {
        const items = Array.from({ length: 2000 }, (_, i) => `<li><input type="checkbox"> item ${i}</li>`).join('');
        const start = Date.now();
        mount(`<ul>${items}</ul>`);
        expect(editor.state.doc.firstChild.type.name).toBe('taskList');
        expect(Date.now() - start).toBeLessThan(15000);
    });

    it('many code blocks highlight within one budget per change', () => {
        const blocks = Array.from({ length: 150 }, (_, i) => `<pre><code>${`x${i} = 1.`.repeat(200)}</code></pre>`).join('');
        const start = Date.now();
        mount(`${blocks}<pre><code>y</code></pre>`);
        expect(Date.now() - start).toBeLessThan(15000);
        const typed = Date.now();
        editor.commands.setTextSelection(editor.state.doc.content.size - 2);
        editor.commands.insertContent('z');
        expect(Date.now() - typed).toBeLessThan(9000);
    });

    it('a table cell span from JSON outside the limits is bounded, the document kept', () => {
        mount('<p>x</p>');
        const json = colspan => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'keep me' }] }, { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cell' }] }] }] }] }] });
        const start = Date.now();
        editor.commands.setContent(json(3000000));
        editor.commands.insertContentAt(1, 'y');
        // Capped as HTML reads it back (a table of 1000 columns fits): kept, never millions wide.
        expect(editor.getHTML()).toContain('colspan="1000"');
        expect(editor.getHTML()).not.toContain('3000000');
        expect(editor.state.doc.textContent).toContain('keep me');
        expect(editor.state.doc.textContent).toContain('cell');
        expect(Date.now() - start).toBeLessThan(6000);
        // An odd or old value (null, a width past the cap) loses no document either.
        editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'still here' }] }, { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: null, colwidth: [4500] }, content: [{ type: 'paragraph' }] }] }] }] });
        expect(editor.state.doc.textContent).toContain('still here');
    });

    it('code highlighting is bounded (results are kept by the plugin, by node)', () => {
        const highlight = vi.fn(() => ({ type: 'root', children: [] }));
        const highlightAuto = vi.fn(() => ({ type: 'root', children: [] }));
        const bounded = boundedLowlight({ highlight, highlightAuto, listLanguages: () => ['ini'] });
        bounded.highlight('ini', 'a = 1');
        expect(highlight).toHaveBeenCalledTimes(1);
        expect(bounded.highlight('ini', 'x'.repeat(HIGHLIGHT_LIMIT + 1)).children[0].type).toBe('text');
        expect(bounded.highlightAuto('x'.repeat(AUTO_HIGHLIGHT_LIMIT + 1)).children[0].type).toBe('text');
        expect(highlight).toHaveBeenCalledTimes(1);
        expect(highlightAuto).not.toHaveBeenCalled();
    });

    it('a large pathological code block loads and edits quickly', () => {
        const start = Date.now();
        mount(`<pre><code class="language-ini">${'1.'.repeat(25000)}</code></pre><pre><code>x</code></pre>`);
        editor.commands.setTextSelection(editor.state.doc.content.size - 2);
        editor.commands.insertContent('y');
        expect(Date.now() - start).toBeLessThan(15000);
    });

    it('many footnotes number in one pass', async () => {
        const refs = Array.from({ length: 800 }, (_, i) => `<sup data-footnote-ref="f${i}"></sup>`).join(' ');
        const start = Date.now();
        await mountReact(`<p>${refs}</p>`);
        await vi.waitFor(() => expect(element.querySelectorAll('sup[data-footnote-ref]').length).toBe(800), { timeout: 20000 });
        expect(Date.now() - start).toBeLessThan(15000);
        const numbers = Array.from(element.querySelectorAll('sup[data-footnote-ref]')).slice(0, 3).map(el => el.textContent);
        expect(numbers.join(' ')).toMatch(/1.*2.*3/);
    });
});

describe('pasted input', () => {
    it('only a YouTube URL becomes a video, never a bare 11-letter word, and not in code', () => {
        expect(extractYoutubeIdFromUrl('development')).toBeNull();
        expect(extractYoutubeIdFromUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
        mount('<p>ab</p><pre><code>c</code></pre>');
        const paste = text => editor.view.someProp('handlePaste', f => f(editor.view, { clipboardData: { getData: t => (t === 'text/plain' ? text : ''), files: [] } }, null));
        editor.commands.setTextSelection(3);
        paste('development');
        expect(editor.getHTML()).not.toContain('youtube');
        // In the code block ("c" sits at 5 to 6).
        editor.commands.setTextSelection(6);
        expect(editor.state.selection.$from.parent.type.name).toBe('codeBlock');
        paste('https://youtu.be/dQw4w9WgXcQ');
        expect(editor.getHTML()).not.toContain('youtube.com/embed');
        editor.commands.setTextSelection(3);
        paste('https://youtu.be/dQw4w9WgXcQ');
        expect(editor.getHTML()).toContain('youtube.com/embed/dQw4w9WgXcQ');
    });

    it('an SVG file is never handed to the host\'s image handler', () => {
        const files = [new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }), new File(['x'], 'b.svg', { type: '' }), new File(['x'], 'c.png', { type: 'image/png' })];
        expect(imageFilesOf(files).map(f => f.name)).toEqual(['c.png']);
    });
});

describe('saved Markdown, rendered by a Markdown renderer', () => {
    const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    turndown.use(gfm);
    applyInscriptEditorTurndownRules(turndown);
    const live = html => {
        mount(html);
        const md = turndown.turndown(editor.getHTML());
        const t = document.createElement('template');
        t.innerHTML = marked.parse(md, { async: false });
        return { md, live: !!t.content.querySelector('[onerror], script') };
    };
    const IMG = '<img src=1 onerror=alert(1)>';
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    it('code cannot close its fence early, nor a language keep it from opening', () => {
        expect(live(`<pre><code>a\n   \`\`\`\n${esc(IMG)}</code></pre>`).live).toBe(false);
        expect(live(`<pre><code class="language-a\`b">x \`\`\` ${esc(IMG)}</code></pre>`).live).toBe(false);
    });

    it('a link\'s address with a space or line breaks stays one address', () => {
        expect(live(`<p><a href="https://ok.example/ ${esc(IMG)}">x</a></p>`).live).toBe(false);
        expect(live(`<p><a href="https://ok.example/&#10;&#10;${esc(IMG)}">x</a></p>`).live).toBe(false);
    });

    it('a title ending in a backslash stays a title', () => {
        const { md } = live(`<p><a href="https://ok.example/" title="${esc(IMG)}\\">x</a></p>`);
        expect(md).toContain('\\\\"');
    });

    it('a hard break opening a kept inline tag does not start a raw HTML block', () => {
        expect(live(`<p><mark><br>${esc(IMG)}</mark></p>`).live).toBe(false);
        expect(live(`<p><sup><br>${esc(IMG)}</sup></p>`).live).toBe(false);
    });

    it('a source comment in a heading or link keeps no line breaks', () => {
        const comment = `<span data-html-comment="x&#10;&#10;${esc(IMG)}"></span>`;
        expect(live(`<h2>${comment}</h2>`).live).toBe(false);
        expect(live(`<p><a href="https://ok.example/">${comment}</a></p>`).live).toBe(false);
        expect(live(`<p><strong>${comment}</strong></p>`).live).toBe(false);
    });

    it('a comment after a break written as <br> keeps no line breaks', () => {
        const comment = `<span data-html-comment="x&#10;&#10;${esc(IMG)}"></span>`;
        expect(live(`<p>a<br><br>${comment}</p>`).live).toBe(false);
        expect(live(`<p><br>${comment}</p>`).live).toBe(false);
    });

    it('an image\'s alt is one line, and a broken link or image never exposes its title as HTML', () => {
        expect(live(`<p><img src="https://ok.example/a.png" alt="a&#10;# b" title="${esc(IMG)}"></p>`).live).toBe(false);
        expect(live(`<p><a href="https://ok.example/" title="${esc(IMG)}">a<br>| b |<br>| --- | --- |<br>c | d</a></p>`).live).toBe(false);
    });

    it('an attribute of HTML kept in a link\'s text cannot end the link (marked)', () => {
        expect(live('<p><a href="https://ok.example/"><abbr title="](javascript:alert(1))">x</abbr></a></p>').md).not.toContain('](javascript');
        mount('<p><a href="https://ok.example/"><abbr title="](javascript:alert(1))">x</abbr></a></p>');
        const t = document.createElement('template');
        t.innerHTML = marked.parse(turndown.turndown(editor.getHTML()), { async: false });
        expect([...t.content.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(['https://ok.example/']);
    });

    it('many adjacent lists save in linear time', () => {
        const start = Date.now();
        mount('<ol><li><p>a</p></li></ol>'.repeat(3000));
        turndown.turndown(editor.getHTML());
        expect(Date.now() - start).toBeLessThan(10000);
    });
});

describe('history preview', () => {
    const PAYLOADS = ['xmp', 'noembed', 'noframes', 'plaintext'].map(tag => `<math><mtext><table><mglyph><${tag}><img src=x onerror=alert(1)></${tag}></mglyph></table></mtext></math>`)
        .concat('<math><mtext><table><malignmark><xmp><img src=x onerror=alert(1)></xmp></malignmark></table></mtext></math>');

    it.each(PAYLOADS)('no markup comes back live, as nodes or parsed again: %s', payload => {
        const nodes = inertPreviewNodes(payload);
        const holder = document.createElement('div');
        holder.appendChild(nodes);
        expect(holder.querySelector('[onerror]')).toBeNull();
        const reparsed = document.createElement('template');
        reparsed.innerHTML = inertPreviewHtml(payload);
        expect(reparsed.content.querySelector('[onerror]')).toBeNull();
    });

    it('drops identities, beacons and any style that could load something', () => {
        const out = inertPreviewHtml('<p id="config" name="getElementById" style="color: red">a</p><a href="https://ok" ping="https://evil/t">b</a>'
            + '<img src="https://ok/i.png" referrerpolicy="unsafe-url"><p style="background:u\\72l(https://evil/x)">c</p><p style="background-image:image-set(\'https://evil/x\' 1x)">d</p>');
        expect(out).not.toMatch(/id=|name=|ping=|referrerpolicy|evil/);
        expect(out).toContain('style="color: red"');
    });

    it('the history panel puts the cleaned nodes in, and is contained', async () => {
        const { HistoryView } = await import('../src/components/HistoryView.jsx');
        const history = [{ html: PAYLOADS[0], timestamp: 1, title: '' }, { html: '<p>b</p>', timestamp: 2, title: '' }];
        const { container } = render(<HistoryView history={history} currentIndex={1} />);
        expect(container.querySelector('[onerror]')).toBeNull();
        expect(container.querySelector('[data-history-preview]')).not.toBeNull();
    });
});

describe('more document values', () => {
    it('a code block\'s language from JSON adds no classes', () => {
        mount('<p>x</p>');
        editor.commands.setContent({ type: 'doc', content: [{ type: 'codeBlock', attrs: { language: 'js fixed inset-0 z-50' }, content: [{ type: 'text', text: 'x' }] }] });
        expect(editor.getHTML()).not.toMatch(/fixed|inset-0/);
        editor.commands.setContent('<pre><code class="language-python">x</code></pre>');
        expect(editor.getHTML()).toContain('class="language-python"');
    });

    it('image sources naming another machine are refused in every form', () => {
        for (const value of ['\\\\host\\share\\x.png', '/\\host/share/x.png', 'file:////host/share/x', 'file://localhost//host/share/x']) {
            expect(isDocumentImageSrc(value)).toBe(false);
        }
        // Two slashes may name a share, whatever page the editor is drawn in: refused as written, and
        // read by the editor as the web address it means.
        expect(isDocumentImageSrc('//cdn.example/x.png')).toBe(false);
        expect(documentImageSrc('//cdn.example/x.png')).toBe('https://cdn.example/x.png');
    });

    it('a resolver href with a leading non-breaking space is returned as checked, not trimmed into a script URL', () => {
        expect(pageHref('\u00a0javascript:alert(1)')).toBe('\u00a0javascript:alert(1)');
    });

    it('the history preview turns a webview into a placeholder and drops attributionsrc', () => {
        const out = inertPreviewHtml('<webview src="https://evil/x"></webview><img src="https://ok/a.png" attributionsrc="https://evil/r">');
        // The placeholder names the source; nothing loads it.
        expect(out).not.toMatch(/<webview|attributionsrc|src="https:\/\/evil/);
        expect(out).toContain('inscript-preview-embed');
    });
});

describe('diagram SVG', () => {
    it('is cleaned of scripts, handlers, loads and links, whatever Mermaid drew', async () => {
        const { cleanSvg } = await import('../src/utils/cleanSvg.js');
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">'
            + '<script>alert(1)</script><style>@import url(https://evil/x.css);</style>'
            + '<a xlink:href="https://attacker.example/"><text>click</text></a>'
            + '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/><span onclick="alert(1)">label</span></div></foreignObject>'
            + '<filter><feImage xmlns:x="http://www.w3.org/1999/xlink" x:href="https://evil/t.png"/></filter><use xmlns:x="http://www.w3.org/1999/xlink" x:href="https://evil/u.svg#a"/>'
            + '<image href="https://evil/i.png"/><path marker-end="url(#arrow)" style="fill: url(https://evil/p)"/><use href="#arrow"/></svg>';
        const el = cleanSvg(svg, document);
        const out = el.outerHTML;
        expect(out).not.toMatch(/onload|onerror|onclick|<script|@import|attacker|evil|<a[\s>]|<img|<image/);
        expect(out).toContain('click');
        expect(out).toContain('label');
        expect(out).toContain('marker-end="url(#arrow)"');
        expect(out).toContain('href="#arrow"');
        expect(cleanSvg('<div>not svg</div>', document)).toBeNull();
    });

    it('keeps no style reaching past the diagram, no escaped url() in a presentation value, no name; reads &nbsp;', async () => {
        const { cleanSvg } = await import('../src/utils/cleanSvg.js');
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" id="d1"><style>:host{position:fixed;inset:0}</style><style>:/**/host{position:fixed}</style><style>#d1 .node{fill:red}</style>'
            + '<rect mask="\\75 rl(https://attacker.example/beacon)" fill="url(#g)" name="APP_CONFIG"/><text>a&nbsp;b</text></svg>';
        const el = cleanSvg(svg, document);
        const out = el.outerHTML;
        expect(out).not.toMatch(/:host|attacker|APP_CONFIG/);
        expect(out).toContain('#d1 .node');
        expect(out).toContain('fill="url(#g)"');
        expect(el.querySelector('text').textContent).toBe('a\u00a0b');
    });

    it('reads a label\'s <br> as Mermaid writes it', async () => {
        const { cleanSvg } = await import('../src/utils/cleanSvg.js');
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><span>one<br>two</span></div></foreignObject></svg>';
        const el = cleanSvg(svg, document);
        expect(el).not.toBeNull();
        expect(el.querySelector('br')).not.toBeNull();
        expect(el.textContent).toBe('onetwo');
    });

    it('a diagram\'s ids in a shadow root are not the page\'s (drawn there: see security-mermaid.test.jsx)', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = host.attachShadow({ mode: 'open' });
        const { cleanSvg } = await import('../src/utils/cleanSvg.js');
        root.append(cleanSvg('<svg xmlns="http://www.w3.org/2000/svg"><g id="APP_CONFIG"/></svg>', document));
        expect(document.getElementById('APP_CONFIG')).toBeNull();
        host.remove();
    });
});

describe('panels', () => {
    it('the bibliography panel takes citation fields of any type from a JSON document without crashing', () => {
        mount('<p>x</p>');
        editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'citation', attrs: { key: 42, label: { a: 1 }, title: null } }, { type: 'citation', attrs: { key: 'b', label: 'B' } }] }] });
        expect(() => act(() => { render(<BibliographyPanel editor={editor} />); })).not.toThrow();
    });
});

describe('tables from JSON', () => {
    it('a JSON table within the span limits cannot be padded to millions of cells (opened or set)', async () => {
        const wideRow = { type: 'tableRow', content: Array.from({ length: 40 }, () => ({ type: 'tableCell', attrs: { colspan: 1000 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'w' }] }] })) };
        const shortRow = { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 's' }] }] }] };
        const json = { type: 'doc', content: [{ type: 'table', content: [wideRow, ...Array.from({ length: 20 }, () => shortRow)] }] };
        const cells = () => { let n = 0; editor.state.doc.descendants(node => { if (node.type.name === 'tableCell') n += 1; }); return n; };
        const start = Date.now();
        mount(json);
        await new Promise(resolve => setTimeout(resolve, 0));
        editor.commands.insertContentAt(1, 'x');
        expect(cells()).toBeLessThanOrEqual(20000);
        expect(editor.state.doc.textContent).toContain('w');
        editor.commands.setContent(json);
        editor.commands.insertContentAt(1, 'y');
        expect(cells()).toBeLessThanOrEqual(20000);
        expect(Date.now() - start).toBeLessThan(10000);
    });
});

describe('tables from JSON, unpacked', () => {
    const wide = colspan => ({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'w' }] }] }] }] });
    const cells = () => { let n = 0; editor.state.doc.descendants(node => { if (node.type.name === 'tableCell') n += 1; }); return n; };

    it('before anything is drawn, for JSON given to a new editor', () => {
        const start = Date.now();
        mount({ type: 'doc', content: Array.from({ length: 200 }, () => wide(1000)) });
        expect(element.querySelectorAll('col').length).toBeLessThanOrEqual(21000);
        expect(Date.now() - start).toBeLessThan(15000);
    });

    it('with the first change, in an editor with no view', () => {
        editor = createEditor({ content: '<p>x</p>' });
        editor.commands.setContent({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: Array.from({ length: 40 }, () => ({ type: 'tableCell', attrs: { colspan: 1000 }, content: [{ type: 'paragraph' }] })) }, ...Array.from({ length: 20 }, () => ({ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }] }))] }] });
        editor.commands.insertContentAt(1, 'y');
        expect(cells()).toBeLessThanOrEqual(20000);
    });

    it('in one pass, however many tables', () => {
        const content = [];
        for (let i = 0; i < 1000; i++) content.push(wide(100), { type: 'paragraph' });
        const start = Date.now();
        mount('<p>x</p>');
        editor.commands.setContent({ type: 'doc', content });
        editor.commands.insertContentAt(1, 'z');
        expect(Date.now() - start).toBeLessThan(8000);
    });
});

describe('editor plugins', () => {
    it('code blocks are highlighted by one plugin, which finishes what a pass left plain', async () => {
        const blocks = Array.from({ length: 60 }, (_, i) => `<pre><code>${`v${i} = ${i} + 1;\n`.repeat(120)}</code></pre>`).join('');
        mount(blocks);
        const highlighting = editor.state.plugins.filter(plugin => /lowlight|inscriptCodeHighlight/.test(String(plugin.key)));
        expect(highlighting).toHaveLength(1);
        const highlighted = () => [...element.querySelectorAll('pre')].filter(pre => pre.querySelector('[class*="hljs-"]')).length;
        await vi.waitFor(() => expect(highlighted()).toBe(60), { timeout: 20000 });
    });

    it('many oversized JSON tables are unpacked in one rebuild, fast', () => {
        const content = [];
        for (let i = 0; i < 3000; i++) {
            content.push({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 100 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: `t${i}` }] }] }] }] });
            for (let j = 0; j < 20; j++) content.push({ type: 'paragraph' });
        }
        mount('<p>x</p>');
        const start = Date.now();
        editor.commands.setContent({ type: 'doc', content });
        editor.commands.insertContentAt(1, 'z');
        expect(Date.now() - start).toBeLessThan(10000);
        expect(editor.state.doc.textContent).toContain('t2999');
    });
});

describe('large ordinary tables', () => {
    const grid = (rows, cols, label) => `<table>${Array.from({ length: rows }, (_, r) => `<tr>${Array.from({ length: cols }, (_, c) => `<td>${label}${r}-${c}</td>`).join('')}</tr>`).join('')}</table>`;
    const tables = () => { let n = 0; editor.state.doc.descendants(node => { if (node.type.name === 'table') n += 1; }); return n; };

    it('adding a row next to a large rectangular table never flattens it', async () => {
        // On the editor's own plugins, without drawing 20,000 cells.
        const { EditorState } = await import('@tiptap/pm/state');
        mount('<p>x</p>');
        const { schema } = editor;
        const cell = text => ({ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
        const table = (rows, cols, label) => ({ type: 'table', content: Array.from({ length: rows }, (_, r) => ({ type: 'tableRow', content: Array.from({ length: cols }, (_, c) => cell(`${label}${r}-${c}`)) })) });
        const doc = schema.nodeFromJSON({ type: 'doc', content: [table(140, 150, 'b'), { type: 'paragraph', content: [{ type: 'text', text: 'between' }] }, table(2, 3, 's')] });
        let state = EditorState.create({ doc, plugins: editor.state.plugins });
        let end = null;
        state.doc.forEach((node, offset) => { if (node.type.name === 'table') end = offset + node.nodeSize - 1; });
        const row = schema.nodeFromJSON({ type: 'tableRow', content: [cell('n1'), cell('n2'), cell('n3')] });
        state = state.apply(state.tr.insert(end, row));
        const tables = []; state.doc.forEach(node => { if (node.type.name === 'table') tables.push(node.childCount); });
        expect(tables).toEqual([140, 3]);
    });

    it('cells pasted inside a large table stay cells', () => {
        globalThis.ClipboardEvent ??= class extends Event { constructor(type, init) { super(type, init); this.clipboardData = init?.clipboardData ?? null; } };
        mount(grid(100, 100, 'c'));
        let first = null;
        editor.state.doc.descendants((node, pos) => { if (first === null && node.isText && node.text === 'c0-0') first = pos; });
        editor.commands.setTextSelection(first + 1);
        editor.view.pasteHTML(grid(10, 10, 'p'));
        expect(tables()).toBe(1);
        expect(editor.state.doc.textContent).toContain('p9-9');
        expect(editor.state.doc.firstChild.childCount).toBe(100);
    }, 30000);
});

describe('highlighting passes', () => {
    it('a document without code left after an unfinished pass asks for no more passes', async () => {
        mount(Array.from({ length: 60 }, (_, i) => `<pre><code>${`w${i} = ${i};\\n`.repeat(150)}</code></pre>`).join(''));
        editor.commands.setContent('<p>no code</p>');
        const highlighting = editor.state.plugins.find(plugin => String(plugin.key).startsWith('inscriptCodeHighlight'));
        expect(highlighting.getState(editor.state).unfinished).toBe(false);
    });
});

describe('clicks and opened links', () => {
    it('a read-only wikilink to another site opens once', async () => {
        await mountReact('<p><a data-wikilink data-target="A">A</a></p>', { wikilink: { enabled: true, resolver: () => ({ exists: true, href: 'https://wiki.example/A' }) } });
        editor.setEditable(false);
        const open = vi.fn();
        setExternalOpener(editor, open);
        await vi.waitFor(() => expect(element.querySelector('a[data-wikilink]')).not.toBeNull());
        act(() => { element.querySelector('a[data-wikilink]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
        expect(open).toHaveBeenCalledTimes(1);
    });

    it('on an app\'s own file page, a relative link is kept from replacing the app; a web link opens outside', async () => {
        const { openOutside } = await import('../src/extensions/HostBridge.js');
        mount('<p>x</p>');
        const opened = [];
        const page = { baseURI: 'file:///app/index.html', defaultView: { open: href => opened.push(href) } };
        expect(openOutside(editor, 'notes.html', page)).toBe(true);
        expect(opened).toEqual([]);
        expect(openOutside(editor, 'mailto:a@b.example', page)).toBe(false);
        expect(openOutside(editor, '#part', page)).toBe(false);
        expect(openOutside(editor, 'https://site.example/', page)).toBe(true);
        expect(opened).toEqual(['https://site.example/']);
    });
});

describe('refused image sources', () => {
    it('make no image at all', () => {
        mount('<p>a</p><img src="\\\\\\\\host\\\\share\\\\a.png" data-width="50%"><img src="https://ok.example/b.png">');
        const images = [];
        editor.state.doc.descendants(node => { if (node.type.name === 'image') images.push(node.attrs.src); });
        expect(images).toEqual(['https://ok.example/b.png']);
    });
});

describe('round trips kept', () => {
    it('a large rectangular table read from HTML stays a table', async () => {
        const { normalizeForParse } = await import('../src/utils/parseDom.js');
        const holder = document.createElement('div');
        holder.innerHTML = `<table>${Array.from({ length: 150 }, (_, r) => `<tr>${'<td>c</td>'.repeat(150)}</tr>`).join('')}</table>`;
        mount('<p>x</p>');
        const read = normalizeForParse(holder, editor.schema);
        expect(read.querySelector('table')).not.toBeNull();
        expect(read.querySelectorAll('td').length).toBe(22500);
    });

    it('a formula outside a link keeps its backslashes in the saved Markdown', () => {
        const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
        turndown.use(gfm);
        applyInscriptEditorTurndownRules(turndown);
        mount('<div class="math-block" data-math="\\frac{a}{b}"></div>');
        expect(turndown.turndown(editor.getHTML())).toContain('\\frac{a}{b}');
    });

    it('an undo after oversized JSON tables were unpacked never brings them back', () => {
        mount('<p>x</p>');
        const wide = { type: 'table', content: [{ type: 'tableRow', content: Array.from({ length: 40 }, () => ({ type: 'tableCell', attrs: { colspan: 1000 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'w' }] }] })) }, ...Array.from({ length: 20 }, () => ({ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }] }))] };
        editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'start' }] }, wide] });
        editor.commands.insertContentAt(1, 'y');
        const cells = () => { let n = 0; editor.state.doc.descendants(node => { if (node.type.name === 'tableCell') n += 1; }); return n; };
        expect(cells()).toBeLessThanOrEqual(20000);
        editor.commands.undo();
        expect(cells()).toBeLessThanOrEqual(20000);
    });
});

describe('more round trips kept', () => {
    it('a JSON code block whose language is not a name loads, shown as plain code', () => {
        mount({ type: 'doc', content: [{ type: 'codeBlock', attrs: { language: 5 }, content: [{ type: 'text', text: 'x = 1' }] }] });
        expect(editor.state.doc.textContent).toBe('x = 1');
    });

    it('the history preview keeps a harmless style that merely says url or image', () => {
        const out = inertPreviewHtml('<p style="font-family: \'Curlz MT\'; list-style-image: none; color: red">a</p>');
        expect(out).toContain('color: red');
    });

    it('a click with a modifier in a read-only document is left to the browser', () => {
        mount('<p><a href="https://ok.example/page">x</a></p>', {}, { editable: false });
        const open = vi.fn();
        setExternalOpener(editor, open);
        const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true });
        element.querySelector('a').dispatchEvent(click);
        expect(click.defaultPrevented).toBe(false);
        expect(open).not.toHaveBeenCalled();
    });

    it('on a page opened from a file, a protocol-relative image or link is read as the web address it means', async () => {
        const { protocolRelativeAsWeb } = await import('../src/utils/url.js');
        vi.stubGlobal('location', { protocol: 'file:', href: 'file:///app/index.html' });
        try {
            expect(protocolRelativeAsWeb('//cdn.example/a.png')).toBe('https://cdn.example/a.png');
            expect(protocolRelativeAsWeb('\\\\\\\\host\\\\share')).toBe('\\\\\\\\host\\\\share');
            mount('<p><a href="//example.com/x">l</a></p><img src="//cdn.example/a.png">');
            const html = editor.getHTML();
            expect(html).toContain('href="https://example.com/x"');
            expect(html).toContain('src="https://cdn.example/a.png"');
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe('round 6', () => {
    it('the history preview drops a share address as the editor does', () => {
        const out = inertPreviewHtml('<img src="\\\\attacker\\share\\a.png"><img src="file://attacker/share/b.png"><img src="https://ok.example/c.png">');
        expect(out).not.toContain('attacker');
        expect(out).toContain('https://ok.example/c.png');
    });

    it('a protocol-relative embed (as embed codes give) is offered for loading', async () => {
        await mountReact('<iframe src="//player.example/video/1"></iframe>');
        await vi.waitFor(() => expect(element.textContent).toContain('player.example'));
        expect(element.textContent).not.toContain('Embed unavailable');
    });

    it('an oversized paste of cells into a table keeps their content, images too', () => {
        globalThis.ClipboardEvent ??= class extends Event { constructor(type, init) { super(type, init); this.clipboardData = init?.clipboardData ?? null; } };
        mount(`<table>${'<tr><td>r</td></tr>'.repeat(30)}</table>`);
        editor.commands.setTextSelection(4);
        editor.view.pasteHTML('<table><tr><td colspan="1000"><img src="https://ok.example/i.png"></td></tr></table>');
        let images = 0;
        editor.state.doc.descendants(node => { if (node.type.name === 'image') images += 1; });
        expect(images).toBe(1);
        expect(editor.state.doc.firstChild.childCount).toBe(30);
    });
});

describe('round 7', () => {
    it('merging most of a large table keeps the table (an edit is no content from outside)', async () => {
        const { EditorState } = await import('@tiptap/pm/state');
        const { CellSelection, mergeCells } = await import('@tiptap/pm/tables');
        mount('<p>x</p>');
        const { schema } = editor;
        const cell = () => ({ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'c' }] }] });
        const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: Array.from({ length: 145 }, () => ({ type: 'tableRow', content: Array.from({ length: 145 }, cell) })) }] });
        let state = EditorState.create({ doc, plugins: editor.state.plugins });
        const cellPos = (row, col) => { let pos = 1; for (let r = 0; r < row; r++) pos += state.doc.firstChild.child(r).nodeSize; pos += 1; for (let c = 0; c < col; c++) pos += state.doc.firstChild.child(row).child(c).nodeSize; return pos; };
        state = state.apply(state.tr.setSelection(CellSelection.create(state.doc, cellPos(0, 0), cellPos(142, 142))));
        mergeCells(state, tr => { state = state.apply(tr); });
        let tables = 0; state.doc.forEach(node => { if (node.type.name === 'table') tables += 1; });
        expect(tables).toBe(1);
    }, 30000);

    it('a rowspan of 0 reaches the last row, as a browser reads it', () => {
        mount('<table><tr><td rowspan="0">a</td><td>b</td></tr><tr><td>c</td></tr><tr><td>d</td></tr></table>');
        expect(editor.getHTML()).toContain('rowspan="3"');
    });

    it('column widths from JSON are cut to the limit', () => {
        mount({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colwidth: [100000000] }, content: [{ type: 'paragraph' }] }] }] }] });
        let widths = null;
        editor.state.doc.descendants(node => { if (node.type.name === 'tableCell') widths = node.attrs.colwidth; });
        expect(widths).toEqual([4000]);
        editor.commands.setContent({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colwidth: [99999] }, content: [{ type: 'paragraph' }] }] }] }] });
        editor.state.doc.descendants(node => { if (node.type.name === 'tableCell') widths = node.attrs.colwidth; });
        expect(widths).toEqual([4000]);
    });
});

describe('round 8', () => {
    // A 145 by 145 table whose first cell spans 143 by 143 (as a merge leaves it): 20,448 excess
    // cells, made by an edit, and already rectangular to the table plugin.
    const mergedTable = () => {
        const cell = (text, attrs) => ({ type: 'tableCell', ...(attrs ? { attrs } : {}), content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
        const rows = Array.from({ length: 145 }, (_, r) => ({
            type: 'tableRow',
            content: r === 0 ? [cell('m', { colspan: 143, rowspan: 143 }), cell('a'), cell('b')]
                : r < 143 ? [cell('a'), cell('b')]
                : Array.from({ length: 145 }, () => cell('c')),
        }));
        return { type: 'table', content: rows };
    };
    const stateWith = async content => {
        const { EditorState } = await import('@tiptap/pm/state');
        mount('<p>x</p>');
        const doc = editor.schema.nodeFromJSON({ type: 'doc', content });
        return EditorState.create({ doc, plugins: editor.state.plugins });
    };
    const tablesIn = doc => { const found = []; doc.descendants(node => { if (node.type.name === 'table') found.push(node); }); return found; };

    it('a paste of text into a document over the limit by edits rebuilds nothing (its undo kept)', async () => {
        const state = await stateWith([mergedTable(), { type: 'paragraph', content: [{ type: 'text', text: 'after' }] }]);
        const tr = state.tr.insertText('pasted', state.doc.content.size - 1).setMeta('uiEvent', 'paste');
        const { state: next, transactions } = state.applyTransaction(tr);
        expect(transactions).toHaveLength(1);
        expect(next.doc.textContent).toContain('pasted');
    });

    it('a table pasted into a cell of the reader\'s oversized table unpacks only what was pasted', async () => {
        const state = await stateWith([mergedTable(), { type: 'paragraph' }]);
        const { schema } = editor;
        const small = schema.nodeFromJSON({ type: 'table', content: [
            { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 3 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested' }] }] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }] },
        ] });
        // Inside the spanning cell's paragraph: table (0), row (1), cell (2), paragraph (3).
        const tr = state.tr.insert(4, small).setMeta('uiEvent', 'paste');
        const next = state.apply(tr);
        const tables = tablesIn(next.doc);
        expect(tables).toHaveLength(1);
        expect(tables[0].childCount).toBe(145);
        expect(next.doc.textContent).toContain('nested');
    });

    it('a rectangular table pasted into a document over the limit is kept a table', async () => {
        const state = await stateWith([mergedTable(), { type: 'paragraph' }]);
        const table = editor.schema.nodeFromJSON({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'r' }] }] }] }] });
        const next = state.apply(state.tr.insert(state.doc.content.size, table).setMeta('uiEvent', 'paste'));
        expect(tablesIn(next.doc)).toHaveLength(2);
    });

    it('an oversized table a host inserts is unpacked, not refused', () => {
        mount('<p>x</p>');
        const cell = (text, attrs) => ({ type: 'tableCell', ...(attrs ? { attrs } : {}), content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
        editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'table', content: [
            { type: 'tableRow', content: Array.from({ length: 150 }, (_, i) => cell(`k${i}`, { colspan: 1000 })) },
            { type: 'tableRow', content: [cell('last')] },
        ] });
        expect(tablesIn(editor.state.doc)).toHaveLength(0);
        expect(editor.state.doc.textContent).toContain('k149');
        expect(editor.state.doc.textContent).toContain('last');
    });

    it('JSON content with more children than a call takes arguments is weighed without a crash', async () => {
        const { cleanedContent } = await import('../src/extensions/DocumentValues.js');
        mount('<p>x</p>');
        const content = { type: 'doc', content: Array.from({ length: 200000 }, () => ({ type: 'paragraph' })) };
        expect(cleanedContent(editor, content)).toBe(content);
    });

    it('JSON the schema refuses still has its column widths bounded', async () => {
        const { cleanedContent } = await import('../src/extensions/DocumentValues.js');
        mount('<p>x</p>');
        const content = { type: 'doc', content: [
            { type: 'nonsense' },
            { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 1000, colwidth: [1e9] }, content: [{ type: 'paragraph' }] }] }, ...Array.from({ length: 30 }, () => ({ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }] }))] },
        ] };
        const bounded = cleanedContent(editor, content);
        expect(bounded.content[1].content[0].content[0].attrs.colwidth).toEqual([4000]);
    });

    it('column widths read from HTML are bounded as JSON\'s are', () => {
        mount('<table><tr><td colwidth="-500,-500">a</td></tr></table>');
        let widths = null;
        editor.state.doc.descendants(node => { if (node.type.name === 'tableCell') widths = node.attrs.colwidth; });
        expect(widths).toEqual([0, 0]);
    });

    it('a refused link goes nowhere: from JSON it is plain text, and an empty address is never followed', async () => {
        const { openOutside } = await import('../src/extensions/HostBridge.js');
        mount({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'share', marks: [{ type: 'link', attrs: { href: '\\\\host\\share\\x' } }] }] }] }, {}, { editable: false });
        expect(element.querySelector('a')).toBeNull();
        expect(editor.state.doc.textContent).toBe('share');
        expect(openOutside(editor, '', { baseURI: 'https://site.example/' })).toBe(true);
    });
});

describe('round 9', () => {
    const cell = (text, attrs) => ({ type: 'tableCell', ...(attrs ? { attrs } : {}), content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    const oversized = () => ({ type: 'table', content: [
        { type: 'tableRow', content: [cell('wide', { colspan: 1000 })] },
        ...Array.from({ length: 30 }, (_, i) => ({ type: 'tableRow', content: [cell(`r${i}`)] })),
    ] });

    it('an unpacked table leaves the earlier history alone, and one undo takes it back whole', async () => {
        const { closeHistory } = await import('@tiptap/pm/history');
        mount('<p>hello</p>');
        editor.commands.insertContentAt(6, ' world');
        editor.view.dispatch(closeHistory(editor.state.tr));
        editor.commands.insertContentAt(editor.state.doc.content.size, oversized());
        expect(editor.state.doc.textContent).toContain('r29');
        editor.commands.undo();
        expect(editor.state.doc.textContent).toBe('hello world');
        editor.commands.undo();
        expect(editor.state.doc.textContent).toBe('hello');
    });

    it('many oversized tables inside another table\'s cells are unpacked in one step, the outer table kept', async () => {
        const { tableCounts } = await import('../src/utils/tableSize.js');
        mount('<p>x</p>');
        const inner = i => ({ type: 'table', content: [
            { type: 'tableRow', content: [cell(`n${i}`, { colspan: 400 })] },
            { type: 'tableRow', content: [cell('s')] },
        ] });
        const outer = { type: 'table', content: Array.from({ length: 120 }, (_, i) => ({ type: 'tableRow', content: [{ type: 'tableCell', content: [inner(i)] }] })) };
        editor.commands.insertContentAt(editor.state.doc.content.size, outer);
        const tables = [];
        editor.state.doc.descendants(node => { if (node.type.name === 'table') tables.push(node); });
        expect(tables[0].childCount).toBe(120);
        expect(tableCounts(editor.state.doc).excess).toBeLessThanOrEqual(20000);
        expect(editor.state.doc.textContent).toContain('n119');
        expect(editor.state.doc.textContent).toContain('n0');
    });

    it('the cursor stays where it was when a table above it is unpacked', () => {
        mount('<p>above</p><p>below</p>');
        let at = null;
        editor.state.doc.descendants((node, pos) => { if (node.isText && node.text === 'below') at = pos + 3; });
        editor.commands.setTextSelection(at);
        editor.commands.insertContentAt(7, oversized(), { updateSelection: false });
        editor.commands.insertContent('X');
        expect(editor.state.doc.textContent).toContain('belXow');
    });

    it('the highlighting budget is shared by every editor\'s pass in one turn of the page', async () => {
        const busy = ms => { const end = performance.now() + ms; while (performance.now() < end) { /* spend */ } };
        const fake = { listLanguages: () => ['js'], highlight: () => { busy(60); return { type: 'root', children: [], data: {} }; } };
        const bounded = boundedLowlight(fake);
        bounded.beginPass();
        expect(bounded.highlight('js', 'a = 1').data.plain).toBeUndefined();
        bounded.beginPass();
        expect(bounded.highlight('js', 'b = 2').data.plain).toBe(true);
        expect(bounded.unfinished()).toBe(true);
        await Promise.resolve();
        bounded.beginPass();
        expect(bounded.highlight('js', 'b = 2').data.plain).toBeUndefined();
    });

    it('every image path keeps a source as documentImageSrc does', async () => {
        const { documentImageSrc } = await import('../src/utils/url.js');
        expect(documentImageSrc('https://ok.example/a.png')).toBe('https://ok.example/a.png');
        expect(documentImageSrc('javascript:alert(1)')).toBeNull();
        expect(documentImageSrc('\\\\host\\share\\a.png')).toBeNull();
    });
});

describe('round 10', () => {
    const cell = (text, attrs) => ({ type: 'tableCell', ...(attrs ? { attrs } : {}), content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    const spanned = colspan => ({ type: 'doc', content: [{ type: 'table', content: [
        { type: 'tableRow', content: [cell('w', { colspan })] },
        ...Array.from({ length: 50 }, () => ({ type: 'tableRow', content: [cell('r')] })),
    ] }] });
    const tables = () => { let n = 0; editor.state.doc.descendants(node => { if (node.type.name === 'table') n += 1; }); return n; };

    it('a JSON span written as text, a fraction or without end is weighed as the table plugin reads it', () => {
        for (const colspan of ['200000', 5000.5, 'Infinity']) {
            mount(spanned(colspan));
            expect(tables()).toBe(0);
            expect(editor.state.doc.textContent).toContain('w');
            editor.destroy(); element.remove(); editor = null;
            mount('<p>x</p>');
            editor.commands.setContent(spanned(colspan));
            expect(tables()).toBe(0);
            editor.destroy(); element.remove(); editor = null;
        }
    });

    it('an edit cannot make a table that a reload would take apart', async () => {
        const { EditorState } = await import('@tiptap/pm/state');
        const { tableCounts, TABLE_GROWTH_LIMIT } = await import('../src/utils/tableSize.js');
        mount('<p>x</p>');
        const doc = editor.schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [cell('a')] }, { type: 'tableRow', content: [cell('b')] }] }] });
        let state = EditorState.create({ doc, plugins: editor.state.plugins });
        // A span widened past the limit by a command (as a merge or a resize would set it).
        state = state.apply(state.tr.setNodeAttribute(2, 'colspan', 30000));
        expect(tableCounts(state.doc).excess).toBeLessThanOrEqual(TABLE_GROWTH_LIMIT);
    });

    it('a column dragged wider than the limit is kept at it, as a reload would read it', async () => {
        const { EditorState } = await import('@tiptap/pm/state');
        mount('<p>x</p>');
        const doc = editor.schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [cell('a')] }] }] });
        let state = EditorState.create({ doc, plugins: editor.state.plugins });
        state = state.apply(state.tr.setNodeAttribute(2, 'colwidth', [5200]));
        let widths = null;
        state.doc.descendants(node => { if (node.type.name === 'tableCell') widths = node.attrs.colwidth; });
        expect(widths).toEqual([4000]);
    });

    it('a very small width or font size is kept as written, never in exponent form', () => {
        expect(cssLength('0.0000005%')).toBe('0.0000005%');
        expect(cssLength('5000px')).toBe('4000px');
        expect(normalizeFontSize('0.0000001px')).toBe('0.0000001');
        expect(normalizeFontSize('900px')).toBe('200');
    });
});

describe('round 11', () => {
    const cell = (text, attrs) => ({ type: 'tableCell', ...(attrs ? { attrs } : {}), content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    // 125 by 125, its first cell spanning 123 by 123: 15,128 excess cells.
    const merged = () => ({ type: 'table', content: Array.from({ length: 125 }, (_, r) => ({
        type: 'tableRow',
        content: r === 0 ? [cell('m', { colspan: 123, rowspan: 123 }), cell('a'), cell('b')]
            : r < 123 ? [cell('a'), cell('b')]
            : Array.from({ length: 125 }, () => cell('c')),
    })) });

    it('a table pasted next to one just like it is unpacked when it must be, never refused', async () => {
        const { EditorState } = await import('@tiptap/pm/state');
        const { tableCounts, TABLE_GROWTH_LIMIT } = await import('../src/utils/tableSize.js');
        mount('<p>x</p>');
        const { schema } = editor;
        const doc = schema.nodeFromJSON({ type: 'doc', content: [merged(), { type: 'paragraph' }] });
        const state = EditorState.create({ doc, plugins: editor.state.plugins });
        const copy = schema.nodeFromJSON(doc.firstChild.toJSON());
        const next = state.apply(state.tr.insert(doc.firstChild.nodeSize, copy).setMeta('uiEvent', 'paste'));
        expect(next.doc.content.size).toBeGreaterThan(state.doc.content.size);
        let tables = 0; next.doc.forEach(node => { if (node.type.name === 'table') tables += 1; });
        expect(tables).toBe(1);
        expect(tableCounts(next.doc).excess).toBeLessThanOrEqual(TABLE_GROWTH_LIMIT);
    }, 30000);

    it('only a paste the table plugin merges into a table is weighed as growing it', async () => {
        const { Slice, Fragment } = await import('@tiptap/pm/model');
        const { pastedGrid } = await import('../src/utils/tableSize.js');
        mount('<p>x</p>');
        const { schema } = editor;
        const table = schema.nodeFromJSON({ type: 'table', content: Array.from({ length: 3 }, () => ({ type: 'tableRow', content: [cell('a'), cell('b')] })) });
        const paragraph = schema.nodeFromJSON({ type: 'paragraph', content: [{ type: 'text', text: 'intro' }] });
        expect(pastedGrid(new Slice(Fragment.from(table), 0, 0))).toEqual({ width: 2, height: 3, spanned: 0 });
        expect(pastedGrid(new Slice(Fragment.fromArray([paragraph, table]), 0, 0))).toBeNull();
    });

    it('a wikilink whose resolver gives another scheme goes nowhere when clicked', async () => {
        await mountReact('<p><a data-wikilink data-target="A">A</a></p>', { wikilink: { enabled: true, resolver: () => ({ exists: true, href: 'myapp://note/A' }) } });
        await vi.waitFor(() => expect(element.querySelector('a[data-wikilink]')).not.toBeNull());
        const anchor = element.querySelector('a[data-wikilink]');
        const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
        act(() => { anchor.dispatchEvent(click); });
        expect(click.defaultPrevented).toBe(true);
    });

    it('a list changed between two parses in one turn is read again', () => {
        mount('<p>x</p>');
        const parser = editor.schema.cached.domParser;
        const list = document.createElement('div');
        list.innerHTML = '<ul><li><input type="checkbox"> a</li><li><input type="checkbox"> b</li></ul>';
        expect(parser.parse(list).firstChild.type.name).toBe('taskList');
        list.querySelector('input').remove();
        expect(parser.parse(list).firstChild.type.name).toBe('bulletList');
    });
});

describe('round 12', () => {
    it('a diagram\'s style with an escape or the word expression is kept unless it loads something', async () => {
        const { cleanSvg } = await import('../src/utils/cleanSvg.js');
        const svg = style => `<svg xmlns="http://www.w3.org/2000/svg"><style>${style}</style><g class="expression"></g></svg>`;
        const kept = css => cleanSvg(svg(css), document)?.querySelector('style')?.textContent ?? null;
        expect(kept('.expression { fill: red; font-family: "A\\26 B"; }')).toContain('fill: red');
        expect(kept('.a { background: u\\72l(https://x.example/a.png); }')).toBeNull();
        expect(kept(':ho\\st { color: red; }')).toBeNull();
        expect(kept('.a { width: expression(alert(1)); }')).toBeNull();
    });

    it('a link with no address is written with none (not an empty one)', () => {
        mount({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: null } }] }] }] });
        expect(editor.getHTML()).not.toContain('href=');
    });

    it('two kinds of code block in one editor each get their highlighting', async () => {
        const { codeHighlightPlugin } = await import('../src/extensions/codeHighlight.js');
        const { boundedLowlight } = await import('../src/utils/boundedLowlight.js');
        const { EditorState } = await import('@tiptap/pm/state');
        const { common, createLowlight } = await import('lowlight');
        mount('<p>x</p>');
        const lowlight = boundedLowlight(createLowlight(common));
        const plugins = [codeHighlightPlugin({ name: 'codeBlock', lowlight }), codeHighlightPlugin({ name: 'snippet', lowlight })];
        expect(() => EditorState.create({ schema: editor.schema, plugins })).not.toThrow();
    });

    it('a protocol-relative image is read as its https address even when the code runs in a web page and the editor in a file page', () => {
        mount('<img src="//cdn.example/a.png">');
        expect(editor.getHTML()).toContain('src="https://cdn.example/a.png"');
        expect(inertPreviewHtml('<img src="//cdn.example/b.png">')).toContain('src="https://cdn.example/b.png"');
    });
});

describe('round 13', () => {
    it('cells pasted into a table when the document is near the limit go in as content, never lost', async () => {
        globalThis.ClipboardEvent ??= class extends Event { constructor(type, init) { super(type, init); this.clipboardData = init?.clipboardData ?? null; } };
        const { tableCounts, TABLE_GROWTH_LIMIT } = await import('../src/utils/tableSize.js');
        const cell = (text, attrs) => ({ type: 'tableCell', ...(attrs ? { attrs } : {}), content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
        // 141 by 141, its first cell spanning 139 by 139: 19,320 excess cells, under the limit.
        const merged = { type: 'table', content: Array.from({ length: 141 }, (_, r) => ({
            type: 'tableRow',
            content: r === 0 ? [cell('m', { colspan: 139, rowspan: 139 }), cell('a'), cell('b')]
                : r < 139 ? [cell('a'), cell('b')]
                : Array.from({ length: 141 }, () => cell('c')),
        })) };
        const small = { type: 'table', content: [{ type: 'tableRow', content: [cell('s1'), cell('s2')] }, { type: 'tableRow', content: [cell('s3'), cell('s4')] }] };
        mount({ type: 'doc', content: [merged, { type: 'paragraph' }, small] });
        let at = null;
        editor.state.doc.descendants((node, pos) => { if (node.isText && node.text === 's1') at = pos; });
        editor.commands.setTextSelection(at + 1);
        // Its span claims 699 cells more: past the limit, so the table plugin's paste would be refused.
        editor.view.pasteHTML('<table><tr><td colspan="700">P1</td></tr><tr><td>P2</td></tr></table>');
        expect(editor.state.doc.textContent).toContain('P1');
        expect(editor.state.doc.textContent).toContain('P2');
        expect(tableCounts(editor.state.doc).excess).toBeLessThanOrEqual(TABLE_GROWTH_LIMIT);
    }, 30000);
});

describe('round 14', () => {
    it('a diagram style element keeps no handler', async () => {
        const { cleanSvg } = await import('../src/utils/cleanSvg.js');
        const out = cleanSvg('<svg xmlns="http://www.w3.org/2000/svg"><style onload="alert(1)">.a{fill:red}</style></svg>', document);
        expect(out.querySelector('style')).not.toBeNull();
        expect(out.querySelector('style').hasAttribute('onload')).toBe(false);
    });

    it('a link or image address that reads as a character reference is no script link in the saved Markdown', () => {
        const turndown = new TurndownService();
        applyInscriptEditorTurndownRules(turndown);
        const markdown = turndown.turndown('<p><a href="&amp;#x6a;avascript:alert(1)">l</a> <img src="&amp;#x6a;avascript:x" alt="i"> <a href="https://a.example/?a=1&amp;b=2">q</a></p>');
        const html = marked.parse(markdown);
        expect(html).not.toMatch(/href="&#x6a;/);
        expect(html).not.toMatch(/src="&#x6a;/);
        // As the browser reads the rendered page: the address as it was, no script link.
        const holder = document.createElement('div');
        holder.innerHTML = html;
        expect(holder.querySelector('a').getAttribute('href')).toBe('&#x6a;avascript:alert(1)');
        expect(holder.querySelector('img').getAttribute('src')).toBe('&#x6a;avascript:x');
        // An ordinary address keeps its `&` (written `&amp;` or `&` by the Markdown renderer, read the same).
        expect(holder.querySelectorAll('a')[1].getAttribute('href')).toBe('https://a.example/?a=1&b=2');
    });

    it('an unpacked table keeps its caption', () => {
        mount(`<table><caption>Kept caption</caption><tr><td colspan="1000">a</td></tr>${'<tr><td>b</td></tr>'.repeat(30)}</table>`);
        expect(editor.state.doc.textContent).toContain('Kept caption');
    });

    it('a merge the size check would refuse is not offered', async () => {
        const { CellSelection } = await import('@tiptap/pm/tables');
        const cell = (text, attrs) => ({ type: 'tableCell', ...(attrs ? { attrs } : {}), content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
        // 142 by 142, its first cell spanning 140 by 140: 19,599 excess cells.
        const merged = { type: 'table', content: Array.from({ length: 142 }, (_, r) => ({
            type: 'tableRow',
            content: r === 0 ? [cell('m', { colspan: 140, rowspan: 140 }), cell('a'), cell('b')]
                : r < 140 ? [cell('a'), cell('b')]
                : Array.from({ length: 142 }, () => cell('c')),
        })) };
        mount({ type: 'doc', content: [merged] });
        // The whole table merged into one cell would come to 20,163 excess cells, past the limit.
        const positions = [];
        let first = null;
        editor.state.doc.descendants((node, pos) => {
            if (node.type.name !== 'tableCell') return;
            if (first === null) first = pos;
            if (node.textContent === 'c') positions.push(pos);
        });
        const { state } = editor;
        editor.view.dispatch(state.tr.setSelection(CellSelection.create(state.doc, first, positions[positions.length - 1])));
        expect(editor.can().mergeCells()).toBe(false);
        expect(editor.commands.mergeCells()).toBe(false);
        // A small merge still is.
        editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, positions[0], positions[1])));
        expect(editor.can().mergeCells()).toBe(true);
    }, 30000);
});

describe('round 15', () => {
    it('a protocol-relative address with controls around it is read as the web address a browser reads', async () => {
        const { protocolRelativeAsWeb, webHref } = await import('../src/utils/url.js');
        expect(protocolRelativeAsWeb('\u0001//cdn.example/a.png ')).toBe('https://cdn.example/a.png');
        expect(webHref('\u0001//cdn.example/a.png')).toBe('https://cdn.example/a.png');
    });

    it('an image height in percent stays a percentage', () => {
        expect(imageHeight('50%')).toBe('50%');
        expect(imageHeight('500%')).toBe('100%');
        expect(imageHeight('120')).toBe(120);
        mount('<img src="https://ok.example/a.png" height="50%">');
        expect(editor.getHTML()).toContain('height="50%"');
    });

    it('a code block has one highlighting plugin that draws decorations', () => {
        mount('<pre><code>x = 1</code></pre>');
        const drawing = editor.state.plugins.filter(plugin => plugin.spec.state && plugin.spec.props?.decorations && /lowlight|CodeHighlight/i.test(String(plugin.key)));
        expect(drawing).toHaveLength(1);
    });
});

describe('round 16', () => {
    it('deeply nested JSON content never overflows the stack while its widths are bounded', async () => {
        const { cleanedContent } = await import('../src/extensions/DocumentValues.js');
        mount('<p>x</p>');
        let node = { type: 'paragraph', content: [{ type: 'text', text: 'deep' }] };
        for (let i = 0; i < 20000; i++) node = { type: 'blockquote', content: [node] };
        const content = { type: 'doc', content: [node, { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colwidth: [99999] }, content: [{ type: 'paragraph' }] }] }] }] };
        const bounded = cleanedContent(editor, content);
        expect(bounded.content[1].content[0].content[0].attrs.colwidth).toEqual([4000]);
        expect(bounded.content[0]).toBe(content.content[0]);
        editor.destroy(); element.remove();
        expect(() => mount(content)).not.toThrow();
    });

    it('a rowspan ends with its row group, as a browser reads it', () => {
        mount('<table><thead><tr><th rowspan="0">H</th><th>I</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>');
        const rows = [];
        editor.state.doc.firstChild.forEach(row => rows.push(row.childCount));
        expect(rows).toEqual([2, 2, 2]);
        expect(editor.getHTML()).not.toContain('rowspan="3"');
    });

    it('a wikilink to no page goes nowhere when clicked', async () => {
        await mountReact('<p><a data-wikilink data-target="A">A</a></p>', { wikilink: { enabled: true } });
        await vi.waitFor(() => expect(element.querySelector('a[data-wikilink]')).not.toBeNull());
        const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
        act(() => { element.querySelector('a[data-wikilink]').dispatchEvent(click); });
        expect(click.defaultPrevented).toBe(true);
    });
});

describe('round 17', () => {
    it('refused values given as JSON are not kept, opened or set, as HTML is read without them', () => {
        const json = { type: 'doc', content: [
            { type: 'paragraph', content: [
                { type: 'text', text: 'share', marks: [{ type: 'link', attrs: { href: 'file://host/x' } }] },
                { type: 'text', text: ' top', marks: [{ type: 'link', attrs: { href: 'https://ok.example/', target: '_top' } }] },
            ] },
            { type: 'image', attrs: { src: '\\\\host\\share\\x.png' } },
            { type: 'image', attrs: { src: '//cdn.example/a.png' } },
        ] };
        const check = () => {
            const out = JSON.stringify(editor.getJSON());
            expect(out).not.toContain('host');
            expect(out).not.toContain('_top');
            expect(out).toContain('https://ok.example/');
            expect(out).toContain('https://cdn.example/a.png');
        };
        mount(json);
        check();
        editor.commands.setContent('<p>x</p>');
        editor.commands.setContent(json);
        check();
        editor.commands.insertContent({ type: 'image', attrs: { src: 'javascript:alert(1)' } });
        expect(JSON.stringify(editor.getJSON())).not.toContain('javascript');
    });

    it('a row or column the size check would refuse is not offered', async () => {
        const cell = (text, attrs) => ({ type: 'tableCell', ...(attrs ? { attrs } : {}), content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
        // A header row of 100 cells over 199 rows of one cell spanning all 100: 19,701 excess cells.
        const table = { type: 'table', content: [
            { type: 'tableRow', content: Array.from({ length: 100 }, () => cell('h')) },
            ...Array.from({ length: 199 }, () => ({ type: 'tableRow', content: [cell('w', { colspan: 100 })] })),
        ] };
        mount({ type: 'doc', content: [table] });
        // In the first header cell: a column added after it runs through the 199 spanning cells.
        const intoFirstCell = () => {
            let first = null;
            editor.state.doc.descendants((node, pos) => { if (first === null && node.type.name === 'tableCell') first = pos; });
            editor.commands.setTextSelection(first + 2);
        };
        intoFirstCell();
        // One more column: 19,900 excess cells, within the limit; a second would take it past.
        expect(editor.can().addColumnAfter()).toBe(true);
        expect(editor.commands.addColumnAfter()).toBe(true);
        intoFirstCell();
        expect(editor.can().addColumnAfter()).toBe(false);
        expect(editor.commands.addColumnAfter()).toBe(false);
        // A row crosses no span: still offered.
        expect(editor.can().addRowAfter()).toBe(true);
    }, 30000);

    it('a link clicked in a history preview never takes the page anywhere', async () => {
        const { HistoryView } = await import('../src/components/HistoryView.jsx');
        const history = [{ html: '<p>a</p>', timestamp: Date.now() - 1000 }, { html: '<p><a href="https://other.example/" target="_top">b</a> <a href="/same">c</a></p>', timestamp: Date.now() }];
        mount('<p>x</p>');
        const open = vi.fn();
        setExternalOpener(editor, open);
        const view = render(<HistoryView history={history} originalHtml={history[0].html} currentIndex={1} onSelect={() => {}} editor={editor} />);
        await vi.waitFor(() => expect(view.container.querySelector('[data-history-preview] a')).not.toBeNull());
        const anchors = [...view.container.querySelectorAll('[data-history-preview] a')];
        expect(anchors.some(a => a.hasAttribute('target'))).toBe(false);
        for (const anchor of anchors) {
            const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
            act(() => { anchor.dispatchEvent(click); });
            expect(click.defaultPrevented).toBe(true);
        }
        expect(open).toHaveBeenCalledWith('https://other.example/');
        view.unmount();
    });
});

describe('round 18', () => {
    it('a refused image source set by an attribute step is not kept', () => {
        mount('<p>a</p><img src="https://ok.example/a.png">');
        let at = null;
        editor.state.doc.descendants((node, pos) => { if (node.type.name === 'image') at = pos; });
        editor.view.dispatch(editor.state.tr.setNodeAttribute(at, 'src', 'javascript:alert(1)'));
        expect(JSON.stringify(editor.getJSON())).not.toContain('javascript');
    });

    it('content given as a ProseMirror node is cleaned and bounded as JSON is', async () => {
        const { tableCounts, TABLE_GROWTH_LIMIT } = await import('../src/utils/tableSize.js');
        mount('<p>x</p>');
        const cell = (text, attrs) => ({ type: 'tableCell', ...(attrs ? { attrs } : {}), content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
        const node = editor.schema.nodeFromJSON({ type: 'doc', content: [
            { type: 'table', content: [{ type: 'tableRow', content: [cell('w', { colspan: 30000 })] }, { type: 'tableRow', content: [cell('r')] }] },
            { type: 'image', attrs: { src: '\\\\host\\share\\a.png' } },
        ] });
        editor.destroy(); element.remove();
        mount(node);
        expect(tableCounts(editor.state.doc).excess).toBeLessThanOrEqual(TABLE_GROWTH_LIMIT);
        expect(JSON.stringify(editor.getJSON())).not.toContain('host');
    });

    it('a code block\'s language set on its own is highlighted again', async () => {
        mount('<p>x</p><pre><code class="language-plaintext">def f(): return 1</code></pre>');
        let at = null;
        editor.state.doc.descendants((node, pos) => { if (node.type.name === 'codeBlock') at = pos; });
        editor.commands.setTextSelection(1);
        editor.view.dispatch(editor.state.tr.setNodeAttribute(at, 'language', 'python'));
        await vi.waitFor(() => expect(element.querySelector('pre [class*="hljs-keyword"]')).not.toBeNull());
    });
});

describe('round 19', () => {
    it('a link set by a mark step is kept only as the editor keeps links', () => {
        mount('<p>abc def</p>');
        editor.commands.setTextSelection({ from: 1, to: 4 });
        editor.commands.setMark('link', { href: '//example.com/x', target: '_top', class: 'fixed inset-0' });
        editor.commands.setTextSelection({ from: 5, to: 8 });
        editor.commands.setMark('link', { href: '\\\\host\\share' });
        const out = JSON.stringify(editor.getJSON());
        expect(out).toContain('https://example.com/x');
        expect(out).not.toContain('_top');
        expect(out).not.toContain('inset-0');
        expect(out).not.toContain('host');
    });

    it('a link on an inline atom is kept only as the editor keeps links', () => {
        mount('<p>a</p>');
        editor.commands.insertContent([{ type: 'hardBreak', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)', class: 'evil' } }] }]);
        const out = JSON.stringify(editor.getJSON());
        expect(out).not.toContain('javascript');
        expect(out).not.toContain('evil');
    });

    it('a merge or a column that would make a span HTML cannot read back is not offered', async () => {
        const { CellSelection } = await import('@tiptap/pm/tables');
        const row = () => ({ type: 'tableRow', content: Array.from({ length: 1001 }, () => ({ type: 'tableCell', content: [{ type: 'paragraph' }] })) });
        mount({ type: 'doc', content: [{ type: 'table', content: [row(), row()] }] });
        const cells = [];
        editor.state.doc.firstChild.firstChild.forEach((_cell, offset) => cells.push(2 + offset));
        editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cells[0], cells[cells.length - 1])));
        expect(editor.can().mergeCells()).toBe(false);
        editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cells[0], cells[1])));
        expect(editor.can().mergeCells()).toBe(true);
    }, 30000);
});

describe('round 20', () => {
    it('spans given as JSON are kept as HTML reads them back, opened or set', () => {
        const json = colspan => ({ type: 'doc', content: [{ type: 'table', content: [
            { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan, rowspan: 70000 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'w' }] }] }] },
        ] }] });
        const spans = () => { let found = null; editor.state.doc.descendants(node => { if (node.type.name === 'tableCell') found = [node.attrs.colspan, node.attrs.rowspan]; }); return found; };
        mount(json(5000));
        expect(spans()).toEqual([1000, 1]);
        editor.commands.setContent(json('3000'));
        expect(spans()).toEqual([1000, 1]);
        const html = editor.getHTML();
        editor.commands.setContent(html);
        expect(spans()).toEqual([1000, 1]);
    });
});

describe('round 21', () => {
    it('an edit inside a code block is highlighted wherever the selection is', async () => {
        mount('<p>x</p><pre><code class="language-javascript">a = 1</code></pre>');
        let inside = null;
        editor.state.doc.descendants((node, pos) => { if (node.type.name === 'codeBlock') inside = pos + 1; });
        editor.commands.setTextSelection(1);
        editor.view.dispatch(editor.state.tr.insertText('let b = "x"; ', inside));
        await vi.waitFor(() => expect(element.querySelector('pre [class*="hljs-keyword"]')).not.toBeNull());
    });

    it('sizes, a code language and a font size given as JSON are kept as HTML reads them', () => {
        mount({ type: 'doc', content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'big', marks: [{ type: 'textStyle', attrs: { fontSize: '99999px' } }] }] },
            { type: 'image', attrs: { src: 'https://ok.example/a.png', width: '999999px', height: 99999, align: 'everywhere' } },
            { type: 'codeBlock', attrs: { language: 'js fixed inset-0' }, content: [{ type: 'text', text: 'x' }] },
        ] });
        const out = JSON.stringify(editor.getJSON());
        expect(out).not.toMatch(/99999|999999px|everywhere|inset-0/);
        editor.commands.setTextSelection({ from: 1, to: 4 });
        editor.commands.setMark('textStyle', { fontSize: '5000px' });
        expect(JSON.stringify(editor.getJSON())).not.toContain('5000px');
    });

    it('a click on a link\'s text is a click on the link', async () => {
        const { clickedLink } = await import('../src/extensions/HostBridge.js');
        const holder = document.createElement('div');
        holder.innerHTML = '<a href="https://ok.example/">text</a>';
        expect(clickedLink({ target: holder.querySelector('a').firstChild }, holder)).toBe(holder.querySelector('a'));
    });
});

describe('round 22', () => {
    it('a code block turned into a paragraph keeps no highlighting', async () => {
        mount('<pre><code class="language-javascript">const a = 1;</code></pre>');
        await vi.waitFor(() => expect(element.querySelector('pre [class*="hljs-"]')).not.toBeNull());
        editor.commands.setTextSelection(2);
        editor.commands.setParagraph();
        expect(element.querySelector('p [class*="hljs-"]')).toBeNull();
    });

    it('a video id and a text alignment given as JSON are kept as HTML reads them', () => {
        mount({ type: 'doc', content: [
            { type: 'paragraph', attrs: { textAlign: 'everywhere' }, content: [{ type: 'text', text: 'a' }] },
            { type: 'youtube', attrs: { 'data-youtube-video': 'abc/../x?y=1' } },
        ] });
        const out = JSON.stringify(editor.getJSON());
        expect(out).not.toContain('everywhere');
        expect(out).not.toContain('abc/../x');
    });

    it('a host opener that throws still keeps the link from replacing the page', async () => {
        const { openOutside } = await import('../src/extensions/HostBridge.js');
        mount('<p>x</p>');
        setExternalOpener(editor, () => { throw new Error('bridge not ready'); });
        expect(openOutside(editor, 'https://other.example/', { baseURI: 'https://site.example/' })).toBe(true);
    });

    it('footnote numbers follow a reference put in before the others', async () => {
        await mountReact('<p>a<sup data-footnote-ref="f1"></sup> b<sup data-footnote-ref="f2"></sup></p>');
        await vi.waitFor(() => expect(element.textContent).toContain('2'));
        editor.commands.insertContentAt(1, { type: 'footnoteReference', attrs: { id: 'f0' } });
        await vi.waitFor(() => expect(element.textContent).toContain('3'));
    });
});

describe('round 23', () => {
    it('JSON whose only image is refused opens as a valid document', () => {
        mount({ type: 'doc', content: [{ type: 'image', attrs: { src: '\\\\host\\share\\a.png' } }] });
        expect(() => editor.state.doc.check()).not.toThrow();
        editor.destroy(); element.remove();
        mount({ type: 'doc', content: [{ type: 'blockquote', content: [{ type: 'image', attrs: { src: 'javascript:alert(1)' } }] }] });
        expect(() => editor.state.doc.check()).not.toThrow();
    });

    it('a diagram\'s own quoted or spaced url(#…) references are kept', async () => {
        const { cleanSvg } = await import('../src/utils/cleanSvg.js');
        const out = cleanSvg('<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:url("#g")}</style><rect fill="url(\'#g\')" filter="url( #s)"></rect></svg>', document);
        expect(out.querySelector('style')).not.toBeNull();
        expect(out.querySelector('rect').getAttribute('fill')).toBe("url('#g')");
        expect(out.querySelector('rect').getAttribute('filter')).toBe('url( #s)');
        expect(cleanSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(\'https://x.example/a\')"></rect></svg>', document).querySelector('rect').hasAttribute('fill')).toBe(false);
    });
});

describe('round 24', () => {
    it('a JSON table set with a huge span is kept as a table, its span capped, as when opened', () => {
        const json = { type: 'doc', content: [{ type: 'table', content: [
            { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 100000 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] }] },
        ] }] };
        mount('<p>x</p>');
        editor.commands.setContent(json);
        let tables = 0;
        editor.state.doc.descendants(node => { if (node.type.name === 'table') tables += 1; });
        expect(tables).toBe(1);
        expect(editor.getHTML()).toContain('colspan="1000"');
    });

    it('a history preview holds no element for a page\'s Mermaid to draw', () => {
        const out = inertPreviewHtml('<div class="mermaid" data-mermaid="graph TD; A-->B">graph TD; A-->B</div>');
        expect(out).not.toMatch(/class="[^"]*\bmermaid\b/);
    });
});

describe('round 25', () => {
    it('content that holds itself is refused, never walked for ever', async () => {
        const { mapJsonNodes } = await import('../src/utils/jsonContent.js');
        const node = { type: 'blockquote', content: [] };
        node.content.push(node);
        expect(() => mapJsonNodes({ type: 'doc', content: [node] }, n => n)).toThrow(RangeError);
    });

    it('a span written with more digits than a number holds is read as a browser reads it: the limit', async () => {
        const { htmlSpan } = await import('../src/utils/parseDom.js');
        expect(htmlSpan('1'.repeat(400), 1000)).toBe(1000);
    });

    it('a link to the page\'s own site in a version opens outside, never in place of the page', async () => {
        const { HistoryView } = await import('../src/components/HistoryView.jsx');
        const history = [{ html: '<p>a</p>', timestamp: Date.now() - 1000 }, { html: '<p><a href="/docs/page">own</a></p>', timestamp: Date.now() }];
        mount('<p>x</p>');
        const open = vi.fn();
        setExternalOpener(editor, open);
        const view = render(<HistoryView history={history} originalHtml={history[0].html} currentIndex={1} onSelect={() => {}} editor={editor} />);
        await vi.waitFor(() => expect(view.container.querySelector('[data-history-preview] a')).not.toBeNull());
        const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
        act(() => { view.container.querySelector('[data-history-preview] a').dispatchEvent(click); });
        expect(click.defaultPrevented).toBe(true);
        expect(open).toHaveBeenCalledTimes(1);
        view.unmount();
    });
});

describe('round 26', () => {
    it('anything but a cell in a JSON row hides no excess from the size check at creation', async () => {
        const { tableCounts, TABLE_GROWTH_LIMIT } = await import('../src/utils/tableSize.js');
        const cell = (text, attrs) => ({ type: 'tableCell', ...(attrs ? { attrs } : {}), content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
        const padding = Array.from({ length: 999 }, () => ({ type: 'text', text: 'p' }));
        mount({ type: 'doc', content: [{ type: 'table', content: [
            { type: 'tableRow', content: [cell('w', { colspan: 1000 })] },
            ...Array.from({ length: 29 }, () => ({ type: 'tableRow', content: [cell('r'), ...padding] })),
        ] }] });
        expect(tableCounts(editor.state.doc).excess).toBeLessThanOrEqual(TABLE_GROWTH_LIMIT);
    });
});

describe('round 27', () => {
    it('a frame whose address is a bare 11-letter word is no YouTube video', () => {
        mount('<iframe src="development"></iframe>');
        // A generic embed at most, which loads no relative address (see Embed's webHref).
        expect(JSON.stringify(editor.getJSON())).not.toContain('youtube');
    });
});

describe('round 28', () => {
    it('a mail link in a version is left to the browser (the reader\'s mail app)', async () => {
        const { HistoryView } = await import('../src/components/HistoryView.jsx');
        const history = [{ html: '<p>a</p>', timestamp: Date.now() - 1000 }, { html: '<p><a href="mailto:a@b.example">mail</a></p>', timestamp: Date.now() }];
        mount('<p>x</p>');
        const view = render(<HistoryView history={history} originalHtml={history[0].html} currentIndex={1} onSelect={() => {}} editor={editor} />);
        await vi.waitFor(() => expect(view.container.querySelector('[data-history-preview] a')).not.toBeNull());
        const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
        act(() => { view.container.querySelector('[data-history-preview] a').dispatchEvent(click); });
        expect(click.defaultPrevented).toBe(false);
        view.unmount();
    });
});

describe('round 29', () => {
    it('a footnote definition given another reference\'s id takes its number', async () => {
        await mountReact('<p>a<sup data-footnote-ref="f1"></sup> b<sup data-footnote-ref="f2"></sup></p><section data-footnotes><div data-footnote-id="f1"><p>one</p></div></section>');
        let def = null;
        editor.state.doc.descendants((node, pos) => { if (node.type.name === 'footnoteDefinition') def = pos; });
        expect(def).not.toBeNull();
        const plugin = editor.state.plugins.find(p => String(p.key).startsWith('inscriptFootnoteNumbers'));
        const numberAt = pos => plugin.getState(editor.state).find(pos, pos + 1).find(d => d.from === pos)?.spec.footnoteNumber;
        expect(numberAt(def)).toBe(1);
        editor.view.dispatch(editor.state.tr.setNodeAttribute(def, 'id', 'f2'));
        expect(numberAt(def)).toBe(2);
    });
});
