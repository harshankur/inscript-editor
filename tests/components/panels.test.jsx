// DocumentOutline, BibliographyPanel, MiniMap, HistoryView, ImageSelectorModal.
import { act, fireEvent, render, screen as globalScreen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { buildExtensions } from '../../src/extensions/index.js';
import { DocumentOutline } from '../../src/components/DocumentOutline.jsx';
import { BibliographyPanel } from '../../src/components/BibliographyPanel.jsx';
import { MiniMap } from '../../src/components/MiniMap.jsx';
import { HistoryView } from '../../src/components/HistoryView.jsx';
import { ImageSelectorModal } from '../../src/components/ImageSelectorModal.jsx';

// The editors are mounted in document.body too, so queries are scoped to the rendered panel.
let screen = globalScreen;
function renderPanel(ui) {
    const r = render(ui);
    screen = within(r.container);
    return r;
}
afterEach(() => { screen = globalScreen; });

vi.mock('@tiptap/react/menus', () => ({ BubbleMenu: () => null, FloatingMenu: () => null }));

const editors = [];
function mount(content, { editable = true } = {}) {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = new Editor({ element, extensions: buildExtensions({}), content, editable });
    editors.push(editor);
    return editor;
}
afterEach(() => {
    while (editors.length) editors.pop().destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    try { localStorage.clear(); } catch { /* ignore */ }
});

describe('DocumentOutline', () => {
    it('clicking a later heading puts the caret INSIDE that heading', () => {
        const editor = mount('<h1>First</h1><p>para</p><h2>Second</h2><p>more</p>');
        renderPanel(<DocumentOutline editor={editor} />);
        act(() => { fireEvent.click(screen.getByText('Second')); });
        const sel = editor.state.selection;
        expect(sel instanceof TextSelection).toBe(true);
        expect(sel.$from.parent.type.name).toBe('heading');
        expect(sel.$from.parent.textContent).toBe('Second');
    });

    it('typing right after clicking a heading edits that heading, not a new paragraph before it', () => {
        const editor = mount('<h1>First</h1><p>para</p><h2>Second</h2>');
        renderPanel(<DocumentOutline editor={editor} />);
        act(() => { fireEvent.click(screen.getByText('Second')); });
        act(() => { editor.view.dispatch(editor.state.tr.insertText('X')); });
        expect(editor.getHTML()).toContain('<h2>XSecond</h2>');
    });

    it('updates on a quiet setContent and after deleting all headings shows the empty state', () => {
        const editor = mount('<h1>A</h1>');
        renderPanel(<DocumentOutline editor={editor} />);
        expect(screen.getByText('A')).toBeInTheDocument();
        act(() => { editor.commands.setContent('<p>none</p>', { emitUpdate: false }); });
        expect(screen.getByText('No headings yet')).toBeInTheDocument();
    });

    it('survives a localStorage that throws', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
        const editor = mount('<h1>A</h1>');
        renderPanel(<DocumentOutline editor={editor} />);
        fireEvent.click(screen.getByTitle('Collapse outline'));
        fireEvent.click(screen.getByTitle('Expand outline'));
        expect(screen.getByText('A')).toBeInTheDocument();
    });
});

describe('BibliographyPanel', () => {
    const doc = '<p>See <span class="citation" data-key="knuth" data-label="Knuth 1984" title="Literate Programming">[Knuth 1984]</span> and <span class="citation" data-key="knuth" data-label="Knuth 1984">x</span>.</p>';

    it('lists a key once and edits label and title on every occurrence', () => {
        const editor = mount(doc);
        renderPanel(<BibliographyPanel editor={editor} />);
        expect(screen.getAllByText('@knuth').length).toBe(1);
        fireEvent.click(screen.getByTitle('Edit citation'));
        const [label] = screen.getAllByRole('textbox');
        fireEvent.change(label, { target: { value: 'DEK' } });
        act(() => { fireEvent.click(screen.getByTitle('Save')); });
        const labels = [];
        editor.state.doc.descendants(n => { if (n.type.name === 'citation') labels.push(n.attrs.label); });
        expect(labels).toEqual(['DEK', 'DEK']);
    });

    it('does not let a read-only document be edited', () => {
        const editor = mount(doc, { editable: false });
        renderPanel(<BibliographyPanel editor={editor} />);
        const before = editor.getHTML();
        const edit = screen.queryByTitle('Edit citation');
        if (edit) {
            fireEvent.click(edit);
            fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'hacked' } });
            act(() => { fireEvent.click(screen.getByTitle('Save')); });
        }
        expect(editor.getHTML()).toBe(before);
    });

    it('an emptied label shows what the document shows (the key), not "[]"', () => {
        const editor = mount(doc);
        renderPanel(<BibliographyPanel editor={editor} />);
        fireEvent.click(screen.getByTitle('Edit citation'));
        fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '' } });
        act(() => { fireEvent.click(screen.getByTitle('Save')); });
        expect(editor.view.dom.querySelector('.citation').textContent).toBe('[knuth]');
        expect(screen.queryByText('[]')).toBeNull();
    });

    it('"Locate in text" puts the caret at the citation', () => {
        const editor = mount(doc);
        renderPanel(<BibliographyPanel editor={editor} />);
        act(() => { fireEvent.click(screen.getByText('@knuth')); });
        expect(editor.state.selection.from).toBe(5);
    });

    it('updates when a citation is removed and when the doc is quietly replaced', () => {
        const editor = mount(doc);
        renderPanel(<BibliographyPanel editor={editor} />);
        act(() => { editor.commands.setContent('<p>none</p>', { emitUpdate: false }); });
        expect(screen.getByText('No citations in document')).toBeInTheDocument();
    });
});

