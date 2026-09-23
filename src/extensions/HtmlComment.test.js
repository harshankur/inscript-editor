import { describe, it, expect, afterEach } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';
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

describe('turndown rule for source comments', () => {
    const rules = {};
    applyInscriptEditorTurndownRules({ addRule: (name, rule) => { rules[name] = rule; } });
    const rule = rules.inscriptHtmlComment;
    const span = text => {
        const el = document.createElement('span');
        el.setAttribute('data-html-comment', text);
        return el;
    };

    it('matches only the comment span', () => {
        expect(rule.filter(span(' x '))).toBe(true);
        expect(rule.filter(document.createElement('span'))).toBe(false);
    });

    it('writes a real comment, verbatim', () => {
        expect(rule.replacement('', span(' a hidden note '))).toBe('<!-- a hidden note -->');
    });

    it('neutralizes sequences that would close the comment early', () => {
        expect(rule.replacement('', span(' x --> <script>'))).toBe('<!-- x --&gt; <script>-->');
        expect(rule.replacement('', span(' x --!> y'))).toBe('<!-- x --!&gt; y-->');
        expect(rule.replacement('', span('> y'))).toBe('<!--&gt; y-->');
        expect(rule.replacement('', span('-> y'))).toBe('<!---&gt; y-->');
    });
});
