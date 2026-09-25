import { afterEach, describe, expect, it } from 'vitest';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { applyInscriptEditorTurndownRules } from './turndownRules.js';
import { createEditor } from '../../tests/helpers/createEditor.js';

// Every test goes through a real TurndownService: turndown decides "blank" before any rule
// runs, so a stubbed addRule can't tell whether a rule is ever reached.
const makeTurndown = ({ withGfm = true } = {}) => {
    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    if (withGfm) td.use(gfm);
    applyInscriptEditorTurndownRules(td);
    return td;
};
const toMd = (html, opts) => makeTurndown(opts).turndown(html);

describe('applyInscriptEditorTurndownRules (real TurndownService)', () => {
    let editor;
    afterEach(() => editor?.destroy());
    // Serialize through the editor, so the tests cover the HTML it actually emits.
    const editorHtml = html => {
        editor = createEditor({ content: html });
        return editor.getHTML();
    };

    it('keeps a source comment (an empty span, which turndown calls blank)', () => {
        expect(toMd('<p>Before <span data-html-comment=" note "></span> after</p>')).toContain('<!-- note -->');
    });

    it('keeps a gated embed (an empty div) in a shape the editor parses back', () => {
        const md = toMd(editorHtml('<div data-embed-src="https://example.com/embed" data-embed-gated="true"></div>'));
        expect(md).toContain('data-embed-src="https://example.com/embed"');
        editor.destroy();
        editor = createEditor({ content: md });
        expect(editor.state.doc.firstChild.type.name).toBe('embed');
        expect(editor.state.doc.firstChild.attrs.src).toBe('https://example.com/embed');
    });

    it('keeps a citation with its key, label and details', () => {
        const md = toMd(editorHtml('<p>Claim <span class="citation" data-key="knuth84" data-label="Knuth 1984" title="The TeXbook">[Knuth 1984]</span>.</p>'));
        expect(md).toContain('data-key="knuth84"');
        expect(md).toContain('title="The TeXbook"');
        expect(md).not.toContain('\\[');
    });

    it('writes checklist items as GFM task items with their checked state', () => {
        const md = toMd(editorHtml('<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done</p></li><li data-type="taskItem" data-checked="false"><p>Todo</p></li></ul>'));
        // Laid out like turndown's own lists of <p>-wrapped items (the editor wraps every item).
        expect(md).toBe('*   [x] Done\n    \n*   [ ] Todo');
    });

    it('indents a nested checklist under its parent item', () => {
        const md = toMd(editorHtml('<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Parent</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Child</p></li></ul></li></ul>'));
        expect(md).toMatch(/^\*   \[ \] Parent\n {4}\n {4}\*   \[x\] Child$/);
    });

    it('writes a plain editor table as a GFM table', () => {
        const md = toMd(editorHtml('<table><tbody><tr><th>Item</th><th>NOK</th></tr><tr><td>Ferry</td><td>210</td></tr></tbody></table>'));
        expect(md).toBe('| Item | NOK |\n| --- | --- |\n| Ferry | 210 |');
    });

    it('writes GFM tables without the gfm plugin too', () => {
        const md = toMd(editorHtml('<table><tbody><tr><th>A</th></tr><tr><td>b</td></tr></tbody></table>'), { withGfm: false });
        expect(md).toBe('| A |\n| --- |\n| b |');
    });

    it('keeps inline formatting, escapes pipes and turns hard breaks into <br> inside cells', () => {
        const md = toMd(editorHtml('<table><tbody><tr><th>Name</th></tr><tr><td><p><strong>a|b</strong><br>c</p></td></tr></tbody></table>'));
        expect(md).toBe('| Name |\n| --- |\n| **a\\|b**<br>c |');
    });

    it.each([
        ['merged cells', '<table><tbody><tr><th colspan="2">Both</th></tr><tr><td>a</td><td>b</td></tr></tbody></table>'],
        ['a resized column', '<table><tbody><tr><th colwidth="120">A</th></tr><tr><td colwidth="120">b</td></tr></tbody></table>'],
        ['a multi-paragraph cell', '<table><tbody><tr><th>A</th></tr><tr><td><p>one</p><p>two</p></td></tr></tbody></table>'],
        ['no header row', '<table><tbody><tr><td>a</td></tr><tr><td>b</td></tr></tbody></table>'],
        ['a header column', '<table><tbody><tr><th>A</th><th>B</th></tr><tr><th>x</th><td>y</td></tr></tbody></table>'],
        ['a left-aligned table', '<table data-align="left"><tbody><tr><th>A</th></tr><tr><td>b</td></tr></tbody></table>'],
    ])('keeps a table with %s as HTML, so nothing is lost', (label, html) => {
        const md = toMd(editorHtml(html));
        expect(md.startsWith('<table')).toBe(true);
        expect(md).not.toContain('| --- |');
    });

    it('keeps YouTube videos and laid-out images as HTML, and plain images as Markdown', () => {
        expect(toMd('<div data-youtube-video="dQw4w9WgXcQ" data-width="50%" data-align="left" class="youtube-embed"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div>'))
            .toContain('data-youtube-video="dQw4w9WgXcQ"');
        expect(toMd('<p><img src="a.png" alt="A" data-width="50%" data-align="center"></p>')).toBe('<img src="a.png" alt="A" data-width="50%" data-align="center">');
        expect(toMd('<p><img src="a.png" alt="A" data-width="100%" data-align="center"></p>')).toBe('![A](a.png)');
    });

    it('lets a host rule registered afterwards win (e.g. a YouTube shortcode)', () => {
        const td = makeTurndown();
        td.addRule('youtube', {
            filter: node => node.nodeName === 'DIV' && node.hasAttribute('data-youtube-video'),
            replacement: (c, node) => `{{< youtube ${node.getAttribute('data-youtube-video')} >}}`,
        });
        expect(td.turndown('<div data-youtube-video="dQw4w9WgXcQ"><iframe src="x"></iframe></div>')).toBe('{{< youtube dQw4w9WgXcQ >}}');
    });

    it('still accepts a duck-typed { addRule } service', () => {
        const rules = {};
        expect(() => applyInscriptEditorTurndownRules({ addRule: (key, rule) => { rules[key] = rule; } })).not.toThrow();
        expect(Object.keys(rules)).toEqual(expect.arrayContaining(['inscriptHtmlComment', 'inscriptEmbed', 'inscriptCitation', 'inscriptTaskItem', 'inscriptTable']));
    });

    it('leaves other blank elements to turndown', () => {
        expect(toMd('<p>a</p><div></div><p>b</p>')).toBe('a\n\nb');
    });
});
