// Targeted toolbar behaviours found through the matrix (toolbar-matrix.explore.jsx).
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from '@tiptap/pm/state';
import { ALL_TOOL_IDS } from '../../src/toolbar/toolRegistry.js';
import { renderHost, stubClientWidth, flush } from './harness.jsx';

vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: () => null,
    FloatingMenu: () => null,
}));

let restoreWidth;
beforeEach(() => {
    restoreWidth = stubClientWidth(100000);
    vi.spyOn(window, 'prompt').mockImplementation(() => 'key2026');
});
afterEach(() => { restoreWidth(); vi.restoreAllMocks(); });

async function setup(html, hook = {}, props = {}) {
    const r = renderHost({ initialContent: html, ...hook }, { toolbarConfig: ALL_TOOL_IDS, ...props });
    await flush();
    return { ...r, editor: r.api.current.editor };
}
const posOfText = (editor, text) => {
    let pos = null;
    editor.state.doc.descendants((n, p) => { if (pos === null && n.isText && n.text.includes(text)) pos = p + n.text.indexOf(text); });
    return pos;
};
const dropdownPrimary = (chevronTitle) => screen.getByTitle(chevronTitle).previousElementSibling.previousElementSibling;

describe('alignment dropdown', () => {
    it('picking Align Center centres the paragraph and lights the control', async () => {
        const { editor } = await setup('<p>hello</p>');
        act(() => { editor.commands.setTextSelection(2); });
        await act(async () => { fireEvent.click(screen.getByTitle('Text Alignment')); });
        await act(async () => { fireEvent.click(screen.getByText('Align Center')); });
        expect(editor.getHTML()).toContain('text-align: center');
        expect(dropdownPrimary('Text Alignment').getAttribute('title')).toBe('Align Center');
    });
});