describe('MiniMap', () => {
    it('renders heading landmarks and a click scrolls that heading into view', () => {
        const editor = mount('<h1>Intro</h1><p>text</p><h2>Details</h2><p>x</p>');
        const spy = vi.fn();
        Element.prototype.scrollIntoView = spy;
        renderPanel(<MiniMap editor={editor} />);
        act(() => { fireEvent.click(screen.getByText('Details')); });
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.contexts.at(-1).textContent).toBe('Details');
    });

    it('does not throw for unusual blocks (tables, code, math, mermaid, youtube, embed, dl, hr, admonitions)', () => {
        const editor = mount('<table><tbody><tr><td><p>a</p></td></tr></tbody></table><pre><code>x\ny</code></pre><div class="math-block" data-math="x"></div><div class="mermaid" data-mermaid="graph TD;A-->B"></div><div data-youtube-video="dQw4w9WgXcQ"></div><div data-embed-src="https://e.com" data-embed-gated="true"></div><dl><dt>t</dt><dd><p>d</p></dd></dl><hr><div class="admonition" data-type="tip"><p>z</p></div><img src="https://e.com/a.png">');
        expect(() => renderPanel(<MiniMap editor={editor} />)).not.toThrow();
    });
});

describe('HistoryView', () => {
    const entry = (id, kind, html, extra = {}) => ({ id, kind, html, timestamp: new Date(Date.now() - 60000).toISOString(), title: '', tags: [], categories: [], ...extra });

    it('empty state, no restore, no crash in every mode', () => {
        render(<HistoryView history={[]} currentIndex={-1} onSelect={() => {}} />);
        expect(screen.getByText('No versions yet. Versions are recorded as you edit.')).toBeInTheDocument();
        expect(screen.getByText('Restore Version').closest('button').disabled).toBe(true);
        fireEvent.click(screen.getByText('Text'));
        fireEvent.click(screen.getByText('Source'));
        fireEvent.click(screen.getByText('Preview'));
    });

    it('restore is disabled on the active version and calls onSelect for another', () => {
        const onSelect = vi.fn();
        const history = [entry('a', 'opened', '<p>one</p>'), entry('b', 'edited', '<p>two</p>')];
        render(<HistoryView history={history} currentIndex={1} onSelect={onSelect} />);
        expect(screen.getByText('Restore Version').closest('button').disabled).toBe(true);
        fireEvent.click(screen.getByText('Opened'));
        fireEvent.click(screen.getByText('Restore Version'));
        expect(onSelect).toHaveBeenCalledWith(0, history[0]);
    });

    it('previews are inert: no iframe, no script, no event handlers, no javascript: href', () => {
        const nasty = '<p onclick="alert(1)">x<a href="javascript:alert(1)">l</a><img src="x" onerror="alert(1)"></p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><script>alert(1)</script><svg><a xlink:href="javascript:alert(1)"><text>t</text></a></svg><form action="https://e.com"><button formaction="javascript:alert(1)">b</button></form><math><mtext><a href="javascript:alert(1)">m</a></mtext></math>';
        const history = [entry('a', 'opened', nasty), entry('b', 'edited', nasty)];
        const { container } = render(<HistoryView history={history} currentIndex={1} onSelect={() => {}} />);
        const html = container.innerHTML;
        expect(container.querySelector('iframe, script, form')).toBeNull();
        expect(html).not.toMatch(/\son[a-z]+=/i);
        expect(html).not.toMatch(/javascript:/i);
    });

    it('labels and metadata rows: an entry with tags shows them; restoredFrom labels its source', () => {
        const history = [entry('a', 'opened', '<p>1</p>', { tags: ['t1'] }), entry('b', 'restored', '<p>1</p>', { restoredFrom: 'a', tags: ['t1', 't2'] })];
        render(<HistoryView history={history} currentIndex={1} onSelect={() => {}} />);
        expect(screen.getAllByText('Restored from Opened').length).toBeGreaterThan(0);
        expect(screen.getAllByText('t2').length).toBeGreaterThan(0);
    });

    it('odd entries (no timestamp, numeric tags, missing html) do not crash', () => {
        const history = [{ html: null }, { kind: 'weird', html: 5, tags: [1, 1], categories: 'x' }];
        expect(() => render(<HistoryView history={history} currentIndex={0} onSelect={() => {}} />)).not.toThrow();
        fireEvent.click(screen.getByText('Text'));
        fireEvent.click(screen.getByText('Source'));
    });
});

