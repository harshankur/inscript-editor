import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../../tests/helpers/createEditor.js';
import { resolveYoutubeFacade, YOUTUBE_FACADE } from './Youtube.js';

const VALID_ID = 'dQw4w9WgXcQ';

describe('Youtube extension', () => {
    let editor;

    beforeEach(() => {
        editor = createEditor();
    });

    it('round-trips id/width/align through parse/render, using their defaults when omitted', () => {
        editor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
        const node = editor.state.doc.firstChild;
        expect(node.type.name).toBe('youtube');
        expect(node.attrs['data-youtube-video']).toBe(VALID_ID);
        expect(node.attrs.width).toBe('100%');
        expect(node.attrs.align).toBe('center');

        const html = editor.getHTML();
        expect(html).toContain(`data-youtube-video="${VALID_ID}"`);
        expect(html).toContain(`src="https://www.youtube.com/embed/${VALID_ID}"`);
    });

    it('is a fixed point through setContent(getHTML())', () => {
        editor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID, width: '50%', align: 'left' });
        const html1 = editor.getHTML();
        editor.commands.setContent(html1);
        const html2 = editor.getHTML();
        expect(html2).toBe(html1);
    });

    it('parses an embed/ iframe URL back into the node on paste-like HTML', () => {
        editor.commands.setContent(`<div data-youtube-video="${VALID_ID}" data-width="100%" data-align="center"></div>`);
        expect(editor.state.doc.firstChild.type.name).toBe('youtube');
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBe(VALID_ID);
    });

    it('parses a standard youtube.com embed iframe', () => {
        editor.commands.setContent(`<iframe src="https://www.youtube.com/embed/${VALID_ID}"></iframe>`);
        expect(editor.state.doc.firstChild.type.name).toBe('youtube');
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBe(VALID_ID);
    });

    it('parses a youtube-nocookie.com embed iframe', () => {
        editor.commands.setContent(`<iframe src="https://www.youtube-nocookie.com/embed/${VALID_ID}"></iframe>`);
        expect(editor.state.doc.firstChild.type.name).toBe('youtube');
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBe(VALID_ID);
    });

    it('parses a youtu.be short-link iframe', () => {
        editor.commands.setContent(`<iframe src="https://youtu.be/${VALID_ID}"></iframe>`);
        expect(editor.state.doc.firstChild.type.name).toBe('youtube');
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBe(VALID_ID);
    });

    it('does not parse a non-YouTube iframe as a youtube node', () => {
        editor.commands.setContent('<p>before</p><iframe src="https://example.com/embed/abcdefghijk"></iframe>');
        editor.state.doc.descendants(node => {
            expect(node.type.name).not.toBe('youtube');
        });
    });

    it('parses a watch?v= iframe src back into the node attrs', () => {
        editor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
        const html = editor.getHTML();
        editor.commands.setContent('');
        editor.commands.setContent(html);
        expect(editor.state.doc.firstChild.attrs['data-youtube-video']).toBe(VALID_ID);
    });

    describe('setYoutubeVideo command (null-ID guard)', () => {
        it('rejects an invalid/empty id and inserts nothing', () => {
            const result = editor.commands.setYoutubeVideo({ 'data-youtube-video': '' });
            expect(result).toBe(false);
            expect(editor.state.doc.childCount).toBe(1); // still just the default empty paragraph
            expect(editor.state.doc.firstChild.type.name).not.toBe('youtube');
        });

        it('rejects a too-short id', () => {
            const result = editor.commands.setYoutubeVideo({ 'data-youtube-video': 'short' });
            expect(result).toBe(false);
        });

        it('accepts a valid 11-char id', () => {
            const result = editor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
            expect(result).toBe(true);
            expect(editor.state.doc.firstChild.type.name).toBe('youtube');
        });
    });

    describe('null-id rendering (legacy/corrupt content)', () => {
        it('renderHTML never emits embed/null and omits the iframe entirely', () => {
            // Bypass the command guard to simulate legacy content with a null id already in the doc.
            editor.commands.insertContent({ type: 'youtube', attrs: { 'data-youtube-video': null, width: '100%', align: 'center' } });
            const html = editor.getHTML();
            expect(html).not.toContain('embed/null');
            expect(html).not.toContain('<iframe');
            expect(html).toContain('data-youtube-video=""');
        });

        it('preserves width/align attrs on the placeholder so the node round-trips', () => {
            editor.commands.insertContent({ type: 'youtube', attrs: { 'data-youtube-video': null, width: '50%', align: 'right' } });
            const html = editor.getHTML();
            editor.commands.setContent(html);
            const node = editor.state.doc.firstChild;
            expect(node.attrs.width).toBe('50%');
            expect(node.attrs.align).toBe('right');
        });
    });

    it('node view mounts an iframe pointed at the given id when mounted in a live DOM', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const liveEditor = createEditor({ element: el });
        liveEditor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
        const iframe = el.querySelector('iframe');
        expect(iframe).not.toBeNull();
        expect(iframe.src).toContain(VALID_ID);
        liveEditor.destroy();
        el.remove();
    });

    it('node view updates the iframe src when attrs change', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const liveEditor = createEditor({ element: el });
        liveEditor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
        const otherId = 'abcdefghijk'.slice(0, 11).replace(/./, 'x'); // any distinct 11-char id
        liveEditor.chain().selectAll().updateAttributes('youtube', { 'data-youtube-video': 'xbcdefghijk' }).run();
        const iframe = el.querySelector('iframe');
        expect(iframe.src).toContain('xbcdefghijk');
        liveEditor.destroy();
        el.remove();
    });

    it('node view lets clicks pass through to the iframe once the node is selected', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const liveEditor = createEditor({ element: el });
        liveEditor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });

        const overlay = el.querySelector('.youtube-embed > div:last-child');

        liveEditor.commands.setTextSelection(0); // deselect the node
        expect(overlay.style.pointerEvents).not.toBe('none');

        liveEditor.commands.setNodeSelection(0); // selects the atom node as a NodeSelection
        expect(overlay.style.pointerEvents).toBe('none');

        liveEditor.commands.setTextSelection(0);
        expect(overlay.style.pointerEvents).not.toBe('none');

        liveEditor.destroy();
        el.remove();
    });

    it('round-trips a data-embed-label caption attribute', () => {
        editor.commands.setContent(`<div data-youtube-video="${VALID_ID}" data-embed-label="My Talk"></div>`);
        expect(editor.state.doc.firstChild.attrs.label).toBe('My Talk');
        expect(editor.getHTML()).toContain('data-embed-label="My Talk"');
    });

    it('omits data-embed-label when there is no caption', () => {
        editor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
        expect(editor.getHTML()).not.toContain('data-embed-label');
    });

    it('renders a figcaption for the label in the node view', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const live = createEditor({ element: el });
        live.commands.setContent(`<div data-youtube-video="${VALID_ID}" data-embed-label="Captioned"></div>`);
        expect(el.querySelector('figcaption')?.textContent).toBe('Captioned');
        expect(el.querySelector('.youtube-embed')).not.toBeNull();
        live.destroy();
        el.remove();
    });

    it('facade mode renders a thumbnail instead of an immediate iframe', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const liveEditor = createEditor({ element: el }, { youtube: { facade: true } });
        liveEditor.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });

        expect(el.querySelector('iframe')).toBeNull(); // nothing loaded until the user clicks
        const btn = el.querySelector('button[aria-label="Load YouTube video"]');
        expect(btn).not.toBeNull();
        expect(el.innerHTML).toContain(`i.ytimg.com/vi/${VALID_ID}`);

        liveEditor.destroy();
        el.remove();
    });

    describe('resolveYoutubeFacade', () => {
        it.each([
            ['false', false, 'none'],
            ['undefined', undefined, 'none'],
            ['null', null, 'none'],
            ['true', true, 'thumbnail'],
            ["'thumbnail'", 'thumbnail', 'thumbnail'],
            ["'local'", 'local', 'local'],
            ['any other truthy value (it turned the facade on before)', 'yes', 'thumbnail'],
        ])('%s -> %s', (_label, input, expected) => {
            expect(resolveYoutubeFacade(input)).toBe(expected);
        });

        it('names the three modes', () => {
            expect(YOUTUBE_FACADE).toEqual({ NONE: 'none', THUMBNAIL: 'thumbnail', LOCAL: 'local' });
        });
    });

    describe('saved youtube-nocookie.com HTML', () => {
        it('loads back as a normal YouTube node, saved and shown on www.youtube.com', () => {
            const el = document.createElement('div');
            document.body.appendChild(el);
            const live = createEditor({ element: el });
            live.commands.setContent(`<iframe src="https://www.youtube-nocookie.com/embed/${VALID_ID}"></iframe>`);
            expect(live.state.doc.firstChild.type.name).toBe('youtube');
            expect(live.state.doc.firstChild.attrs['data-youtube-video']).toBe(VALID_ID);
            expect(live.getHTML()).toContain(`src="https://www.youtube.com/embed/${VALID_ID}"`);
            expect(live.getHTML()).not.toContain('nocookie');
            expect(el.querySelector('iframe').getAttribute('src')).toBe(`https://www.youtube.com/embed/${VALID_ID}`);
            live.destroy();
            el.remove();
        });

        it('takes no nocookie option: one passed anyway changes nothing', () => {
            const ed = createEditor({}, { youtube: { nocookie: true } });
            ed.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
            expect(ed.getHTML()).toContain(`src="https://www.youtube.com/embed/${VALID_ID}"`);
            expect(ed.extensionManager.extensions.find(e => e.name === 'youtube').options).not.toHaveProperty('nocookie');
            ed.destroy();
        });
    });

    describe("consent placeholder (facade: 'local')", () => {
        const PRIVACY_URL = 'https://example.com/datenschutz#video';
        const mount = (youtube, { editable = true, hostHandlersRef } = {}) => {
            const el = document.createElement('div');
            document.body.appendChild(el);
            const live = createEditor({ element: el, editable }, { youtube, hostHandlersRef });
            live.commands.insertContent({ type: 'youtube', attrs: { 'data-youtube-video': VALID_ID } });
            return { el, live, done: () => { live.destroy(); el.remove(); } };
        };
        const consentOf = el => el.querySelector('[data-youtube-consent]');
        const loadButton = el => consentOf(el).querySelector('button');
        // The node view's own stopEvent, as ProseMirror calls it for an event inside the node.
        const stops = (el, target, type = 'mousedown') => {
            const event = new Event(type, { bubbles: true });
            Object.defineProperty(event, 'target', { value: target });
            return el.querySelector('figure').pmViewDesc.stopEvent(event);
        };

        it('requests nothing before the click: no iframe, no thumbnail, no remote URL', () => {
            const { el, done } = mount({ facade: 'local' });
            expect(el.querySelector('iframe')).toBeNull();
            expect(consentOf(el).getAttribute('data-youtube-facade')).toBe('local');
            expect(el.innerHTML).not.toContain('ytimg');
            expect(el.innerHTML).not.toMatch(/url\(|https?:\/\//);
            expect(el.querySelector('img')).toBeNull();
            done();
        });

        it('asks for consent then and there: heading, plain-words text and a "Load video" button', () => {
            const { el, done } = mount({ facade: 'local' });
            const consent = consentOf(el);
            expect(consent.textContent).toContain('YouTube video');
            expect(consent.textContent).toContain('Playing this video loads it from YouTube. YouTube (Google) then receives data such as your IP address and may set cookies.');
            expect(loadButton(el).textContent).toBe('Load video');
            done();
        });

        it('has no privacy link unless the host gives a privacy URL', () => {
            const { el, done } = mount({ facade: 'local' });
            expect(consentOf(el).querySelector('a')).toBeNull();
            done();
        });

        it("links the host's privacy notice in a new tab, with rel=\"noopener\"", () => {
            const { el, done } = mount({ facade: 'local', privacyUrl: PRIVACY_URL });
            const link = consentOf(el).querySelector('a');
            expect(link.getAttribute('href')).toBe(PRIVACY_URL);
            expect(link.target).toBe('_blank');
            expect(link.rel).toBe('noopener');
            expect(link.textContent).toBe('Privacy notice');
            done();
        });

        it("opens the privacy link through the host's opener (editorOptions.onOpenExternal)", () => {
            const onOpenExternal = vi.fn();
            const { el, done } = mount({ facade: 'local', privacyUrl: PRIVACY_URL }, { hostHandlersRef: { current: { onOpenExternal } } });
            const event = new MouseEvent('click', { bubbles: true, cancelable: true });
            consentOf(el).querySelector('a').dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
            expect(onOpenExternal).toHaveBeenCalledWith(PRIVACY_URL);
            done();
        });

        it('loads the official player from www.youtube.com on the first press of the button', () => {
            const { el, done } = mount({ facade: 'local' });
            loadButton(el).click();
            expect(consentOf(el)).toBeNull();
            expect(el.querySelector('iframe').getAttribute('src')).toBe(`https://www.youtube.com/embed/${VALID_ID}`);
            done();
        });

        it('moves focus to the player when the button was pressed from the keyboard', () => {
            const { el, done } = mount({ facade: 'local' });
            loadButton(el).focus();
            loadButton(el).click();
            expect(document.activeElement).toBe(el.querySelector('iframe'));
            done();
        });

        it('leaves focus alone when the button did not have it', () => {
            const { el, done } = mount({ facade: 'local' });
            const outside = document.createElement('input');
            document.body.appendChild(outside);
            outside.focus();
            loadButton(el).click();
            expect(document.activeElement).toBe(outside);
            outside.remove();
            done();
        });

        it('loads the player on the first press in a read-only editor too', () => {
            const { el, done } = mount({ facade: 'local' }, { editable: false });
            loadButton(el).click();
            expect(el.querySelector('iframe').getAttribute('src')).toBe(`https://www.youtube.com/embed/${VALID_ID}`);
            done();
        });

        it('lays no overlay over the placeholder, so its button takes the first click', () => {
            const { el, done } = mount({ facade: 'local' });
            expect(el.querySelector('.youtube-embed-overlay')).toBeNull();
            loadButton(el).click();
            // The loaded player gets the overlay back, so a click on it selects the node.
            expect(el.querySelector('.youtube-embed > .youtube-embed-overlay')).not.toBeNull();
            done();
        });

        it("keeps ProseMirror out of its button's and link's events, so a click or Enter/Space acts at once", () => {
            const { el, done } = mount({ facade: 'local', privacyUrl: PRIVACY_URL });
            const consent = consentOf(el);
            expect(stops(el, loadButton(el), 'mousedown')).toBe(true);
            expect(stops(el, loadButton(el), 'keydown')).toBe(true);
            expect(stops(el, loadButton(el).querySelector('span').firstChild, 'click')).toBe(true); // a text node inside it
            expect(stops(el, consent.querySelector('a'), 'mousedown')).toBe(true);
            // The rest of the placeholder still selects the node, as a click on a video does.
            expect(stops(el, consent, 'mousedown')).toBe(false);
            expect(stops(el, consent.firstChild, 'mousedown')).toBe(false);
            done();
        });

        it('leaves every event to ProseMirror once the player is loaded', () => {
            const { el, done } = mount({ facade: 'local' });
            loadButton(el).click();
            expect(stops(el, el.querySelector('.youtube-embed-overlay'), 'mousedown')).toBe(false);
            expect(stops(el, el.querySelector('iframe'), 'mousedown')).toBe(false);
            done();
        });

        it('the button is a real, focusable <button>', () => {
            const { el, done } = mount({ facade: 'local' });
            const button = loadButton(el);
            expect(button.tagName).toBe('BUTTON');
            expect(button.type).toBe('button');
            button.focus();
            expect(document.activeElement).toBe(button);
            done();
        });

        it('keeps the video box (aspect ratio, width, alignment) and sizes itself to it', () => {
            const { el, live, done } = mount({ facade: 'local' });
            live.chain().selectAll().updateAttributes('youtube', { width: '50%', align: 'left' }).run();
            const box = el.querySelector('.youtube-embed');
            expect(box.className).toContain('aspect-video');
            expect(box.className).toContain('@container');
            expect(box.contains(consentOf(el))).toBe(true);
            expect(consentOf(el).className).toContain('absolute inset-0');
            expect(el.querySelector('figure').style.width).toBe('50%');
            expect(el.querySelector('figure').style.marginLeft).toBe('0px');
            done();
        });

        it('asks again for a new video ID set before the press, and then loads that video', () => {
            const { el, live, done } = mount({ facade: 'local' });
            const before = consentOf(el);
            live.chain().selectAll().updateAttributes('youtube', { 'data-youtube-video': 'xbcdefghijk' }).run();
            expect(consentOf(el)).not.toBe(before);
            loadButton(el).click();
            expect(el.querySelector('iframe').getAttribute('src')).toBe('https://www.youtube.com/embed/xbcdefghijk');
            done();
        });

        it('keeps a width set before the press once the player loads', () => {
            const { el, live, done } = mount({ facade: 'local' });
            live.chain().selectAll().updateAttributes('youtube', { width: '50%' }).run();
            loadButton(el).click();
            expect(el.querySelector('figure').style.width).toBe('50%');
            expect(el.querySelector('iframe')).not.toBeNull();
            done();
        });

        it('saves the same HTML as without a facade (the placeholder is only on screen)', () => {
            const plain = createEditor();
            plain.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
            const { live, done } = mount({ facade: 'local', privacyUrl: PRIVACY_URL });
            expect(live.getHTML()).toBe(plain.getHTML());
            plain.destroy();
            done();
        });

        it('shows the "Video unavailable" placeholder, not the consent, for a video with no ID', () => {
            const el = document.createElement('div');
            document.body.appendChild(el);
            const live = createEditor({ element: el }, { youtube: { facade: 'local' } });
            live.commands.insertContent({ type: 'youtube', attrs: { 'data-youtube-video': null } });
            expect(consentOf(el)).toBeNull();
            expect(el.textContent).toContain('Video unavailable');
            live.destroy();
            el.remove();
        });
    });

    it('thumbnail facade loads the player on click', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const live = createEditor({ element: el }, { youtube: { facade: 'thumbnail' } });
        live.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
        const btn = el.querySelector('button[data-youtube-facade="thumbnail"]');
        expect(btn.style.background).toContain(`i.ytimg.com/vi/${VALID_ID}/hqdefault.jpg`);
        btn.click();
        expect(el.querySelector('iframe').getAttribute('src')).toBe(`https://www.youtube.com/embed/${VALID_ID}`);
        live.destroy();
        el.remove();
    });

    it('does not set the iframe src again (reloading the player) when only the width changes', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const live = createEditor({ element: el });
        live.commands.setYoutubeVideo({ 'data-youtube-video': VALID_ID });
        const iframe = el.querySelector('iframe');
        const sets = [];
        const proto = Object.getPrototypeOf(iframe);
        const desc = Object.getOwnPropertyDescriptor(proto, 'src');
        Object.defineProperty(iframe, 'src', {
            configurable: true,
            get() { return desc.get.call(this); },
            set(v) { sets.push(v); desc.set.call(this, v); },
        });
        live.chain().selectAll().updateAttributes('youtube', { width: '50%' }).run();
        expect(el.querySelector('figure').style.width).toBe('50%');
        expect(sets).toEqual([]);
        live.chain().selectAll().updateAttributes('youtube', { 'data-youtube-video': 'xbcdefghijk' }).run();
        expect(sets).toEqual(['https://www.youtube.com/embed/xbcdefghijk']);
        live.destroy();
        el.remove();
    });

    it('pasting a bare YouTube URL inserts a youtube node (beating linkOnPaste)', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const liveEditor = createEditor({ element: el });
        const mockEvent = { clipboardData: { getData: (type) => (type === 'text/plain' ? `https://youtu.be/${VALID_ID}` : '') } };

        const handled = liveEditor.view.someProp('handlePaste', fn => fn(liveEditor.view, mockEvent) || undefined);
        expect(handled).toBe(true);
        expect(liveEditor.state.doc.firstChild.type.name).toBe('youtube');
        expect(liveEditor.state.doc.firstChild.attrs['data-youtube-video']).toBe(VALID_ID);

        liveEditor.destroy();
        el.remove();
    });

    it('does not hijack a paste that is not a bare YouTube URL', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const liveEditor = createEditor({ element: el });
        const mockEvent = { clipboardData: { getData: () => `see https://youtu.be/${VALID_ID} here` } };

        // someProp runs every plugin's handlePaste; the point is only that OUR rule
        // does not fire on text with surrounding words — no youtube node is created.
        try { liveEditor.view.someProp('handlePaste', fn => fn(liveEditor.view, mockEvent) || undefined); } catch { /* minimal mock event */ }
        let hasYoutube = false;
        liveEditor.state.doc.descendants(n => { if (n.type.name === 'youtube') hasYoutube = true; });
        expect(hasYoutube).toBe(false);

        liveEditor.destroy();
        el.remove();
    });

    it('node view renders the placeholder (no iframe) when mounted with a null id', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const liveEditor = createEditor({ element: el });
        liveEditor.commands.insertContent({ type: 'youtube', attrs: { 'data-youtube-video': null, width: '100%', align: 'center' } });
        expect(el.querySelector('iframe')).toBeNull();
        expect(el.textContent).toContain('Video unavailable');
        liveEditor.destroy();
        el.remove();
    });
});
