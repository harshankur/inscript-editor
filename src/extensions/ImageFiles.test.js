import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { buildExtensions } from './index.js';
import { setEditorI18n, setHostHandlerProps } from './HostBridge.js';
import { IMAGE_FILE_SOURCE, imageAction, imageFileHandler, imageFilesOf, pickImageFiles, takeImageFiles } from './ImageFiles.js';

let editor;
let element;
afterEach(() => { editor?.destroy(); element?.remove(); editor = null; element = null; vi.restoreAllMocks(); });

const mount = (content, editorOptions = {}, options = {}) => {
    element = document.createElement('div');
    document.body.appendChild(element);
    editor = createEditor({ element, content, ...options }, editorOptions);
    return editor;
};
const png = (name = 'a.png') => new File(['x'], name, { type: 'image/png' });
const text = (name = 'notes.txt') => new File(['x'], name, { type: 'text/plain' });
/** Clipboard or drag data holding files (and, optionally, HTML or text). */
const data = (files, { html = '', plain = '' } = {}) => ({
    files,
    getData: type => (type === 'text/html' ? html : type === 'text/plain' ? plain : ''),
});
const paste = (files, extra) => editor.view.someProp('handlePaste', f => f(editor.view, { clipboardData: data(files, extra) }, null)) ?? false;
const drop = (files, { moved = false, pos = 1, ...extra } = {}) => {
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos, inside: -1 });
    return editor.view.someProp('handleDrop', f => f(editor.view, { dataTransfer: data(files, extra), clientX: 0, clientY: 0 }, null, moved)) ?? false;
};
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const placeholders = () => element.querySelectorAll('.inscript-image-placeholder');
/** The document as written, without an image's default layout or the empty paragraph kept after a closing block. */
const html = () => editor.getHTML()
    .replace(/ data-width="100%" style="[^"]*" data-align="center"/g, '')
    .replace(/<p><\/p>$/, '');

