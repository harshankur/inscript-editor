import { describe, it, expect, afterEach } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { applyInscriptEditorTurndownRules } from '../markdown/turndownRules.js';

describe('HtmlComment extension (source <!-- --> comments)', () => {
    let editor;
    afterEach(() => editor?.destroy());

    const commentsOf = ed => {
        const found = [];
        ed.state.doc.descendants(n => { if (n.type.name === 'htmlComment') found.push(n.attrs.text); });
        return found;
    };

    it('parses the inline data-html-comment span with its text verbatim', () => {
        editor = createEditor({ content: '<p>Hello <span data-html-comment=" a note "></span> world.</p>' });
        expect(commentsOf(editor)).toEqual([' a note ']);
    });

    it('keeps a block-level comment (between paragraphs) by wrapping it in its own paragraph', () => {
        editor = createEditor({ content: '<p>One.</p><span data-html-comment=" block note "></span><p>Two.</p>' });
        expect(commentsOf(editor)).toEqual([' block note ']);
        expect(editor.getHTML()).toBe('<p>One.</p><p><span data-html-comment=" block note "></span></p><p>Two.</p>');
    });

    it('serializes back to the exact canonical shape, byte-for-byte text (quotes, &, tags, newlines)', () => {
        const text = ' line one\n\n  - "quoted" & <b>not bold</b> ';
        editor = createEditor();
        editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'htmlComment', attrs: { text } }] }] });
        const html = editor.getHTML();
        expect(html).toMatch(/^<p><span data-html-comment="[^"]*"><\/span><\/p>$/);
        // Re-parse what we emitted: the text must come back unchanged.
        const again = createEditor({ content: html });
        expect(commentsOf(again)).toEqual([text]);
        again.destroy();
    });

    it('shows a non-editable chip whose content is text only, never markup', () => {
        const payload = ' <img src=x onerror="alert(1)"><script>alert(2)</script> ';
        const host = document.createElement('div');
        document.body.appendChild(host);
        editor = createEditor({ element: host, content: '<p>a<span data-html-comment="' + payload.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"></span>b</p>' });
        const chip = host.querySelector('.html-comment');
        expect(chip).not.toBeNull();
        expect(chip.getAttribute('contenteditable')).toBe('false');
        expect(chip.getAttribute('role')).toBe('note');
        expect(chip.getAttribute('aria-label')).toBeTruthy();
        expect(chip.textContent).toBe(`<!--${payload.replace(/\s+/g, ' ')}-->`);
        expect(chip.title).toBe(payload.trim());
        expect(host.querySelector('img, script')).toBeNull(); // the payload never became elements
        host.remove();
    });

    it('can be turned off with htmlComment: false', () => {
        editor = createEditor({}, { htmlComment: false });
        expect(editor.schema.nodes.htmlComment).toBeUndefined();
    });
});

// Through a real TurndownService: the comment span is empty, and turndown treats empty
// elements as blank before consulting any rule, so a stubbed addRule would hide that.
describe('turndown rule for source comments', () => {
    const toMd = html => {
        const td = new TurndownService();
        td.use(gfm);
        applyInscriptEditorTurndownRules(td);
        return td.turndown(html);
    };
    const para = text => `<p>a<span data-html-comment="${text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"></span>b</p>`;

    it('writes a real comment, verbatim, for the (empty) comment span', () => {
        // Turndown collapses the two spaces around the invisible node into one, as a browser would.
        expect(toMd('<p>Before <span data-html-comment=" note "></span> after</p>')).toBe('Before <!-- note -->after');
    });

    it('leaves other empty spans alone', () => {
        expect(toMd('<p>a<span></span>b</p>')).toBe('ab');
    });

    it('neutralizes sequences that would close the comment early', () => {
        expect(toMd(para(' x --> <script>'))).toBe('a<!-- x --&gt; <script>-->b');
        expect(toMd(para(' x --!> y'))).toBe('a<!-- x --!&gt; y-->b');
        expect(toMd(para('> y'))).toBe('a<!--&gt; y-->b');
        expect(toMd(para('-> y'))).toBe('a<!---&gt; y-->b');
    });
});