describe('admonition dropdown', () => {
    it('inside a Tip admonition the control shows Tip as the active type', async () => {
        const { editor } = await setup('<div class="admonition" data-type="tip"><p>careful</p></div>');
        act(() => { editor.commands.setTextSelection(posOfText(editor, 'careful') + 1); });
        expect(editor.isActive('admonition', { admonitionType: 'tip' })).toBe(true);
        const primary = dropdownPrimary('Admonitions');
        expect(primary.getAttribute('title')).toBe('Tip');
        expect(primary.className).toMatch(/shadow-inner/);
        await act(async () => { fireEvent.click(screen.getByTitle('Admonitions')); });
        // "Tip" is also the admonition's own header: the dropdown's item is the one in a button.
        const tipItem = screen.getAllByText('Tip').map(el => el.closest('button')).find(Boolean);
        expect(tipItem.className).toMatch(/font-medium/);
    });

    it('picking Warning while inside a Tip changes the type instead of nesting a second admonition', async () => {
        const { editor } = await setup('<div class="admonition" data-type="tip"><p>careful</p></div>');
        act(() => { editor.commands.setTextSelection(posOfText(editor, 'careful') + 1); });
        await act(async () => { fireEvent.click(screen.getByTitle('Admonitions')); });
        await act(async () => { fireEvent.click(screen.getByText('Warning')); });
        const html = editor.getHTML();
        expect(html.match(/class="admonition/g)?.length).toBe(1);
        expect(html).toContain('data-type="warning"');
    });
});

describe('definition list tool', () => {
    it.each([
        ['bullet list item', '<ul><li><p>item one</p></li></ul>'],
        ['task list item', '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>task one</p></li></ul>'],
    ])('in a %s leaves a valid caret and adds no empty paragraph', async (_, html) => {
        const { editor } = await setup(html);
        act(() => { editor.commands.setTextSelection(5); });
        await act(async () => { fireEvent.click(screen.getByTitle('Definition List')); });
        const sel = editor.state.selection;
        expect(sel instanceof TextSelection && sel.$from.parent.inlineContent).toBe(true);
        expect(editor.getHTML()).not.toMatch(/<li[^>]*>(<label>.*?<\/label><div>)?<p><\/p><dl>/);
    });

    it('with an image selected it does not convert the paragraph after the image', async () => {
        const { editor } = await setup('<p>before</p><img src="https://e.com/a.png"><p>after</p>');
        let pos = null;
        editor.state.doc.descendants((n, p) => { if (n.type.name === 'image') pos = p; });
        act(() => { editor.commands.setNodeSelection(pos); });
        await act(async () => { fireEvent.click(screen.getByTitle('Definition List')); });
        expect(editor.getHTML()).not.toContain('<dt>after</dt>');
    });
});

describe('inline inserts with the caret in a code block', () => {
    it.each([['Footnote'], ['Citation']])('%s does not turn the rest of the code line into a paragraph', async (title) => {
        const { editor } = await setup('<pre><code>const a = 1;</code></pre>');
        act(() => { editor.commands.setTextSelection(3); });
        await act(async () => { fireEvent.click(screen.getByTitle(title)); });
        const code = editor.state.doc.firstChild;
        // Either the tool refuses in code, or it leaves the code intact: the code text must stay code.
        let codeText = '';
        editor.state.doc.descendants((n) => { if (n.type.name === 'codeBlock') codeText += n.textContent; });
        expect(codeText).toBe('const a = 1;');
        expect(code.type.name).toBe('codeBlock');
    });
});

describe('media and meta tools without a host handler', () => {
    it.each([['Insert Image'], ['Embed YouTube Video'], ['Manage Tags & Categories'], ['Insert Wikilink']])('%s is not offered as a live button that does nothing', async (title) => {
        const { editor } = await setup('<p>x</p>');
        const before = editor.getHTML();
        const btn = screen.queryByTitle(title);
        // Expected: hidden or disabled when there is nothing to call (as the slash menu does).
        if (btn) {
            const prompt = window.prompt;
            fireEvent.click(btn);
            const didSomething = editor.getHTML() !== before || prompt.mock.calls.length > 0;
            expect(btn.disabled || didSomething).toBe(true);
        }
    });
});

describe('marks in a code block', () => {
    it.each([['Bold'], ['Italic'], ['Inline Code']])('%s does not light up in a code block where it cannot apply', async (title) => {
        const { editor } = await setup('<pre><code>const a = 1;</code></pre>');
        act(() => { editor.commands.setTextSelection(3); });
        await act(async () => { fireEvent.click(screen.getByTitle(title)); });
        expect(screen.getByTitle(title).className).not.toMatch(/shadow-inner/);
    });
});

describe('active states follow the cursor', () => {
    it('heading buttons track the block under the caret as it moves', async () => {
        const { editor } = await setup('<h2>title</h2><p>body</p>');
        act(() => { editor.commands.setTextSelection(2); });
        expect(screen.getByTitle('Heading 2').className).toMatch(/shadow-inner/);
        act(() => { editor.commands.setTextSelection(posOfText(editor, 'body') + 1); });
        expect(screen.getByTitle('Heading 2').className).not.toMatch(/shadow-inner/);
    });

    it.each([[1234, true], [1234, false], [99, false], [7, false]])('a seeded random walk of clicks (seed %i, with Definition List %s) never throws and keeps the doc valid', async (seed, withDl) => {
        const { prng } = await import('./harness.jsx');
        const rand = prng(seed);
        const { editor } = await setup('<p>alpha beta gamma</p><ul><li><p>one</p></li></ul><pre><code>x</code></pre>');
        const titles = ['Heading 1', 'Heading 2', 'Bold', 'Italic', 'Bullet List', 'Numbered List', 'Task List', 'Quote', 'Code Block', 'Divider', ...(withDl ? ['Definition List'] : []), 'Clear Formatting', 'Inline Code', 'Subscript', 'Superscript', 'Strikethrough', 'Underline'];
        const errors = [];
        vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')));
        for (let i = 0; i < 300; i++) {
            const size = editor.state.doc.content.size;
            const a = 1 + Math.floor(rand() * Math.max(1, size - 1));
            const b = rand() < 0.5 ? a : Math.min(size - 1, a + Math.floor(rand() * 6));
            act(() => {
                const { doc, tr } = editor.state;
                const $a = TextSelection.near(doc.resolve(a)).$head;
                const $b = TextSelection.near(doc.resolve(b)).$head;
                editor.view.dispatch(tr.setSelection(TextSelection.between($a, $b)));
            });
            const pre = editor.state.selection;
            if (pre instanceof TextSelection && !(pre.$from.parent.inlineContent && pre.$to.parent.inlineContent)) continue;
            const title = titles[Math.floor(rand() * titles.length)];
            await act(async () => { fireEvent.click(screen.getByTitle(title)); });
            editor.state.doc.check();
            const sel = editor.state.selection;
            if (sel instanceof TextSelection && !(sel.$from.parent.inlineContent && sel.$to.parent.inlineContent)) {
                throw new Error(`step ${i}: ${title} left an invalid text selection ${JSON.stringify(sel.toJSON())} in ${editor.getHTML()}`);
            }
        }
        expect(errors).toEqual([]);
    });
});

describe('abbreviation toggle', () => {
    it('with the caret inside an abbreviation, the Abbreviation button removes it', async () => {
        const { editor } = await setup('<p><abbr title="HyperText Markup Language">HTML</abbr> rocks</p>');
        act(() => { editor.commands.setTextSelection(3); });
        expect(screen.getByTitle('Abbreviation').className).toMatch(/shadow-inner/);
        await act(async () => { fireEvent.click(screen.getByTitle('Abbreviation')); });
        expect(editor.getHTML()).not.toContain('<abbr');
    });

    it('with the caret inside an abbreviation, Clear Formatting removes it', async () => {
        const { editor } = await setup('<p><abbr title="X">HTML</abbr> rocks</p>');
        act(() => { editor.commands.setTextSelection({ from: 1, to: 5 }); });
        await act(async () => { fireEvent.click(screen.getByTitle('Clear Formatting')); });
        expect(editor.getHTML()).not.toContain('<abbr');
    });
});

describe('host handlers win over prompts', () => {
    it('onAddAbbreviation / onAddCitation / onAddWikilink from editorOptions are called and no prompt opens', async () => {
        const onAddAbbreviation = vi.fn(); const onAddCitation = vi.fn(); const onAddWikilink = vi.fn();
        await setup('<p>x</p>', { editorOptions: { onAddAbbreviation, onAddCitation, onAddWikilink } });
        fireEvent.click(screen.getByTitle('Abbreviation'));
        fireEvent.click(screen.getByTitle('Citation'));
        fireEvent.click(screen.getByTitle('Insert Wikilink'));
        expect([onAddAbbreviation, onAddCitation, onAddWikilink].map(f => f.mock.calls.length)).toEqual([1, 1, 1]);
        expect(window.prompt).not.toHaveBeenCalled();
    });

    it('cancelling the citation key prompt inserts nothing', async () => {
        window.prompt.mockImplementation(() => null);
        const { editor } = await setup('<p>x</p>');
        const before = editor.getHTML();
        fireEvent.click(screen.getByTitle('Citation'));
        expect(editor.getHTML()).toBe(before);
    });
});