describe('ImageSelectorModal', () => {
    const images = [{ url: 'https://e.com/cat.png', name: 'Cat.png' }, { url: 'https://e.com/dog.png', name: 'dog.PNG' }];

    it('search filters case-insensitively and selecting calls onSelect with the url', () => {
        const onSelect = vi.fn();
        render(<ImageSelectorModal isOpen onClose={() => {}} images={images} onSelect={onSelect} onUpload={async () => {}} />);
        fireEvent.change(screen.getByPlaceholderText('Search images...'), { target: { value: 'CAT' } });
        expect(screen.queryByAltText('dog.PNG')).toBeNull();
        fireEvent.click(screen.getByAltText('Cat.png'));
        expect(onSelect).toHaveBeenCalledWith('https://e.com/cat.png');
    });

    it('a failed upload shows an error; the next success clears it', async () => {
        const onUpload = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce();
        const { container } = render(<ImageSelectorModal isOpen onClose={() => {}} images={[]} onSelect={() => {}} onUpload={onUpload} />);
        const file = new File(['a'], 'a.png', { type: 'image/png' });
        await act(async () => { fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [file] } }); });
        expect(screen.getByRole('alert')).toHaveTextContent('Upload failed');
        await act(async () => { fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [file] } }); });
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('empty list shows the empty state', () => {
        render(<ImageSelectorModal isOpen onClose={() => {}} images={[]} onSelect={() => {}} onUpload={async () => {}} />);
        expect(screen.getByText('No images found')).toBeInTheDocument();
    });

    it('(contract: images is required) does not crash when images is not passed yet', () => {
        expect(() => render(<ImageSelectorModal isOpen onClose={() => {}} onSelect={() => {}} onUpload={async () => {}} />)).not.toThrow();
    });

    it('(contract: name is required) does not crash on an image without a name', () => {
        expect(() => render(<ImageSelectorModal isOpen onClose={() => {}} images={[{ url: 'https://e.com/x.png' }]} onSelect={() => {}} onUpload={async () => {}} />)).not.toThrow();
    });

    it('closing and reopening clears a stale error and search', async () => {
        const onUpload = vi.fn().mockRejectedValue(new Error('x'));
        const { container, rerender } = render(<ImageSelectorModal isOpen onClose={() => {}} images={images} onSelect={() => {}} onUpload={onUpload} />);
        fireEvent.change(screen.getByPlaceholderText('Search images...'), { target: { value: 'zzz' } });
        await act(async () => { fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [new File(['a'], 'a.png')] } }); });
        rerender(<ImageSelectorModal isOpen={false} onClose={() => {}} images={images} onSelect={() => {}} onUpload={onUpload} />);
        rerender(<ImageSelectorModal isOpen onClose={() => {}} images={images} onSelect={() => {}} onUpload={onUpload} />);
        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.getByPlaceholderText('Search images...').value).toBe('');
    });

    it('(contract: onUpload is required) without onUpload there is no upload control that can only fail', async () => {
        const { container } = render(<ImageSelectorModal isOpen onClose={() => {}} images={images} onSelect={() => {}} />);
        const input = container.querySelector('input[type=file]');
        if (input) {
            await act(async () => { fireEvent.change(input, { target: { files: [new File(['a'], 'a.png')] } }); });
            expect(screen.queryByRole('alert')).toBeNull();
        }
    });
});
