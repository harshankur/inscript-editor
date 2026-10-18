// The "/" command menu: filtering, keyboard navigation through slashCommandStore, gating,
// custom items, language switch, code blocks and several editors on one page.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { renderHost, flush, Host } from './harness.jsx';

vi.mock('@tiptap/react/menus', () => ({ BubbleMenu: () => null, FloatingMenu: () => null }));

afterEach(async () => {
    await act(async () => { await i18next.changeLanguage('en'); });
    vi.restoreAllMocks();
});

const menu = (container) => container.querySelector('.min-w-\\[240px\\]');
const items = (container) => [...(menu(container)?.querySelectorAll('button') ?? [])].map(b => b.querySelector('.text-sm').textContent);
const highlighted = (container) => {
    const b = [...(menu(container)?.querySelectorAll('button') ?? [])].find(x => x.className.includes('inscript-color-active)'));
    return b?.querySelector('.text-sm').textContent;
};
async function type(editor, text) {
    for (const ch of text) {
        await act(async () => { editor.view.dispatch(editor.state.tr.insertText(ch)); });
    }
    await flush();
}
async function key(editor, k) {
    await act(async () => { fireEvent.keyDown(editor.view.dom, { key: k }); });
}

async function setup(hook = {}, props = {}, html = '<p></p>') {
    const r = renderHost({ initialContent: html, ...hook }, props);
    await flush();
    const editor = r.api.current.editor;
    await act(async () => { editor.commands.focus('end'); });
    return { ...r, editor };
}

describe('slash menu', () => {
    it('opens on "/", filters by title and keyword, hides on no match', async () => {
        const { container, editor } = await setup();
        await type(editor, '/');
        expect(items(container).length).toBeGreaterThan(10);
        await type(editor, 'head');
        expect(items(container)).toEqual(['Heading 1', 'Heading 2', 'Heading 3']);
        await type(editor, 'zzz');
        expect(menu(container)).toBeNull();
    });

    it('Enter with no matching item inserts a newline instead of running anything', async () => {
        const { editor } = await setup();
        await type(editor, '/zzz');
        await key(editor, 'Enter');
        // jsdom has no native Enter: ProseMirror's own keymap splits the block.
        expect(editor.getHTML()).toBe('<p>/zzz</p><p></p>');
    });

    it('ArrowUp from the first item wraps to the last, ArrowDown wraps back, Enter runs the highlighted one', async () => {
        const { container, editor } = await setup();
        await type(editor, '/head');
        expect(highlighted(container)).toBe('Heading 1');
        await key(editor, 'ArrowUp');
        expect(highlighted(container)).toBe('Heading 3');
        await key(editor, 'ArrowDown');
        expect(highlighted(container)).toBe('Heading 1');
        await key(editor, 'ArrowDown');
        await key(editor, 'Enter');
        expect(editor.getHTML()).toBe('<h2></h2><p></p>'); // (+ the trailing paragraph)
    });

    it('Escape closes the menu; the next Enter is a plain newline', async () => {
        const { container, editor } = await setup();
        await type(editor, '/');
        await key(editor, 'Escape');
        expect(menu(container)).toBeNull();
        await key(editor, 'Enter');
        expect(editor.getHTML()).toBe('<p>/</p><p></p>');
    });

    it('clicking an item runs it and removes the "/query" text', async () => {
        const { container, editor } = await setup();
        await type(editor, '/quo');
        await act(async () => { fireEvent.click(menu(container).querySelector('button')); });
        expect(editor.getHTML()).toBe('<blockquote><p></p></blockquote><p></p>');
    });

    it('image and YouTube items appear only with their handlers', async () => {
        const a = await setup();
        await type(a.editor, '/');
        expect(items(a.container)).not.toContain('Insert Image');
        expect(items(a.container)).not.toContain('Embed YouTube Video');
        a.unmount();
        const onShowMediaLibrary = vi.fn();
        const onAddYoutube = vi.fn();
        const b = await setup({ editorOptions: { onShowMediaLibrary, onAddYoutube } });
        await type(b.editor, '/');
        expect(items(b.container)).toContain('Insert Image');
        expect(items(b.container)).toContain('Embed YouTube Video');
        await type(b.editor, 'image');
        await key(b.editor, 'Enter');
        expect(onShowMediaLibrary).toHaveBeenCalledTimes(1);
        expect(b.editor.getHTML()).toBe('<p></p>');
    });

    it('the image item follows an <InscriptEditor onShowMediaLibrary> prop too (the toolbar button does)', async () => {
        const onShowMediaLibrary = vi.fn();
        const { container, editor } = await setup({}, { onShowMediaLibrary });
        await type(editor, '/');
        expect(items(container)).toContain('Insert Image');
    });

    it('custom slashCommands replace the defaults, and get { editor, range }', async () => {
        const run = vi.fn(({ editor, range }) => editor.chain().deleteRange(range).insertContent('X').run());
        const { container, editor } = await setup({ editorOptions: { slashCommands: [{ id: 'x', title: 'Insert X', keywords: ['ex'], command: run }] } });
        await type(editor, '/ex');
        expect(items(container)).toEqual(['Insert X']);
        await key(editor, 'Enter');
        expect(run).toHaveBeenCalledTimes(1);
        expect(editor.getHTML()).toBe('<p>X</p>');
    });

    it('custom items without id/title/keywords do not crash filtering or rendering', async () => {
        const errors = [];
        vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')));
        const { container, editor } = await setup({ editorOptions: { slashCommands: [{ command: () => {} }, { title: 5, command: () => {} }, { title: null, keywords: [null, 3], command: () => {} }] } });
        await type(editor, '/');
        expect(items(container).length).toBe(3);
        expect(errors.filter(e => /same key|unique "key"/.test(e))).toEqual([]);
    });

    it('follows a language switch for titles and filtering', async () => {
        i18next.addResourceBundle('de', 'inscript-editor', { heading1: 'Überschrift 1', heading2: 'Überschrift 2', heading3: 'Überschrift 3' }, true, true);
        const { container, editor } = await setup();
        await act(async () => { await i18next.changeLanguage('de'); });
        await type(editor, '/über');
        expect(items(container)).toEqual(['Überschrift 1', 'Überschrift 2', 'Überschrift 3']);
    });

    it('does not open inside a code block (a "/" in code followed by Enter must stay code)', async () => {
        const { editor } = await setup({}, {}, '<pre><code>a</code></pre>');
        await act(async () => { editor.commands.setTextSelection(2); });
        expect(editor.state.selection.$from.parent.type.name).toBe('codeBlock');
        await type(editor, ' /');
        await key(editor, 'Enter');
        expect(editor.state.doc.firstChild.type.name).toBe('codeBlock');
        expect(editor.state.doc.firstChild.textContent).toContain('a /');
    });

    it('a read-only editor shows no menu', async () => {
        const { container, editor } = await setup({ isReadonly: true }, { isReadonly: true });
        await act(async () => { editor.view.dispatch(editor.state.tr.insertText('/')); });
        await flush();
        expect(menu(container)).toBeNull();
    });
});