describe('ImageFiles: which files are taken', () => {
    it('takes only image files, in their order, one the browser gave no type (or only "bytes") by its name', () => {
        const untyped = name => new File(['x'], name, { type: '' });
        const bytes = name => new File(['x'], name, { type: 'application/octet-stream' });
        const files = [text(), png('one.png'), new File(['x'], 'two.jpg', { type: 'image/jpeg' }), untyped('three.HEIC'), untyped('notes'), bytes('four.jxl'), bytes('data.bin')];
        expect(imageFilesOf(files).map(f => f.name)).toEqual(['one.png', 'two.jpg', 'three.HEIC', 'four.jxl']);
        expect(imageFilesOf(null)).toEqual([]);
    });

    it('leaves a paste of text with a picture of it and no HTML (cells, styled text) to the text; takes a copied file, its name as text', async () => {
        const onImageFile = vi.fn(() => 'assets/a.png');
        mount('<p>ab</p>', { onImageFile });
        expect(paste([png()], { plain: 'cell1\tcell2' })).toBe(false);
        expect(onImageFile).not.toHaveBeenCalled();
        editor.commands.setTextSelection(3);
        expect(paste([png('photo.png')], { plain: 'photo.png' })).toBe(true);
        await settle();
        expect(html()).toContain('assets/a.png');
    });

    it('takes the image of files copied together with others, their names as text, as a drop of them does', async () => {
        const onImageFile = vi.fn(() => 'assets/a.png');
        mount('<p>ab</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        expect(paste([png('a.png'), new File(['x'], 'b.pdf', { type: 'application/pdf' })], { plain: 'a.png\nb.pdf' })).toBe(true);
        await settle();
        expect(onImageFile).toHaveBeenCalledTimes(1);
        expect(html()).toContain('assets/a.png');
    });

    it('leaves out an image whose src the handler gives would run script, or is a data URL of something else, and says so by its signal', async () => {
        const srcs = ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'asset://localhost/ok.png', null];
        const onImageFile = vi.fn(() => srcs.shift());
        mount('<p>ab</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        paste([png(), png(), png(), png()]);
        await settle();
        expect(html()).toBe('<p>ab</p><img src="asset://localhost/ok.png">');
        // Refused: aborted. Taken, or nothing given (the host's own choice): not.
        expect(onImageFile.mock.calls.map(call => call[1].signal.aborted)).toEqual([true, true, false, false]);
    });

    it('closing the editor takes away the input of a picker still open', () => {
        mount('<p>ab</p>', { onImageFile: vi.fn() });
        vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
        pickImageFiles(editor);
        expect(document.querySelectorAll('input[type=file]')).toHaveLength(1);
        editor.destroy();
        expect(document.querySelectorAll('input[type=file]')).toHaveLength(0);
    });

    it('aborts the signal when the image fails to go in after the handler gave it', async () => {
        const onImageFile = vi.fn(() => 'assets/a.png');
        mount('<p>ab</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        paste([png()]);
        const dispatch = editor.view.dispatch.bind(editor.view);
        vi.spyOn(editor.view, 'dispatch').mockImplementation(tr => {
            if (tr.docChanged) throw new Error('plugin');
            dispatch(tr);
        });
        await settle();
        expect(onImageFile.mock.calls[0][1].signal.aborted).toBe(true);
    });

    it('drops its placeholder whatever fails as the image goes in', async () => {
        mount('<p>ab</p>', { onImageFile: () => 'assets/a.png' });
        editor.commands.setTextSelection(3);
        paste([png()]);
        // The image's own change fails before it is applied (a plugin's or a listener's error).
        const dispatch = editor.view.dispatch.bind(editor.view);
        const failing = vi.spyOn(editor.view, 'dispatch').mockImplementation(tr => {
            if (tr.docChanged) throw new Error('plugin');
            dispatch(tr);
        });
        await settle();
        expect(failing).toHaveBeenCalled();
        expect(placeholders()).toHaveLength(0);
        expect(html()).toBe('<p>ab</p>');
    });

    it('takes a copied file whose text is its path or file URL (some file managers), not just its name', async () => {
        const onImageFile = vi.fn(() => 'assets/a.png');
        mount('<p>ab</p>', { onImageFile });
        expect(paste([png('my photo.png')], { plain: '/pictures/trip/my photo.png' })).toBe(true);
        expect(paste([png('my photo.png')], { plain: 'file:///pictures/trip/my%20photo.png' })).toBe(true);
        expect(paste([png('my photo.png')], { plain: 'D:\\pictures\\my photo.png' })).toBe(true);
        expect(paste([png('my photo.png')], { plain: 'my photo.png is attached' })).toBe(false);
    });

    it('without a handler, does not read the HTML of an image paste at all', () => {
        mount('<p>ab</p>');
        const parse = vi.spyOn(DOMParser.prototype, 'parseFromString');
        expect(paste([png()], { html: '<img src="a.png">' })).toBe(false);
        expect(parse).not.toHaveBeenCalled();
    });

    it('takes nothing, and offers no file picker, in an editor built without this extension', () => {
        const onImageFile = vi.fn(() => 'assets/a.png');
        editor = new Editor({ extensions: buildExtensions({ onImageFile }).filter(e => e.name !== 'imageFiles'), content: '<p>ab</p>' });
        expect(takeImageFiles(editor, [png()], null, IMAGE_FILE_SOURCE.PASTE, onImageFile)).toBe(false);
        expect(imageAction(editor, undefined, onImageFile)).toBeNull();
        expect(onImageFile).not.toHaveBeenCalled();
    });

    it('takes nothing without a handler, so a paste or drop goes on as before', () => {
        mount('<p>ab</p>');
        expect(imageFileHandler(editor)).toBeNull();
        expect(paste([png()])).toBe(false);
        expect(drop([png()])).toBe(false);
        expect(html()).toBe('<p>ab</p>');
    });

    it('leaves a paste or drop whose HTML is more than its picture (a web page, office cells), and one without images, alone', () => {
        const onImageFile = vi.fn(() => 'data:image/png;base64,AA==');
        mount('<p>ab</p>', { onImageFile });
        expect(paste([png()], { html: '<p>See <img src="https://example.com/a.png"> here</p>' })).toBe(false);
        expect(drop([png()], { html: '<table><tr><td><img src="cells.png"></td></tr></table>' })).toBe(false);
        expect(paste([png()], { html: '<p>1</p>' })).toBe(false);
        expect(paste([png()], { html: '<a href="https://example.com/shoe"><img src="shoe.png" alt="Shoe"></a>' })).toBe(false);
        expect(paste([text()])).toBe(false);
        expect(onImageFile).not.toHaveBeenCalled();
    });

    it('takes the file of a copied image whose HTML is only its picture, through the handler, not the HTML\'s link', async () => {
        const onImageFile = vi.fn(() => 'assets/stored.png');
        mount('<p>ab</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        expect(paste([png()], { html: '<meta charset="utf-8"><img src="https://example.com/a.png" alt="">' })).toBe(true);
        await settle();
        expect(html()).toBe('<p>ab</p><img src="assets/stored.png">');
    });

    it('leaves an editor\'s own content dragged alone: moved, copied, or from another editor', () => {
        const onImageFile = vi.fn(() => 'data:image/png;base64,AA==');
        mount('<p>ab</p>', { onImageFile });
        expect(drop([png()], { moved: true })).toBe(false);
        editor.view.dragging = { slice: editor.state.doc.slice(1, 2), move: false };
        expect(drop([png()])).toBe(false);
        editor.view.dragging = null;
        expect(drop([png()], { html: '<img src="a.png" data-pm-slice="0 0 []">' })).toBe(false);
        expect(onImageFile).not.toHaveBeenCalled();
    });

    it('takes a dropped image whose text is its URL with a query', async () => {
        const onImageFile = vi.fn(() => 'assets/a.png');
        mount('<p>ab</p>', { onImageFile });
        expect(drop([png('photo.png')], { plain: 'https://cdn.example.com/photo.png?w=800#top' })).toBe(true);
    });

    it('takes nothing in a read-only editor', () => {
        const onImageFile = vi.fn(() => 'data:image/png;base64,AA==');
        mount('<p>ab</p>', { onImageFile }, { editable: false });
        expect(takeImageFiles(editor, [png()], 1, IMAGE_FILE_SOURCE.DROP)).toBe(false);
        expect(onImageFile).not.toHaveBeenCalled();
    });
});

describe('ImageFiles: images going in', () => {
    it('a pasted image goes in where the cursor is, through the handler, told where it came from', async () => {
        const onImageFile = vi.fn(() => 'data:image/png;base64,AA==');
        mount('<p>ab</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        const file = png();
        expect(paste([file], { plain: 'a.png' })).toBe(true);
        expect(onImageFile).toHaveBeenCalledWith(file, { editor, source: IMAGE_FILE_SOURCE.PASTE, signal: expect.any(AbortSignal) });
        await settle();
        expect(html()).toBe('<p>ab</p><img src="data:image/png;base64,AA==">');
        expect(placeholders()).toHaveLength(0);
    });

    it('a dropped image goes in where it was dropped', async () => {
        const onImageFile = vi.fn(() => ({ src: 'assets/a.png', alt: 'A chart', title: 'Q3' }));
        mount('<p>one</p><p>two</p>', { onImageFile });
        expect(drop([png()], { pos: 5 })).toBe(true);
        expect(onImageFile.mock.calls[0][1].source).toBe(IMAGE_FILE_SOURCE.DROP);
        await settle();
        expect(html()).toBe('<p>one</p><img src="assets/a.png" alt="A chart" title="Q3"><p>two</p>');
    });

    it('shows a placeholder while the handler reads, and puts the images where it is, however the document changed', async () => {
        let finish;
        const onImageFile = vi.fn(() => new Promise(resolve => { finish = resolve; }));
        mount('<p>one</p><p>two</p>', { onImageFile });
        editor.commands.setTextSelection(4);
        paste([png()]);
        expect(placeholders()).toHaveLength(1);
        expect(placeholders()[0].getAttribute('role')).toBe('status');
        expect(placeholders()[0].textContent).toBe('Loading image…');
        // Text typed before it, meanwhile, moves it along.
        editor.view.dispatch(editor.state.tr.insertText('zero ', 1));
        finish('data:image/png;base64,AA==');
        await settle();
        expect(html()).toBe('<p>zero one</p><img src="data:image/png;base64,AA=="><p>two</p>');
        expect(placeholders()).toHaveLength(0);
    });

    it('says the placeholder in the editor\'s language, as it changes', async () => {
        const { createInstance } = await import('i18next');
        const own = createInstance();
        await own.init({ lng: 'en', resources: { en: { 'inscript-editor': {} }, de: { 'inscript-editor': { imageLoading: 'Bild wird geladen…' } } } });
        let finish;
        mount('<p>ab</p>', { onImageFile: () => new Promise(resolve => { finish = resolve; }) });
        setEditorI18n(editor, own);
        editor.commands.setTextSelection(3);
        paste([png()]);
        expect(placeholders()[0].textContent).toBe('Loading image…');
        await own.changeLanguage('de');
        expect(placeholders()[0].textContent).toBe('Bild wird geladen…');
        finish('assets/a.png');
        await settle();
        expect(placeholders()).toHaveLength(0);
    });

    it('takes several files in their order, leaving out those the handler gives nothing for or fails on', async () => {
        const onImageFile = vi.fn(file => {
            if (file.name === 'skip.png') return null;
            if (file.name === 'fail.png') return Promise.reject(new Error('too large'));
            if (file.name === 'bad.png') return { alt: 'no src' };
            return Promise.resolve(`assets/${file.name}`);
        });
        mount('<p>x</p>', { onImageFile });
        editor.commands.setTextSelection(2);
        paste([png('one.png'), png('skip.png'), text(), png('fail.png'), png('bad.png'), png('two.png')]);
        expect(onImageFile).toHaveBeenCalledTimes(5);
        await settle();
        expect(html()).toBe('<p>x</p><img src="assets/one.png"><img src="assets/two.png">');
    });

    it('a handler that throws leaves the file out and the editor as it was', async () => {
        mount('<p>x</p>', { onImageFile: () => { throw new Error('no'); } });
        expect(paste([png()])).toBe(true);
        await settle();
        expect(html()).toBe('<p>x</p>');
        expect(placeholders()).toHaveLength(0);
    });

    it('a paste over a selection replaces it', async () => {
        mount('<p>keep this out</p>', { onImageFile: () => 'assets/a.png' });
        editor.commands.setTextSelection({ from: 6, to: 10 });
        paste([png()]);
        await settle();
        expect(html()).toBe('<p>keep </p><img src="assets/a.png"><p> out</p>');
    });

    it('the cursor follows the images in when it stayed where they went, and stays put when it moved', async () => {
        let finish;
        mount('<p>ab</p><p>cd</p>', { onImageFile: () => new Promise(resolve => { finish = resolve; }) });
        editor.commands.setTextSelection(3);
        paste([png()]);
        finish('assets/a.png');
        await settle();
        expect(editor.state.selection.from).toBeGreaterThan(3);

        editor.commands.setContent('<p>ab</p><p>cd</p>');
        editor.commands.setTextSelection(3);
        paste([png()]);
        editor.commands.setTextSelection(6);
        finish('assets/b.png');
        await settle();
        expect(html()).toBe('<p>ab</p><img src="assets/b.png"><p>cd</p>');
        const cursor = editor.state.selection.$from;
        expect(cursor.parent.textContent).toBe('cd');
        expect(cursor.parentOffset).toBe(1);
    });

    it('puts nothing in when the place it was dropped is gone', async () => {
        let finish;
        mount('<p>one</p><p>two</p>', { onImageFile: () => new Promise(resolve => { finish = resolve; }) });
        editor.commands.setTextSelection(7);
        paste([png()]);
        editor.view.dispatch(editor.state.tr.delete(5, 10));
        finish('assets/a.png');
        await settle();
        expect(html()).toBe('<p>one</p>');
        expect(placeholders()).toHaveLength(0);
    });

    it('does nothing once the editor is gone', async () => {
        let finish;
        mount('<p>x</p>', { onImageFile: () => new Promise(resolve => { finish = resolve; }) });
        paste([png()]);
        editor.destroy();
        finish('assets/a.png');
        await settle();
        expect(editor.isDestroyed).toBe(true);
    });

    it('is one undo step for the images, with the placeholder never in the history', async () => {
        mount('<p>ab</p>', { onImageFile: () => 'assets/a.png' });
        editor.commands.setTextSelection(3);
        paste([png()]);
        await settle();
        editor.commands.undo();
        expect(html()).toBe('<p>ab</p>');
    });

    it('an image pasted into a disclosure summary goes to the start of its body', async () => {
        mount('<details open><summary>Why</summary><p>Body.</p></details>', { onImageFile: () => 'assets/a.png' });
        editor.commands.setTextSelection(4);
        paste([png()]);
        await settle();
        expect(html()).toBe('<details open=""><summary>Why</summary><img src="assets/a.png"><p>Body.</p></details>');
    });

    it('an image pasted or dropped into a code block goes after it, the code kept whole', async () => {
        mount('<pre><code>let a;</code></pre><p>after</p>', { onImageFile: () => 'assets/a.png' });
        editor.commands.setTextSelection(3);
        paste([png()]);
        drop([png()], { pos: 4 });
        await settle();
        expect(html()).toBe('<pre><code>let a;</code></pre><img src="assets/a.png"><img src="assets/a.png"><p>after</p>');
    });
});

describe('ImageFiles: while the files are read', () => {
    const later = () => {
        const finishes = [];
        const onImageFile = vi.fn(() => new Promise(resolve => { finishes.push(resolve); }));
        return { onImageFile, finishes };
    };

    it('keeps a selection pasted over until an image comes, and keeps it for good when none does', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>keep this out</p>', { onImageFile });
        editor.commands.setTextSelection({ from: 6, to: 10 });
        paste([png()]);
        expect(html()).toBe('<p>keep this out</p>');
        finishes[0](null);
        await settle();
        expect(html()).toBe('<p>keep this out</p>');
        expect(placeholders()).toHaveLength(0);
    });

    it('replaces a selection pasted over, however the document changed meanwhile, and the cursor follows', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>keep this out</p>', { onImageFile });
        editor.commands.setTextSelection({ from: 6, to: 10 });
        paste([png()]);
        editor.view.dispatch(editor.state.tr.insertText('so ', 1));
        finishes[0]('assets/a.png');
        await settle();
        expect(html()).toBe('<p>so keep </p><img src="assets/a.png"><p> out</p>');
        expect(editor.state.selection.empty).toBe(true);
        expect(editor.state.selection.$from.parent.textContent).toBe(' out');
    });

    it('an image that does not fit where it goes changes nothing (the selection pasted over kept), and its signal says so', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>keep this out</p>', { onImageFile });
        editor.commands.setTextSelection({ from: 6, to: 10 });
        paste([png()]);
        const { signal } = onImageFile.mock.calls[0][1];
        const replaceRangeWith = vi.spyOn(Object.getPrototypeOf(editor.state.tr), 'replaceRangeWith').mockImplementation(function noFit() { return this; });
        finishes[0]('assets/a.png');
        await settle();
        replaceRangeWith.mockRestore();
        expect(html()).toBe('<p>keep this out</p>');
        expect(placeholders()).toHaveLength(0);
        expect(signal.aborted).toBe(true);
    });

    it('a paste over a range from a disclosure\'s summary into its body keeps them apart, as Backspace does', async () => {
        mount('<details open><summary>Title</summary><p>Body text</p></details>', { onImageFile: () => 'assets/a.png' });
        const at = text => { let p = null; editor.state.doc.descendants((n, q) => { if (p === null && n.isText && n.text.includes(text)) p = q + n.text.indexOf(text); }); return p; };
        editor.commands.setTextSelection({ from: at('Title') + 2, to: at('Body') + 2 });
        paste([png()]);
        await settle();
        expect(html()).toBe('<details open=""><summary>Ti</summary><img src="assets/a.png"><p>dy text</p></details>');
    });

    it('several images pasted over the whole document go in together, a text cursor after them', async () => {
        mount('<p>ab</p><p>cd</p>', { onImageFile: () => 'assets/a.png' });
        editor.commands.selectAll();
        paste([png(), png()]);
        await settle();
        expect(html()).toBe('<img src="assets/a.png"><img src="assets/a.png">');
        expect(editor.state.selection.empty).toBe(true);
    });

    it('several images pasted at a line\'s end leave a text cursor after them, not the first image selected', async () => {
        mount('<p>ab</p><p>cd</p>', { onImageFile: () => 'assets/a.png' });
        editor.commands.setTextSelection(3);
        paste([png(), png()]);
        await settle();
        expect(html()).toBe('<p>ab</p><img src="assets/a.png"><img src="assets/a.png"><p>cd</p>');
        expect(editor.state.selection.empty).toBe(true);
        expect(editor.state.selection.$from.parent.textContent).toBe('cd');
    });

    it('a drop puts the cursor and focus where the images go, and the cursor follows them in', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>one two</p><p>end</p>', { onImageFile });
        editor.commands.setTextSelection(12);
        const focus = vi.spyOn(editor.view, 'focus');
        drop([png()], { pos: 4 });
        expect(editor.state.selection.from).toBe(4);
        expect(focus).toHaveBeenCalled();
        finishes[0]('assets/a.png');
        await settle();
        expect(html()).toBe('<p>one</p><img src="assets/a.png"><p> two</p><p>end</p>');
        expect(editor.state.selection.$from.parent.textContent).toBe(' two');
    });

    it('a drop between blocks, before an image, leaves a cursor there (never that image selected), then after the new one', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>one</p><img src="old.png"><p>two</p>', { onImageFile });
        drop([png()], { pos: 5 });
        // Beside the spot: the end of the line before it (no gap cursor beside a line).
        expect(editor.state.selection.empty).toBe(true);
        expect(editor.state.selection.from).toBe(4);
        finishes[0]('assets/new.png');
        await settle();
        expect(html()).toBe('<p>one</p><img src="assets/new.png"><img src="old.png"><p>two</p>');
        expect(editor.state.selection.empty).toBe(true);
        expect(editor.state.selection.$from.nodeBefore?.attrs.src).toBe('assets/new.png');
    });

    it('a drop between a table\'s cells or a list\'s items splits neither: the image goes where a block can', async () => {
        mount('<table><tr><td><p>a</p></td><td><p>b</p></td></tr></table><ul><li><p>x</p></li><li><p>y</p></li></ul>', { onImageFile: () => 'assets/a.png' });
        const between = name => { let found = null; editor.state.doc.descendants((n, p) => { if (found === null && n.type.name === name && editor.state.doc.resolve(p).index() === 1) found = p; }); return found; };
        drop([png()], { pos: between('tableCell') });
        await settle();
        drop([png()], { pos: between('listItem') });
        await settle();
        const kinds = [];
        editor.state.doc.forEach(node => kinds.push(node.type.name));
        expect(kinds.filter(kind => kind === 'table')).toHaveLength(1);
        expect(kinds.filter(kind => kind === 'bulletList')).toHaveLength(1);
        expect(kinds.filter(kind => kind === 'image')).toHaveLength(2);
    });

    it('an image followed by a table leaves the cursor right after it, not in the table', async () => {
        mount('<p>ab</p><table><tr><td><p>cell</p></td></tr></table>', { onImageFile: () => 'assets/a.png' });
        editor.commands.setTextSelection(3);
        paste([png()]);
        await settle();
        expect(editor.state.selection.$from.nodeBefore?.type.name).toBe('image');
        expect(editor.state.selection.$from.depth).toBe(0);
    });

    it('an image followed by a rule leaves the cursor right after it, not in text past the rule', async () => {
        mount('<p>ab</p><hr><p>far</p>', { onImageFile: () => 'assets/a.png' });
        editor.commands.setTextSelection(3);
        paste([png()]);
        await settle();
        expect(html()).toBe('<p>ab</p><img src="assets/a.png"><hr><p>far</p>');
        expect(editor.state.selection.empty).toBe(true);
        expect(editor.state.selection.$from.nodeBefore?.type.name).toBe('image');
    });

    it('keeps its spot when the line it is at the start of is joined to the one before', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>ab</p><p>cd</p>', { onImageFile });
        editor.commands.setTextSelection(5);
        paste([png()]);
        // Backspace at the start of "cd": the boundary between the lines (both tokens) goes.
        editor.view.dispatch(editor.state.tr.delete(3, 5));
        expect(placeholders()).toHaveLength(1);
        finishes[0]('assets/a.png');
        await settle();
        expect(html()).toBe('<p>ab</p><img src="assets/a.png"><p>cd</p>');
    });

    it('puts nothing in an editor made read-only meanwhile, and its signal says so', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>ab</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        paste([png()]);
        const { signal } = onImageFile.mock.calls[0][1];
        editor.setEditable(false);
        finishes[0]('assets/a.png');
        await settle();
        expect(html()).toBe('<p>ab</p>');
        expect(placeholders()).toHaveLength(0);
        expect(signal.aborted).toBe(true);
    });

    it('made read-only, aborts every signal at once and drops the placeholders, without waiting for the files', async () => {
        const { onImageFile } = later();
        mount('<p>ab</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        paste([png(), png()]);
        expect(placeholders()).toHaveLength(2);
        editor.setEditable(false);
        expect(onImageFile.mock.calls.every(call => call[1].signal.aborted)).toBe(true);
        await settle();
        expect(placeholders()).toHaveLength(0);
        expect(html()).toBe('<p>ab</p>');
    });

    it('puts each image in once its file is read, a slow one holding up none of the others, in the files\' order', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>ab</p><p>cd</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        paste([png(), png(), png()]);
        finishes[2]('assets/2.png');
        finishes[1]('assets/1.png');
        await settle();
        expect(html()).toBe('<p>ab</p><img src="assets/1.png"><img src="assets/2.png"><p>cd</p>');
        expect(placeholders()).toHaveLength(1);
        finishes[0]('assets/0.png');
        await settle();
        expect(html()).toBe('<p>ab</p><img src="assets/0.png"><img src="assets/1.png"><img src="assets/2.png"><p>cd</p>');
    });

    it('an image followed by a list leaves the cursor in the list, with no empty line put in', async () => {
        mount('<p>ab</p><ul><li><p>x</p></li></ul>', { onImageFile: () => 'assets/a.png' });
        editor.commands.setTextSelection(3);
        paste([png()]);
        await settle();
        expect(html()).toBe('<p>ab</p><img src="assets/a.png"><ul><li><p>x</p></li></ul>');
        expect(editor.state.selection.$from.parent.textContent).toBe('x');
    });

    it('leaves a paste as text (Shift with the paste keys) to the text, and takes the next paste', () => {
        const onImageFile = vi.fn(() => 'assets/a.png');
        mount('<p>ab</p>', { onImageFile });
        const pressPlainPaste = () => editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'м', code: 'KeyV', shiftKey: true, ctrlKey: true })));
        pressPlainPaste();
        expect(paste([png()])).toBe(false);
        expect(onImageFile).not.toHaveBeenCalled();
        expect(paste([png()])).toBe(true);
        // Pressed with nothing pasted, then let go: a later paste (from a menu) is the files.
        pressPlainPaste();
        editor.view.dom.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
        expect(paste([png()])).toBe(true);
        // Pressed, the key let go elsewhere: a moment later, a paste is the files.
        const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
        pressPlainPaste();
        now.mockReturnValue(12_000);
        expect(paste([png()])).toBe(true);
    });

    it('an image ending the document leaves a text cursor on a new line after it', async () => {
        mount('<p>ab</p>', { onImageFile: () => 'assets/a.png' });
        editor.commands.setTextSelection(3);
        paste([png()]);
        await settle();
        expect(editor.getHTML().replace(/ data-width="100%" style="[^"]*" data-align="center"/g, '')).toBe('<p>ab</p><img src="assets/a.png"><p></p>');
        expect(editor.state.selection.empty).toBe(true);
        expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
        expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1);
    });

    it('is its own undo step, not joined to typing straight after it', async () => {
        mount('<p>ab cd</p>', { onImageFile: () => 'assets/a.png' });
        editor.commands.setTextSelection(3);
        paste([png()]);
        await settle();
        editor.commands.insertContent('X');
        editor.commands.undo();
        expect(html()).toBe('<p>ab</p><img src="assets/a.png"><p> cd</p>');
    });

    it('made read-only and editable again at once, drops only the placeholders it had, not one put in since', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>ab</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        paste([png()]);
        editor.setEditable(false);
        editor.setEditable(true);
        editor.commands.setTextSelection(3);
        paste([png()]);
        await settle();
        expect(placeholders()).toHaveLength(1);
        finishes[1]('assets/b.png');
        await settle();
        expect(html()).toBe('<p>ab</p><img src="assets/b.png">');
    });

    it('is its own undo step, not joined to the typing just before it', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>ab</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        paste([png()]);
        editor.commands.insertContent('cd');
        finishes[0]('assets/a.png');
        await settle();
        editor.commands.undo();
        expect(html()).toBe('<p>abcd</p>');
    });

    it('puts in no image whose signal was aborted, even with the editor editable again by then', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>ab</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        paste([png()]);
        finishes[0]('assets/a.png');
        editor.setEditable(false);
        editor.setEditable(true);
        await settle();
        expect(html()).toBe('<p>ab</p>');
        expect(placeholders()).toHaveLength(0);
    });

    it('aborts the signal as soon as the spot is deleted, and when the editor is closed; not once the images are in', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>one</p><p>two</p><p>three</p>', { onImageFile });
        editor.commands.setTextSelection(7);
        paste([png()]);
        editor.commands.setTextSelection(2);
        paste([png()]);
        const [gone, kept] = onImageFile.mock.calls.map(call => call[1].signal);
        editor.view.dispatch(editor.state.tr.delete(5, 10));
        expect(gone.aborted).toBe(true);
        expect(kept.aborted).toBe(false);
        finishes[1]('assets/a.png');
        await settle();
        expect(kept.aborted).toBe(false);

        editor.commands.setTextSelection(2);
        paste([png()]);
        const closed = onImageFile.mock.calls[2][1].signal;
        editor.destroy();
        expect(closed.aborted).toBe(true);
    });

    it('keeps text typed at either edge of a selection pasted over, and replaces only what was selected', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>keep this out</p>', { onImageFile });
        editor.commands.setTextSelection({ from: 6, to: 10 });
        paste([png()]);
        editor.view.dispatch(editor.state.tr.insertText('<', 6).insertText('>', 11));
        expect(placeholders()[0].previousSibling?.textContent ?? placeholders()[0].previousSibling).toMatch(/<$/);
        finishes[0]('assets/a.png');
        await settle();
        expect(html()).toBe('<p>keep &lt;</p><img src="assets/a.png"><p>&gt; out</p>');
    });

    it('replaces nothing when what was selected was typed in meanwhile, the text typed kept', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>hello world</p>', { onImageFile });
        editor.commands.setTextSelection({ from: 1, to: 12 });
        paste([png()]);
        editor.view.dispatch(editor.state.tr.insertText('XYZ', 6));
        finishes[0]('assets/a.png');
        await settle();
        expect(editor.state.doc.textContent).toBe('helloXYZ world');
        expect(html()).toContain('assets/a.png');
    });

    it('takes Shift with the paste keys as paste as text on a layout where V is elsewhere', () => {
        const onImageFile = vi.fn(() => 'assets/a.png');
        mount('<p>ab</p>', { onImageFile });
        editor.view.someProp('handleKeyDown', f => f(editor.view, new KeyboardEvent('keydown', { key: 'V', code: 'Period', shiftKey: true, metaKey: true })));
        expect(paste([png()])).toBe(false);
    });

    it('keeps the files\' order when the selection pasted over was typed in and they are read out of order', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>hello world</p>', { onImageFile });
        editor.commands.setTextSelection({ from: 1, to: 6 });
        paste([png(), png()]);
        editor.view.dispatch(editor.state.tr.insertText('X', 3));
        finishes[1]('assets/b.png');
        await settle();
        finishes[0]('assets/a.png');
        await settle();
        expect(html()).toBe('<img src="assets/a.png"><img src="assets/b.png"><p>heXllo world</p>');
    });

    it('replaces nothing when the selection pasted over was typed over meanwhile', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>keep this out</p>', { onImageFile });
        editor.commands.setTextSelection({ from: 6, to: 10 });
        paste([png()]);
        editor.view.dispatch(editor.state.tr.insertText('that', 6, 10));
        finishes[0]('assets/a.png');
        await settle();
        expect(editor.state.doc.textContent).toBe('keep that out');
        expect(html()).toContain('assets/a.png');
    });

    it('a paste over selected code puts the images after the code block and keeps the code', async () => {
        mount('<pre><code>let a = 1;</code></pre><p>after</p>', { onImageFile: () => 'assets/a.png' });
        editor.commands.setTextSelection({ from: 5, to: 10 });
        paste([png()]);
        await settle();
        expect(html()).toBe('<pre><code>let a = 1;</code></pre><img src="assets/a.png"><p>after</p>');
    });

    it('puts the images after a code block their spot became meanwhile, the code kept whole', async () => {
        const { onImageFile, finishes } = later();
        mount('<p>let a;</p><p>after</p>', { onImageFile });
        editor.commands.setTextSelection(4);
        paste([png()]);
        editor.commands.setCodeBlock();
        finishes[0]('assets/a.png');
        await settle();
        expect(html()).toBe('<pre><code>let a;</code></pre><img src="assets/a.png"><p>after</p>');
    });

    it.each([['in the order taken', [0, 1]], ['in the other order', [1, 0]]])('two batches at one spot come out in the order they were taken, read %s', async (_label, order) => {
        const { onImageFile, finishes } = later();
        mount('<p>ab</p><p>cd</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        paste([png()]);
        paste([png()]);
        finishes[order[0]](`assets/${order[0]}.png`);
        await settle();
        finishes[order[1]](`assets/${order[1]}.png`);
        await settle();
        expect(html()).toBe('<p>ab</p><img src="assets/0.png"><img src="assets/1.png"><p>cd</p>');
    });

    it.each([[[0, 1, 2]], [[2, 0, 1]], [[1, 2, 0]]])('three batches within a line come out in the order taken, read in the order %j', async (order) => {
        const { onImageFile, finishes } = later();
        mount('<p>ab</p>', { onImageFile });
        editor.commands.setTextSelection(2);
        for (let i = 0; i < 3; i++) paste([png()]);
        for (const n of order) {
            finishes[n](`assets/${n}.png`);
            await settle();
        }
        expect(html()).toBe('<p>a</p><img src="assets/0.png"><img src="assets/1.png"><img src="assets/2.png"><p>b</p>');
    });
});

