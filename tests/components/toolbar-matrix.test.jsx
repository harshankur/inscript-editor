// Every toolbar tool, clicked in every context. Generic assertions: no throw, no console
// error, the document stays schema-valid, the selection stays valid.
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextSelection, NodeSelection } from '@tiptap/pm/state';
import { ALL_TOOL_IDS } from '../../src/toolbar/toolRegistry.js';
import { renderHost, stubClientWidth, flush } from './harness.jsx';

const shouldShows = vi.hoisted(() => []);
vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children, shouldShow }) => { shouldShows.push(shouldShow); return <div data-testid="bubble-menu">{children}</div>; },
    FloatingMenu: ({ children }) => <div>{children}</div>,
}));

const IMG = 'data:image/png;base64,iVBORw0KGgo=';

// Each context: initial HTML and a function placing the selection.
const CONTEXTS = {
    empty: { html: '', select: () => {} },
    textSelection: { html: '<p>hello world</p>', select: (e) => e.commands.setTextSelection({ from: 7, to: 12 }) },
    cursor: { html: '<p>hello world</p>', select: (e) => e.commands.setTextSelection(4) },
    tableCell: { html: '<table><tbody><tr><th><p>h1</p></th><th><p>h2</p></th></tr><tr><td><p>cell</p></td><td><p>x</p></td></tr></tbody></table>', select: (e) => {
        let pos = null;
        e.state.doc.descendants((n, p) => { if (pos === null && n.isText && n.text === 'cell') pos = p + 2; });
        e.commands.setTextSelection(pos);
    } },
    codeBlock: { html: '<pre><code>const a = 1;</code></pre>', select: (e) => e.commands.setTextSelection(3) },
    bulletList: { html: '<ul><li><p>item one</p></li><li><p>item two</p></li></ul>', select: (e) => e.commands.setTextSelection(5) },
    taskList: { html: '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>task one</p></li></ul>', select: (e) => e.commands.setTextSelection(5) },
    imageSelected: { html: `<p>before</p><img src="${IMG}" alt="a"><p>after</p>`, select: (e) => {
        let pos = null;
        e.state.doc.descendants((n, p) => { if (pos === null && n.type.name === 'image') pos = p; });
        e.commands.setNodeSelection(pos);
    } },
};

// The button(s) to press for each tool (by title, from buildToolMap).
const PRESS = {
    undo: ['Undo'], redo: ['Redo'],
    h1: ['Heading 1'], h2: ['Heading 2'], h3: ['Heading 3'],
    bold: ['Bold'], italic: ['Italic'], underline: ['Underline'], strike: ['Strikethrough'],
    inlineCode: ['Inline Code'], sub: ['Subscript'], sup: ['Superscript'], abbreviation: ['Abbreviation'],
    clearFormat: ['Clear Formatting'],
    fontSize: ['Font Size', '18px'], highlight: ['Highlight Color', '#fef08a'], color: ['Text Color', '#dc2626'],
    link: ['Insert Link'],
    wikilink: ['Insert Wikilink'], footnote: ['Footnote'], citation: ['Citation'],
    bullet: ['Bullet List'], ordered: ['Numbered List'], task: ['Task List'], definition: ['Definition List'],
    align: ['Text Alignment', 'Align Center'],
    code: ['Code Block'], quote: ['Quote'], admonitions: ['Admonitions', 'Tip'], hr: ['Divider'],
    math: ['Math Block'], mermaid: ['Mermaid Diagram'],
    image: ['Insert Image'], youtube: ['Embed YouTube Video'], table: ['Insert Table'], tags: ['Manage Tags & Categories'],
};

function selectionIsValid(state) {
    const sel = state.selection;
    if (sel instanceof TextSelection) return sel.$from.parent.inlineContent && sel.$to.parent.inlineContent;
    return true;
}

let restoreWidth;
let errors;
beforeEach(() => {
    restoreWidth = stubClientWidth(100000);
    errors = [];
    vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a.map(String).join(' ')); });
    vi.spyOn(window, 'prompt').mockImplementation(() => 'Full Form');
    vi.spyOn(window, 'open').mockImplementation(() => null);
});
afterEach(() => {
    restoreWidth();
    vi.restoreAllMocks();
});

describe.each(Object.keys(CONTEXTS))('context %s', (ctxName) => {
    it.each(ALL_TOOL_IDS)('tool %s', async (tool) => {
        const ctx = CONTEXTS[ctxName];
        const handlers = { onShowMediaLibrary: vi.fn(), onAddYoutube: vi.fn(), onShowMetadataModal: vi.fn() };
        const { api } = renderHost(
            { initialContent: ctx.html, editorOptions: { onShowMediaLibrary: handlers.onShowMediaLibrary, onAddYoutube: handlers.onAddYoutube } },
            { toolbarConfig: ALL_TOOL_IDS, onShowMetadataModal: handlers.onShowMetadataModal },
        );
        await flush();
        const editor = api.current.editor;
        act(() => { ctx.select(editor); });
        let thrown = null;
        try {
            for (const title of PRESS[tool]) {
                const el = screen.queryAllByTitle(title)[0] || screen.queryByText(title);
                if (!el) throw new Error(`no control titled ${title}`);
                await act(async () => { fireEvent.click(el); });
            }
            if (tool === 'link') {
                const input = screen.getByPlaceholderText('Enter URL...');
                fireEvent.change(input, { target: { value: 'https://example.com' } });
                await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
            }
        } catch (e) { thrown = e; }
        let docOk = true;
        try { editor.state.doc.check(); } catch { docOk = false; }
        expect(thrown).toBeNull();
        expect(errors).toEqual([]);
        expect(docOk).toBe(true);
        expect(selectionIsValid(editor.state)).toBe(true);
    });
});

describe('readonly', () => {
    it('no toolbar renders and no tool can be reached', async () => {
        shouldShows.length = 0;
        const { api } = renderHost({ isReadonly: true, initialContent: '<p>x</p>' }, { isReadonly: true, toolbarConfig: ALL_TOOL_IDS });
        await flush();
        expect(screen.queryByTitle('Undo')).toBeNull();
        expect(screen.queryByTitle('Heading 1')).toBeNull();
        // The (mocked) bubble menus render inline; the real ones only show when shouldShow says so.
        const editor = api.current.editor;
        act(() => { editor.commands.setTextSelection({ from: 1, to: 2 }); });
        expect(shouldShows.length).toBeGreaterThan(0);
        expect(shouldShows.map(f => f({ editor }))).toEqual(shouldShows.map(() => false));
    });
});