describe('two editors on one page', () => {
    function Two({ readonlySecond = false }) {
        return (
            <div>
                <div data-testid="a"><Host ref={refs.a} hookOptions={{ initialContent: '<p></p>' }} /></div>
                <div data-testid="b"><Host ref={refs.b} hookOptions={{ initialContent: '<p></p>', isReadonly: readonlySecond }} props={{ isReadonly: readonlySecond }} /></div>
            </div>
        );
    }
    const refs = { a: { current: null }, b: { current: null } };

    it('"/" in editor A shows one menu, not one per editor', async () => {
        const { container } = render(<Two />);
        await flush();
        const editor = refs.a.current.editor;
        await act(async () => { editor.commands.focus('end'); });
        await type(editor, '/');
        expect(container.querySelectorAll('.min-w-\\[240px\\]').length).toBe(1);
    });

    it('with a read-only editor beside it, ArrowDown moves the visible highlight and Enter runs that item', async () => {
        const { container } = render(<Two readonlySecond />);
        await flush();
        const editor = refs.a.current.editor;
        await act(async () => { editor.commands.focus('end'); });
        await type(editor, '/head');
        await key(editor, 'ArrowDown');
        await key(editor, 'ArrowDown');
        const visible = container.querySelector('[data-testid="a"] .min-w-\\[240px\\]');
        const lit = [...visible.querySelectorAll('button')].find(x => x.className.includes('inscript-color-active)'));
        await key(editor, 'Enter');
        // What the user saw highlighted must be what Enter runs: Heading 3 after two ArrowDowns.
        expect({ lit: lit?.querySelector('.text-sm').textContent, html: editor.getHTML() }).toEqual({ lit: 'Heading 3', html: '<h3></h3><p></p>' });
    });
});
