// Consent and network-leak checks for the YouTube node view (every facade mode), the Embed
// node view, and YoutubeEmbedModal. Asserts the CORRECT behaviour: a failure is a bug.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import { buildExtensions } from '../../src/extensions/index.js';
import { YoutubeEmbedModal } from '../../src/components/YoutubeEmbedModal.jsx';
import { renderHost, flush } from './harness.jsx';

vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children }) => <div data-testid="bubble-menu">{children}</div>,
    FloatingMenu: ({ children }) => <div>{children}</div>,
}));

const A = 'dQw4w9WgXcQ';
const B = 'aqz-KE-bpKQ';

const editors = [];
function mount(options = {}, { editable = true, content = '' } = {}) {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = new Editor({ element, extensions: buildExtensions(options), content, editable });
    editors.push(editor);
    return editor;
}
afterEach(() => {
    while (editors.length) {
        const e = editors.pop();
        const el = e.view?.dom?.parentElement;
        e.destroy();
        el?.remove();
    }
});

/** Every URL the editor DOM would request from another host. */
function thirdPartyUrls(root) {
    const urls = [];
    root.querySelectorAll('iframe[src], img[src], script[src], link[href]').forEach(el => urls.push(el.getAttribute('src') || el.getAttribute('href')));
    root.querySelectorAll('[style]').forEach(el => {
        const m = /url\(["']?([^"')]+)/.exec(el.getAttribute('style'));
        if (m) urls.push(m[1]);
    });
    return urls;
}

const ytDiv = (id) => `<div data-youtube-video="${id}"></div>`;

describe('YouTube node view', () => {
    describe.each([
        ['local', true],
        ['local', false],
    ])('facade %s (editable %s)', (facade, editable) => {
        it('requests nothing before consent and loads only on the button', () => {
            const editor = mount({ youtube: { facade } }, { editable, content: ytDiv(A) });
            const root = editor.view.dom;
            expect(thirdPartyUrls(root)).toEqual([]);
            const btn = root.querySelector('[data-youtube-consent] button');
            expect(btn).toBeTruthy();
            fireEvent.click(btn);
            expect(root.querySelector('iframe').getAttribute('src')).toBe(`https://www.youtube.com/embed/${A}`);
        });
    });

    it.each([
        ['local'],
        ['thumbnail'],
        [true],
    ])('facade %s: after consenting to video A, a different document whose first node is video B does not load B without consent', (facade) => {
        const editor = mount({ youtube: { facade } }, { content: ytDiv(A) });
        const root = editor.view.dom;
        const trigger = root.querySelector('[data-youtube-consent] button') || root.querySelector('button[data-youtube-facade]');
        fireEvent.click(trigger);
        expect(root.querySelector('iframe')?.getAttribute('src')).toBe(`https://www.youtube.com/embed/${A}`);

        // The host opens another document (e.g. the next post in a read-only viewer).
        act(() => { editor.commands.setContent(ytDiv(B)); });
        const iframe = root.querySelector('iframe[src]');
        // Consent was given "for that video only": B must wait for its own press.
        expect(iframe?.getAttribute('src') ?? null).toBeNull();
    });

    it('facade local: replacing the video URL after consent asks again for the new video', () => {
        const editor = mount({ youtube: { facade: 'local' } }, { content: ytDiv(A) });
        const root = editor.view.dom;
        fireEvent.click(root.querySelector('[data-youtube-consent] button'));
        act(() => {
            editor.commands.setNodeSelection(0);
            editor.commands.updateAttributes('youtube', { 'data-youtube-video': B });
        });
        expect(root.querySelector(`iframe[src*="${B}"]`)).toBeNull();
        expect(root.querySelector('[data-youtube-consent]')).toBeTruthy();
    });

    it('facade local: width/alignment change after load does not reload the player', () => {
        const editor = mount({ youtube: { facade: 'local' } }, { content: ytDiv(A) });
        const root = editor.view.dom;
        fireEvent.click(root.querySelector('[data-youtube-consent] button'));
        const iframe = root.querySelector('iframe');
        const spy = vi.fn();
        Object.defineProperty(iframe, 'src', { configurable: true, set: spy, get: () => iframe.getAttribute('src') });
        act(() => {
            editor.commands.setNodeSelection(0);
            editor.commands.updateAttributes('youtube', { width: '50%', align: 'left' });
        });
        expect(spy).not.toHaveBeenCalled();
        expect(root.querySelector('iframe')).toBe(iframe);
    });

    it('facade local: changing the URL before loading rebuilds the placeholder and loads the new id', () => {
        const editor = mount({ youtube: { facade: 'local' } }, { content: ytDiv(A) });
        const root = editor.view.dom;
        act(() => {
            editor.commands.setNodeSelection(0);
            editor.commands.updateAttributes('youtube', { 'data-youtube-video': B });
        });
        fireEvent.click(root.querySelector('[data-youtube-consent] button'));
        expect(root.querySelector('iframe').getAttribute('src')).toBe(`https://www.youtube.com/embed/${B}`);
    });

    it.each([
        ['https://example.com/privacy', true],
        ['http://example.com/p', true],
        ['javascript:alert(1)', false],
        ['  ', false],
        ['data:text/html,x', false],
        [42, false],
    ])('privacy link for %s linked=%s, new tab + noopener', (privacyUrl, linked) => {
        const editor = mount({ youtube: { facade: 'local', privacyUrl } }, { content: ytDiv(A) });
        const a = editor.view.dom.querySelector('[data-youtube-consent] a');
        if (!linked) { expect(a).toBeNull(); return; }
        expect(a.getAttribute('target')).toBe('_blank');
        expect(a.getAttribute('rel')).toContain('noopener');
    });

    it('privacy link goes through editorOptions.onOpenExternal', () => {
        const onOpenExternal = vi.fn();
        const editor = mount({ youtube: { facade: 'local', privacyUrl: 'https://e.com/p' }, hostHandlersRef: { current: { onOpenExternal } } }, { content: ytDiv(A) });
        const a = editor.view.dom.querySelector('[data-youtube-consent] a');
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
        a.dispatchEvent(ev);
        expect(onOpenExternal).toHaveBeenCalledWith('https://e.com/p');
        expect(ev.defaultPrevented).toBe(true);
    });

    it('Enter keydown on the consent button is not turned into an edit by ProseMirror', () => {
        const editor = mount({ youtube: { facade: 'local' } }, { content: `<p>x</p>${ytDiv(A)}<p>y</p>` });
        const before = editor.getHTML();
        const btn = editor.view.dom.querySelector('[data-youtube-consent] button');
        btn.focus();
        fireEvent.keyDown(btn, { key: 'Enter' });
        fireEvent.keyDown(btn, { key: ' ' });
        expect(editor.getHTML()).toBe(before);
    });

    it.each([['thumbnail'], [true]])('facade %s: Enter or Space on the focused thumbnail button is not turned into an edit, and its native activation is not cancelled', (facade) => {
        const editor = mount({ youtube: { facade } }, { content: `<p>x</p>${ytDiv(A)}<p>y</p>` });
        act(() => { editor.commands.setTextSelection(2); });
        const before = editor.getHTML();
        const btn = editor.view.dom.querySelector('button[data-youtube-facade]');
        btn.focus();
        const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        btn.dispatchEvent(enter);
        const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        btn.dispatchEvent(space);
        expect(editor.getHTML()).toBe(before);
        expect(enter.defaultPrevented).toBe(false);
    });

    it.each([[false], [0], [''], [null], [undefined]])('facade %s: player loads straight away (default)', (facade) => {
        const editor = mount({ youtube: { facade } }, { content: ytDiv(A) });
        expect(editor.view.dom.querySelector('iframe').getAttribute('src')).toBe(`https://www.youtube.com/embed/${A}`);
    });

    it.each([['thumbnail'], [true], ['yes'], [1]])('facade %s: only the thumbnail before the click', (facade) => {
        const editor = mount({ youtube: { facade } }, { content: ytDiv(A) });
        const root = editor.view.dom;
        expect(root.querySelector('iframe[src]')).toBeNull();
        expect(thirdPartyUrls(root)).toEqual([`https://i.ytimg.com/vi/${A}/hqdefault.jpg`]);
    });

    it('a youtube node with no id never requests /embed/null', () => {
        const editor = mount({ youtube: { facade: false } }, { content: '<div data-youtube-video=""></div>' });
        expect(thirdPartyUrls(editor.view.dom)).toEqual([]);
    });
});

describe('Embed node view (React node view, mounted through InscriptEditor)', () => {
    const embed = (src) => `<div data-embed-src="${src}" data-embed-gated="true"></div>`;

    it('untrusted embed requests nothing until loaded', async () => {
        const { container } = renderHost({ initialContent: embed('https://maps.example.com/x') });
        await flush();
        expect(container.querySelector('.ProseMirror figure.embed-node')).toBeTruthy();
        expect(thirdPartyUrls(container)).toEqual([]);
    });

    it('trusted host loads straight away', async () => {
        const { container } = renderHost({ initialContent: embed('https://maps.example.com/x'), editorOptions: { embed: { trustedEmbedHosts: ['example.com'] } } });
        await flush();
        expect(container.querySelector('iframe').getAttribute('src')).toBe('https://maps.example.com/x');
    });

    it('trusted host suffix match is not fooled by evilexample.com', async () => {
        const { container } = renderHost({ initialContent: embed('https://evilexample.com/x'), editorOptions: { embed: { trustedEmbedHosts: ['example.com'] } } });
        await flush();
        expect(container.querySelector('iframe')).toBeNull();
    });

    it('after consenting to embed A, loading a document whose embed is an untrusted B does not load B without consent', async () => {
        const { container, api } = renderHost({ initialContent: embed('https://a.example.com/x') });
        await flush();
        const btn = [...container.querySelectorAll('.ProseMirror button')].find(b => /Load embedded content/.test(b.textContent));
        await act(async () => { fireEvent.click(btn); });
        expect(container.querySelector('iframe').getAttribute('src')).toBe('https://a.example.com/x');
        await act(async () => { api.current.loadContent(embed('https://tracker.evil.test/y')); });
        await flush();
        expect(container.querySelector('iframe[src="https://tracker.evil.test/y"]')).toBeNull();
    });

    it('after consenting to embed A, editor.commands.setContent / ref.setContent with an untrusted B does not load B', async () => {
        const { container, api } = renderHost({ initialContent: embed('https://a.example.com/x') });
        await flush();
        const btn = [...container.querySelectorAll('.ProseMirror button')].find(b => /Load embedded content/.test(b.textContent));
        await act(async () => { fireEvent.click(btn); });
        await act(async () => { api.current.editor.commands.setContent(embed('https://tracker.evil.test/y')); });
        await flush();
        expect(container.querySelector('iframe[src="https://tracker.evil.test/y"]')).toBeNull();
    });

    it('after consenting to embed A, replacing its src from the bubble menu asks again', async () => {
        const { container, api } = renderHost({ initialContent: embed('https://a.example.com/x') });
        await flush();
        const btn = [...container.querySelectorAll('.ProseMirror button')].find(b => /Load embedded content/.test(b.textContent));
        await act(async () => { fireEvent.click(btn); });
        await act(async () => {
            api.current.editor.commands.setNodeSelection(0);
            api.current.editor.commands.updateAttributes('embed', { src: 'https://tracker.evil.test/y' });
        });
        await flush();
        expect(container.querySelector('iframe[src="https://tracker.evil.test/y"]')).toBeNull();
    });
});

describe('InscriptEditor onOpenExternal prop reaches the node view privacy link', () => {
    it('prop wins over editorOptions and is used for the privacy link', async () => {
        const fromOptions = vi.fn();
        const fromProp = vi.fn();
        const { container } = renderHost(
            { initialContent: ytDiv(A), editorOptions: { onOpenExternal: fromOptions, youtube: { facade: 'local', privacyUrl: 'https://e.com/p' } } },
            { onOpenExternal: fromProp },
        );
        await flush();
        const a = container.querySelector('[data-youtube-consent] a');
        fireEvent.click(a);
        expect(fromProp).toHaveBeenCalledWith('https://e.com/p');
        expect(fromOptions).not.toHaveBeenCalled();
    });
});

describe('YoutubeEmbedModal live preview consent', () => {
    it('loads nothing before "Load preview" and only for the consented id', () => {
        const { container } = render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
        fireEvent.change(screen.getByPlaceholderText('https://youtube.com/watch?v=...'), { target: { value: `https://youtu.be/${A}` } });
        expect(container.querySelector('iframe')).toBeNull();
        fireEvent.click(screen.getByText('Load preview'));
        expect(container.querySelector('iframe').getAttribute('src')).toContain(`/embed/${A}`);
        fireEvent.change(screen.getByPlaceholderText('https://youtube.com/watch?v=...'), { target: { value: B } });
        expect(container.querySelector('iframe')).toBeNull();
        expect(screen.getByText('Load preview')).toBeInTheDocument();
    });

    it('no search tab without onSearch, search tab with it', () => {
        const { rerender } = render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
        expect(screen.queryByText('Search YouTube (Experimental)')).toBeNull();
        rerender(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} onSearch={async () => []} />);
        expect(screen.getByText('Search YouTube (Experimental)')).toBeInTheDocument();
    });

    it.each([
        ['', false], ['   ', false], ['not a url', false], ['https://example.com/abcdefghijk', false],
        ['https://www.youtube.com/watch?v=' + A + '&t=10', true], ['https://youtube.com/shorts/' + A, true],
        [A, true], ['  ' + A + '  ', true], [A + 'x', false],
    ])('input %j enables Insert=%s and confirms the extracted id', (value, ok) => {
        const onConfirm = vi.fn();
        render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={onConfirm} />);
        fireEvent.change(screen.getByPlaceholderText('https://youtube.com/watch?v=...'), { target: { value } });
        const insert = screen.getByText('Insert Video');
        expect(insert.disabled).toBe(!ok);
        fireEvent.click(insert);
        if (ok) expect(onConfirm).toHaveBeenCalledWith(A);
        else expect(onConfirm).not.toHaveBeenCalled();
    });

    it('privacy link only for http(s) and opens through onOpenExternal', () => {
        const onOpenExternal = vi.fn();
        const { container, rerender } = render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} privacyUrl="javascript:alert(1)" onOpenExternal={onOpenExternal} />);
        fireEvent.change(screen.getByPlaceholderText('https://youtube.com/watch?v=...'), { target: { value: A } });
        expect(container.querySelector('[data-youtube-consent] a')).toBeNull();
        rerender(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} privacyUrl="https://e.com/p" onOpenExternal={onOpenExternal} />);
        const a = container.querySelector('[data-youtube-consent] a');
        expect(a.getAttribute('rel')).toContain('noopener');
        fireEvent.click(a);
        expect(onOpenExternal).toHaveBeenCalledWith('https://e.com/p');
    });

    it('search: a failing onSearch shows an error, empty results show the empty state', async () => {
        const onSearch = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([]);
        render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} onSearch={onSearch} />);
        fireEvent.click(screen.getByText('Search YouTube (Experimental)'));
        const input = screen.getByPlaceholderText('Search for videos...');
        fireEvent.change(input, { target: { value: 'cats' } });
        await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
        expect(screen.getByText('Search Failed')).toBeInTheDocument();
        await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
        expect(screen.getByText('No videos found. Try a different search.')).toBeInTheDocument();
    });

    it('search result duration is formatted m:ss even for fractional seconds', async () => {
        const onSearch = vi.fn().mockResolvedValue([{ url: `https://youtu.be/${A}`, title: 'T', thumbnail: '', duration: 61.5, views: 3 }]);
        const { container } = render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} onSearch={onSearch} />);
        fireEvent.click(screen.getByText('Search YouTube (Experimental)'));
        const input = screen.getByPlaceholderText('Search for videos...');
        fireEvent.change(input, { target: { value: 'cats' } });
        await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
        const badge = container.querySelector('span.font-mono');
        expect(badge.textContent).toMatch(/^\d+:\d\d$/);
    });

    it('search result without views does not print "undefined views"', async () => {
        const onSearch = vi.fn().mockResolvedValue([{ url: `https://youtu.be/${A}`, title: 'T', thumbnail: '', uploaderName: 'U' }]);
        const { container } = render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} onSearch={onSearch} />);
        fireEvent.click(screen.getByText('Search YouTube (Experimental)'));
        const input = screen.getByPlaceholderText('Search for videos...');
        fireEvent.change(input, { target: { value: 'cats' } });
        await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
        expect(container.textContent).not.toMatch(/undefined|\{\{views\}\}/);
    });

    it('state resets on close (no stale preview consent after reopening)', () => {
        const { container, rerender } = render(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
        fireEvent.change(screen.getByPlaceholderText('https://youtube.com/watch?v=...'), { target: { value: A } });
        fireEvent.click(screen.getByText('Load preview'));
        rerender(<YoutubeEmbedModal isOpen={false} onClose={() => {}} onConfirm={() => {}} />);
        rerender(<YoutubeEmbedModal isOpen onClose={() => {}} onConfirm={() => {}} />);
        fireEvent.change(screen.getByPlaceholderText('https://youtube.com/watch?v=...'), { target: { value: A } });
        expect(container.querySelector('iframe')).toBeNull();
    });
});