describe('ImageFiles: the handler', () => {
    it('an <InscriptEditor onImageFile> prop wins over editorOptions', async () => {
        const fromOptions = vi.fn(() => 'assets/options.png');
        const fromProp = vi.fn(() => 'assets/prop.png');
        mount('<p>x</p>', { onImageFile: fromOptions });
        setHostHandlerProps(editor, { onImageFile: fromProp });
        expect(imageFileHandler(editor)).toBe(fromProp);
        editor.commands.setTextSelection(2);
        paste([png()]);
        await settle();
        expect(fromOptions).not.toHaveBeenCalled();
        expect(html()).toContain('assets/prop.png');
    });

    it('the file picker takes the chosen images at the selection, told they were picked', async () => {
        const onImageFile = vi.fn(() => 'assets/a.png');
        mount('<p>ab</p>', { onImageFile });
        editor.commands.setTextSelection(3);
        let input;
        vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function click() {
            input = this;
            Object.defineProperty(this, 'files', { value: [png()] });
            this.dispatchEvent(new Event('change'));
        });
        pickImageFiles(editor);
        expect(input.type).toBe('file');
        // Beside the editor while the picker is open (some browsers open none for a detached input), then gone.
        expect(input.isConnected).toBe(false);
        expect(document.querySelector('input[type=file]')).toBeNull();
        expect(input.accept).toBe('image/*');
        expect(input.multiple).toBe(true);
        expect(onImageFile.mock.calls[0][1].source).toBe(IMAGE_FILE_SOURCE.PICK);
        await settle();
        expect(html()).toBe('<p>ab</p><img src="assets/a.png">');
    });

    it('the file picker input is in the editor\'s page while the picker is open, and goes when it is cancelled', () => {
        mount('<p>ab</p>', { onImageFile: vi.fn() });
        let connected = null;
        vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function click() { connected = this.isConnected; });
        pickImageFiles(editor);
        expect(connected).toBe(true);
        // At the end of the page, out of the host's own elements, its events going no further.
        const input = document.querySelector('input[type=file]');
        expect(input.parentElement).toBe(document.body);
        const heard = vi.fn();
        element.parentElement.addEventListener('change', heard);
        document.body.addEventListener('change', heard);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(heard).not.toHaveBeenCalled();
        document.body.removeEventListener('change', heard);
        expect(document.querySelector('input[type=file]')).toBeNull();
    });

    it('the file picker input of an editor in an open modal dialog is in that dialog', () => {
        const dialog = document.createElement('dialog');
        dialog.setAttribute('open', '');
        document.body.appendChild(dialog);
        element = document.createElement('div');
        dialog.appendChild(element);
        editor = createEditor({ element, content: '<p>ab</p>' }, { onImageFile: vi.fn() });
        vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
        pickImageFiles(editor);
        expect(document.querySelector('input[type=file]').parentElement).toBe(dialog);
        document.querySelector('input[type=file]').dispatchEvent(new Event('cancel'));
        dialog.remove();
    });

    it('a plain build with a live options ref but no host handlers ref keeps the handler it was given', async () => {
        const onImageFile = vi.fn(() => 'assets/a.png');
        mount('<p>x</p>', { onImageFile, liveOptionsRef: { current: { onImageFile } } });
        expect(imageFileHandler(editor)).toBe(onImageFile);
    });

    it('a picker left by a cancel the browser did not report is gone when the next one opens', () => {
        mount('<p>ab</p>', { onImageFile: vi.fn() });
        vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
        pickImageFiles(editor);
        pickImageFiles(editor);
        expect(document.querySelectorAll('input[type=file]')).toHaveLength(1);
        document.querySelector('input[type=file]').dispatchEvent(new Event('cancel'));
    });

    it('the file picker with nothing chosen changes nothing', () => {
        const onImageFile = vi.fn();
        mount('<p>ab</p>', { onImageFile });
        vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function click() {
            Object.defineProperty(this, 'files', { value: [] });
            this.dispatchEvent(new Event('change'));
        });
        pickImageFiles(editor);
        expect(onImageFile).not.toHaveBeenCalled();
        expect(html()).toBe('<p>ab</p>');
    });
});
